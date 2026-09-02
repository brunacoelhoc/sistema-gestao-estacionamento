# 🔐 Autenticação e Controle de Acesso (RBAC)

Especificação de como a API autentica requisições, como o usuário se autentica, e como o controle de acesso baseado em papéis (RBAC) é aplicado em cada rota. Complementa o [README.md](./README.md), o [MAPEAMENTO_ROTAS.md](./MAPEAMENTO_ROTAS.md) (contrato de rotas) e o [REGRAS_NEGOCIO.md](./REGRAS_NEGOCIO.md) (regras de negócio).

## 📌 Índice

- [Autenticação da API](#-autenticação-da-api)
- [Autenticação do usuário](#-autenticação-do-usuário)
- [Ciclo de vida do token JWT](#-ciclo-de-vida-do-token-jwt)
- [Papéis do sistema (RBAC)](#-papéis-do-sistema-rbac)
- [Como as camadas de proteção se combinam](#-como-as-camadas-de-proteção-se-combinam)
- [Matriz de permissões por módulo](#-matriz-de-permissões-por-módulo)
- [Regras de visibilidade além do guard (nível de service)](#-regras-de-visibilidade-além-do-guard-nível-de-service)
- [Resumo por papel](#-resumo-por-papel)

---

## 🌐 Autenticação da API

Camada de proteção do **transporte/infraestrutura**, independente de qual usuário está logado — protege a API como um todo contra abuso e acesso indevido de origem.

| Mecanismo | Como funciona |
|---|---|
| **Esquema de token** | Bearer JWT no header `Authorization: Bearer <token>`. Não há API key separada, nem autenticação por certificado/mTLS — toda a proteção de acesso é via JWT de usuário. |
| **Prefixo de rota** | Não há `/api/v1` nem versionamento — rotas ficam na raiz da aplicação. |
| **Rotas públicas (sem token)** | `POST /auth/login`, `POST /auth/registrar`, `POST /auth/google`, `POST /auth/reset/solicitar`, `POST /auth/reset/confirmar`, `POST /analytics/eventos`, `GET /health`, `GET /config`. Todas as demais exigem token válido. |
| **Rate limiting (throttling)** | `AuthThrottlerGuard` limita `/auth/*` a **10 requisições / 15 minutos** por origem — mitiga força bruta de login e abuso de reset de senha. `EventosThrottlerGuard` limita `POST /analytics/eventos` a **30 requisições / 60 segundos**, já que essa rota é pública e usada antes do login. |
| **CORS** | Sem a variável `CORS_ORIGIN` configurada, em produção o acesso cross-origin é **bloqueado** (`origin: false`) — a API não fica aberta por padrão. |
| **Limite de payload** | Corpo da requisição limitado a `6mb` (acomoda avatar/assinatura/comprovante em base64, mas evita payloads arbitrariamente grandes). |
| **Validação de variáveis de ambiente no boot** | A aplicação recusa subir (`process.exit(1)`) se `JWT_SECRET` ou `DATABASE_URL` não estiverem definidas — evita rodar em produção com segredo ausente ou fallback inseguro. |
| **Validação estrita de entrada** | `ValidationPipe` global com `whitelist: true` + `forbidNonWhitelisted: true` — qualquer campo não declarado no DTO da rota é rejeitado com `400`, reduzindo superfície de ataque por campos extras/mass assignment. |
| **Normalização de erros** | Todo erro (inclusive exceptions não tratadas) é convertido para `{ erro: string }` antes de sair para o cliente — detalhes internos (stack trace, mensagens do driver do banco, etc.) nunca vazam na resposta, apenas nos logs do servidor. |

---

## 👤 Autenticação do usuário

Camada de identificação de **quem** está fazendo a requisição.

### Login local (CPF + senha)

- `POST /auth/login` — autenticação por **CPF**, não por e-mail.
- Senha armazenada com hash **bcrypt**; nunca em texto puro.
- Mitigação de timing-attack: o `bcrypt.compare` é executado mesmo quando o CPF não existe (contra um hash "fantasma"), para que o tempo de resposta não revele se um CPF está cadastrado.
- Credenciais inválidas (CPF inexistente ou senha errada) sempre retornam a mesma mensagem genérica (`401 'CPF ou senha inválidos.'`) — não diferencia qual dado estava errado.
- Conta com `ativo: false` não consegue logar (`403 'Este usuário está inativo. Fale com um administrador do sistema.'`), mesmo com senha correta.

### Login social (Google)

- `POST /auth/google` — recebe um `credential` (ID token do Google) e o valida **no servidor**, verificando a assinatura junto ao Google — o back-end nunca confia em dados de usuário decodificados no front.
- Primeiro login com uma conta Google nova **cria automaticamente** o usuário.
- Contas criadas via Google não têm senha local — não podem usar `POST /auth/login` nem o fluxo de reset de senha até definirem uma senha.
- **Perfil incompleto**: contas Google não trazem CPF do provedor. Enquanto o CPF não for cadastrado, o `ProfileCompleteGuard` bloqueia o acesso a **todas** as rotas operacionais/RH (só libera `/usuarios/:id` do próprio usuário para completar o cadastro) — retorna `403 { erro: 'Cadastro incompleto: informe seu CPF para continuar.', codigo: 'PERFIL_INCOMPLETO' }`.

### Autorregistro

- `POST /auth/registrar` — qualquer pessoa pode criar conta, mas **sempre** nasce com `role: 'funcionario'` (o papel "comum"). Não é possível se autocadastrar como admin, RH, gestor ou financeiro — essas mudanças de papel só acontecem via `PATCH /usuarios/:id` feito por um admin.
- Exige aceite explícito dos termos (`aceitouTermos: true`).

### Recuperação de senha

- `POST /auth/reset/solicitar` → gera código de 6 dígitos, válido por **15 minutos**, enviado por e-mail; armazenado apenas como hash SHA-256 (nunca em texto puro) e de uso único.
- `POST /auth/reset/confirmar` → valida código + define nova senha. Mensagem de erro idêntica para "código errado" e "código expirado" (evita vazar qual condição falhou).
- Contas Google sem senha local não podem usar este fluxo.

---

## 🔁 Ciclo de vida do token JWT

- **Emissão**: no login (local ou Google) bem-sucedido, e novamente sempre que o próprio usuário edita seu cadastro (`PATCH /usuarios/:id` no próprio id) — necessário porque o token carrega o campo `cpfPendente`, que muda assim que o CPF é preenchido.
- **Payload**: `{ id, role, nome, cpfPendente }` — o papel (`role`) fica embutido no token; uma mudança de papel feita por um admin só passa a valer para o usuário afetado **no próximo login** (o token antigo continua com o papel antigo até expirar ou ser reemitido).
- **Expiração padrão**: 8 horas.
- **Verificação**: em toda rota protegida, o `JwtAuthGuard` decodifica e valida a assinatura do token; token ausente → `401 'Token de autenticação ausente.'`; token inválido/expirado → `401 'Token de autenticação inválido ou expirado.'`.
- **Sem estado no servidor**: não há sessão nem armazenamento de tokens ativos — não existe endpoint de logout server-side; "deslogar" é apenas descartar o token no cliente. Não há revogação/blacklist de tokens antes da expiração.

---

## 🧩 Papéis do sistema (RBAC)

O enum `Papel` no banco define cinco papéis:

| Papel | Apelido usado neste documento | Descrição |
|---|---|---|
| `admin` | **Admin** | Acesso irrestrito: gestão de usuários, RH completo, financeiro, métricas, auditoria. |
| `rh` | **RH** | Gestão de pessoas: perfis de RH, ponto, férias, folha de pagamento, contratos, carreira/PDI — para qualquer funcionário, não só o próprio. |
| `gestor` | **Gestor** | Visão gerencial limitada: organograma, desempenho da equipe (tickets atendidos) — **não** enxerga salário, ponto, férias ou documentos de terceiros. |
| `financeiro` | **Financeiro** | Acesso às áreas de cobrança: KPIs de mensalidades e métricas financeiras. Não tem acesso a RH. |
| `funcionario` | **Comum** | Operação do dia a dia do estacionamento (tickets, caixa, vagas, tarifas, mensalistas) + autoatendimento de RH (bater ponto, ver o próprio holerite/contrato, pedir férias, assinar documentos). Não vê dados de RH de outras pessoas. |

> Um usuário sempre tem **exatamente um** papel — não há combinação de múltiplos papéis por conta.

---

## 🛡️ Como as camadas de proteção se combinam

Cada rota protegida passa por até três guards, aplicados em sequência (todos precisam passar):

1. **`JwtAuthGuard`** — obrigatório em toda rota que não é pública. Garante que existe um usuário autenticado.
2. **`ProfileCompleteGuard`** — aplicado à maioria dos módulos operacionais e de RH. Garante que o usuário (tipicamente vindo de login Google) já completou o CPF antes de usar o sistema.
3. **`RolesGuard` + `@Roles(...)`** — **opt-in**: só existe nas rotas que declaram explicitamente uma lista de papéis permitidos. Se uma rota não declara `@Roles()`, qualquer usuário autenticado (e com perfil completo) passa — a restrição por papel não é o padrão, é a exceção.

Além disso, dois guards especiais substituem esse padrão em pontos específicos:

- **`AdminGuard`** — usado nas rotas de gestão de usuários (`/usuarios`) em vez de `RolesGuard`, checa `role === 'admin'` de forma fixa.
- **Checagem manual no controller** (não é um guard) — usada em `GET /mensalidades` para exigir `admin`/`financeiro` **apenas quando** a consulta não é filtrada por um mensalista específico, já que a mesma rota é usada sem restrição para consultar o histórico de um mensalista específico a partir de outras telas.

Há ainda uma quarta camada, **dentro do service** (não visível na assinatura da rota), descrita na próxima seção — decide visibilidade linha a linha (ex.: "posso editar meu próprio cadastro, mas não o de outra pessoa").

---

## 🗂️ Matriz de permissões por módulo

Legenda: 🟢 = qualquer usuário autenticado (com perfil completo) tem acesso · 🔒 = restrito aos papéis listados · 👤 = qualquer autenticado, mas restrito ao próprio recurso · 🌐 = público (sem token).

| Módulo | Rota (resumo) | Quem acessa |
|---|---|---|
| Auth | login / registrar / google / reset | 🌐 Público |
| Usuários | `GET /usuarios` (listar) | 🔒 admin, rh, gestor |
| Usuários | `GET /usuarios/:id`, `GET /usuarios/verificar-cpf`, `POST /usuarios` | 🔒 admin |
| Usuários | `PATCH /usuarios/:id` | 👤 o próprio usuário, ou admin (campos `role`/`ativo` só surtem efeito se quem envia é admin) |
| Mensalistas | CRUD completo | 🟢 qualquer autenticado (operação de balcão) — mas `cpf` e `valorMensalidade` em edição só são aplicados se quem envia é admin |
| Mensalidades | `GET /mensalidades/kpis` | 🔒 admin, financeiro |
| Mensalidades | `GET /mensalidades` sem `mensalistaId` | 🔒 admin, financeiro |
| Mensalidades | `GET /mensalidades` com `mensalistaId`, `PATCH`, lembrete | 🟢 qualquer autenticado |
| Tickets | CRUD completo | 🟢 qualquer autenticado (operação de balcão) |
| Vagas | CRUD completo | 🟢 qualquer autenticado |
| Tarifas | CRUD completo | 🟢 qualquer autenticado |
| Caixa | abrir / fechar / status do dia | 🟢 qualquer autenticado |
| Métricas | `GET /metricas` | 🔒 admin, financeiro |
| Dashboard | KPIs, ranking de vagas | 🟢 qualquer autenticado |
| Desempenho | `GET /desempenho` | 🔒 admin, rh, gestor |
| Analytics | `POST /analytics/eventos` | 🌐 Público (rate-limited) |
| Auditoria | `GET /auditoria` | 🔒 admin, rh |
| Perfil RH | `GET /rh-perfil/me`, `GET /rh-perfil/organograma` | 🟢 qualquer autenticado |
| Perfil RH | `GET /rh-perfil/cargos`, `PATCH /rh-perfil/:usuarioId` | 🔒 admin, rh |
| Perfil RH | `GET /rh-perfil/:usuarioId` | 👤 o próprio dono, ou admin/rh (`ehGestaoDeRh`) para ver de outra pessoa |
| Assinatura Eletrônica | GET/POST `/me` | 👤 sempre o próprio usuário |
| Ponto | bater entrada/saída | 👤 sempre o próprio usuário |
| Ponto | `GET /ponto`, `GET /ponto/resumo` | 👤 o próprio, ou admin/rh (`ehGestaoDeRh`) para consultar `usuarioId` de outra pessoa |
| Justificativas de Ponto | `POST` (lançar) | 🔒 admin, rh |
| Justificativas de Ponto | `GET` | 👤 o próprio, ou admin/rh para outra pessoa |
| Trabalho Extra | `POST` (solicitar) | 👤 sempre o próprio usuário |
| Trabalho Extra | `GET` | 👤 o próprio, ou admin/rh para outra pessoa |
| Trabalho Extra | `PATCH` (decidir) | 🔒 admin, rh |
| Férias | `POST` (solicitar) | 👤 sempre o próprio usuário |
| Férias | `GET` | 👤 o próprio, ou admin/rh para outra pessoa |
| Férias | `PATCH` (decidir / editar datas) | 🔒 admin, rh |
| Notificações | `GET`, `PATCH :id/lida` | 👤 sempre o próprio usuário |
| Espelho de Ponto | `POST /gerar` | 🔒 admin, rh |
| Espelho de Ponto | `GET`, `GET /:id/pdf` | 👤 o próprio, ou admin/rh para outra pessoa |
| Espelho de Ponto | `POST /:id/assinar` | 👤 sempre o próprio dono do documento |
| Contrato de Trabalho | `POST /gerar` | 🔒 admin, rh |
| Contrato de Trabalho | `GET`, `GET /:id/pdf` | 👤 o próprio, ou admin/rh para outra pessoa |
| Contrato de Trabalho | `POST /:id/assinar` | 👤 sempre o próprio dono do documento |
| Folha de Pagamento | `POST /gerar`, `POST /:id/pagar` | 🔒 admin, rh |
| Folha de Pagamento | `GET`, `GET /:id/pdf` | 👤 o próprio, ou admin/rh para outra pessoa |
| Folha de Pagamento | `POST /:id/assinar` | 👤 sempre o próprio dono do documento |
| Etapas de Carreira | `GET` (catálogo) | 🟢 qualquer autenticado |
| Etapas de Carreira | `POST`, `PATCH`, `DELETE` | 🔒 admin, rh |
| PDI | `GET /pdi/me`, `GET /pdi/:usuarioId` | 👤 o próprio, ou admin/rh para outra pessoa |
| PDI | `POST`, `PATCH`, `DELETE` (todas as ações de item) | 🔒 admin, rh (o funcionário nunca edita o próprio PDI, só visualiza) |
| Utilitárias | `GET /health`, `GET /config` | 🌐 Público |

---

## 🔍 Regras de visibilidade além do guard (nível de service)

Nem toda restrição de acesso aparece como um guard na rota — várias são aplicadas **dentro do service**, olhando o usuário autenticado (`request.usuario`) contra o dado sendo acessado:

- **Regra central de "gestão de RH"** (`ehGestaoDeRh`, usada em Ponto, Justificativas, Trabalho Extra, Férias, Perfil RH, Espelho de Ponto, Contrato, Folha de Pagamento e PDI): `role === 'admin' || role === 'rh'`. É a única definição de "quem pode ver/gerenciar dados de RH de outra pessoa" no sistema inteiro. **Gestor está deliberadamente fora dessa regra** — mesmo sendo um papel de liderança, um gestor não enxerga ponto, férias, salário ou documentos de outros funcionários, apenas organograma e desempenho agregado.
- **Autoedição ou admin** (`Usuarios`): `PATCH /usuarios/:id` só é aceito se `solicitante.id === id` ou `solicitante.role === 'admin'`; mesmo quando aceito, os campos `role` e `ativo` só têm efeito se quem envia é admin (senão são ignorados silenciosamente, sem erro).
- **Campos restritos por papel dentro de um mesmo endpoint** (`Mensalistas`): qualquer autenticado pode editar um mensalista, mas os campos `cpf` e `valorMensalidade` só são de fato aplicados se `solicitante.role === 'admin'`.
- **Mascaramento de CPF**: usuários e mensalistas têm o CPF mascarado (`***.***.**XX-XX`) nas respostas para quem não é admin — a restrição de acesso não é "tudo ou nada" por rota, mas por campo dentro da resposta.
- **Documentos assinados por procuração são proibidos**: em Espelho de Ponto, Contrato de Trabalho e Folha de Pagamento, a ação de **assinar** é sempre restrita ao próprio dono do documento — nem admin, nem RH podem assinar em nome de outra pessoa, mesmo tendo acesso de leitura ao documento.
- **Auditoria automática**: toda ação de RH sensível (definir perfil, decidir férias/trabalho extra, lançar justificativa, gerar/assinar/pagar documentos, mexer em etapas de carreira e PDI) grava um registro em `LogAuditoria` com o papel do autor **no momento da ação** — se o papel do usuário mudar depois, o histórico de auditoria não é reescrito.

---

## 👥 Resumo por papel

### 🛠️ Admin
Acesso irrestrito. Único papel que pode: gerenciar contas de usuário (criar, ver CPF completo, promover/rebaixar papel, ativar/inativar), acessar métricas financeiras e KPIs de mensalidades, ver o log de auditoria completo. Também acumula tudo que RH e o papel comum podem fazer (gerar/decidir documentos de RH, operar o balcão do estacionamento).

### 🧑‍💼 RH
Dono da operação de pessoas: define/edita perfil de RH de qualquer funcionário, decide solicitações de férias e trabalho extra, lança justificativas de ponto, gera e (junto com admin) paga folha de pagamento, gera contratos e espelhos de ponto, gerencia etapas de carreira e itens de PDI de qualquer funcionário. **Não** tem acesso a métricas financeiras nem à gestão de contas de usuário (criar/promover usuários é exclusivo de admin).

### 👔 Gestor
Papel de visão gerencial, não de administração de RH. Enxerga a listagem de usuários (`GET /usuarios`), o organograma completo e o relatório de desempenho da equipe (tickets atendidos por funcionário). **Não** vê ponto, férias, salário, holerite, contrato ou PDI de outras pessoas — mesmo sendo "gestor" no organograma de alguém, o acesso a esses dados individuais é exclusivo de admin/RH.

### 💰 Financeiro
Papel restrito à área de cobrança: acessa KPIs de mensalidades (MRR, recebido no mês, ticket médio) e a tela de Métricas. Sem acesso a nenhuma rota de RH nem à gestão de usuários.

### 👷 Comum (`funcionario`)
Papel padrão de quem se autorregistra ou é cadastrado sem papel especial. Opera o dia a dia do estacionamento sem restrição adicional (abrir/fechar caixa, tickets, vagas, tarifas, mensalistas) e tem autoatendimento completo de RH **sobre si mesmo**: bate o próprio ponto, solicita férias e trabalho extra, assina os próprios documentos (espelho de ponto, contrato, holerite) com a assinatura eletrônica cadastrada, acompanha o próprio PDI e etapa de carreira. Não visualiza nem edita dados de RH de nenhuma outra pessoa.
