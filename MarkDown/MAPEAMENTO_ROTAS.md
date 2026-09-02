# 🗺️ Mapeamento de Rotas da API (CRUD)

Documentação completa de todos os endpoints HTTP expostos pelo back-end (NestJS + Prisma), organizados por entidade. Este documento complementa o [README.md](./README.md) — que traz visão geral, stack e regras de negócio — com o **contrato de entrada e saída** de cada rota.

## 📌 Índice

- [Convenções gerais](#-convenções-gerais)
- [Autenticação (`/auth`)](#-autenticação-auth)
- [Usuários / Funcionários (`/usuarios`)](#-usuários--funcionários-usuarios)
- [Mensalistas (`/mensalistas`)](#-mensalistas-mensalistas)
- [Mensalidades (`/mensalidades`)](#-mensalidades-mensalidades)
- [Tickets (`/tickets`)](#-tickets-tickets)
- [Vagas (`/vagas`)](#-vagas-vagas)
- [Tarifas (`/tarifas`)](#-tarifas-tarifas)
- [Caixa Diário (`/caixa`)](#-caixa-diário-caixa)
- [Métricas (`/metricas`)](#-métricas-metricas)
- [Dashboard (`/dashboard`)](#-dashboard-dashboard)
- [Analytics (`/analytics`)](#-analytics-analytics)
- [Auditoria (`/auditoria`)](#-auditoria-auditoria)
- [Perfil RH (`/rh-perfil`)](#-perfil-rh-rh-perfil)
- [Assinatura Eletrônica (`/assinatura-eletronica`)](#-assinatura-eletrônica-assinatura-eletronica)
- [Ponto (`/ponto`)](#-ponto-ponto)
- [Justificativas de Ponto (`/ponto/justificativas`)](#-justificativas-de-ponto-pontojustificativas)
- [Trabalho Extra (`/ponto/trabalho-extra`)](#-trabalho-extra-pontotrabalho-extra)
- [Férias (`/ferias`)](#-férias-ferias)
- [Notificações (`/notificacoes`)](#-notificações-notificacoes)
- [Espelho de Ponto (`/espelho-ponto`)](#-espelho-de-ponto-espelho-ponto)
- [Contrato de Trabalho (`/contrato-trabalho`)](#-contrato-de-trabalho-contrato-trabalho)
- [Folha de Pagamento (`/folha-pagamento`)](#-folha-de-pagamento-folha-pagamento)
- [Desempenho (`/desempenho`)](#-desempenho-desempenho)
- [Etapas de Carreira (`/etapas-carreira`)](#-etapas-de-carreira-etapas-carreira)
- [PDI (`/pdi`)](#-pdi-pdi)
- [Rotas utilitárias (`/health`, `/config`)](#-rotas-utilitárias-health-config)

---

## ⚙️ Convenções gerais

- **Base URL**: sem prefixo de versão — as rotas ficam na raiz da aplicação (`http://localhost:3001/...` por padrão). Não existe `/api/v1`.
- **Autenticação**: JWT no header `Authorization: Bearer <token>`, obtido em `POST /auth/login`. Não há sessão/cookie.
  - Payload do token: `{ id, role, nome, cpfPendente }`.
  - Guards possíveis por rota:
    - **Autenticado** — qualquer usuário com token válido (`JwtAuthGuard`).
    - **Perfil completo** — bloqueia quem entrou via Google e ainda não cadastrou CPF (`ProfileCompleteGuard`), retorna `403 { codigo: 'PERFIL_INCOMPLETO' }`.
    - **Admin** — exclusivo para `role === 'admin'` (`AdminGuard`).
    - **Papéis** — lista de papéis permitidos via `@Roles(...)` (`RolesGuard`). Papéis existentes: `admin | funcionario | rh | gestor | financeiro`.
  - Login é feito por **CPF**, não por e-mail. Senhas com hash bcrypt.
- **Formato de erro padrão do Nest**: `{ statusCode, message, error }`.
- **Datas**: campos `data`/`dataInicio`/`dataFim` no formato `YYYY-MM-DD`; campos `referencia` (folha/holerite/mensalidade) no formato `YYYY-MM`.
- **Valores monetários**: `Decimal` do Prisma, serializados como string ou number conforme o serializer padrão do Nest (ex.: `"150.00"`).
- **Exclusões**: quando marcado como "soft", o registro não é removido fisicamente (retenção conforme LGPD), apenas inativado/arquivado.

---

## 🔐 Autenticação (`/auth`)

| Método | Rota | Auth | Entrada (Body) | Saída |
|---|---|---|---|---|
| POST | `/auth/login` | Público (rate limit 10/15min) | `{ cpf: string, senha: string }` | `201 { token: string, usuario: Usuario (sem senha, com temSenha: boolean) }` |
| POST | `/auth/registrar` | Público (rate limit 10/15min) | `{ nome, cpf, email, telefone, senha, aceitouTermos: boolean }` | `201 { token, usuario }` — cria conta com `role: funcionario` |
| POST | `/auth/google` | Público | `{ credential: string }` (ID token do Google) | `201 { token, usuario }` — cria conta se e-mail novo |
| POST | `/auth/reset/solicitar` | Público (rate limit 10/15min) | `{ email: string }` | `201 { }` — envia código de 6 dígitos por e-mail (expira em 15 min) |
| POST | `/auth/reset/confirmar` | Público (rate limit 10/15min) | `{ email, codigo, novaSenha }` | `201 { }` |

---

## 👤 Usuários / Funcionários (`/usuarios`)

Entidade **Usuario**: `id, nome, cpf?, email, senha?, telefone?, endereco?, dataNascimento?, avatar?, role, ativo, aceitouTermos, provedor(local|google), senhaTemporaria, senhaAlteradaEm?, criadoEm`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/usuarios` | Autenticado + papéis `admin, rh, gestor` | — | `200 Usuario[]` (sem senha) |
| GET | `/usuarios/verificar-cpf` | Autenticado + Admin | query `cpf: string, excluirId?: string` | `200 { duplicado: boolean }` |
| GET | `/usuarios/:id` | Autenticado + Admin | — | `200 Usuario` |
| POST | `/usuarios` | Autenticado + Admin | `{ nome, email, senha, cpf?, telefone?, endereco?, dataNascimento?, role? }` | `201 Usuario` |
| PATCH | `/usuarios/:id` | Autenticado (próprio usuário ou admin, validado no service) | `{ nome?, cpf?, email?, telefone?, endereco?, dataNascimento?, avatar?, senha?, senhaAtual?, role?, ativo? }` (todos opcionais) | `200 Usuario` |

---

## 🚙 Mensalistas (`/mensalistas`)

Entidade **Mensalista**: `id, nome, cpf, placa, telefone, email?, valorMensalidade(Decimal), categoriaPlano(string, default "Mensal Integral"), ativo(bool), criadoEm`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/mensalistas` | Autenticado + perfil completo | — | `200 Mensalista[]` |
| GET | `/mensalistas/verificar-cpf` | idem | query `cpf, excluirId?` | `200 { duplicado: boolean }` |
| GET | `/mensalistas/:id` | idem | — | `200 Mensalista` |
| POST | `/mensalistas` | idem | `{ nome, cpf, placa, telefone, valorMensalidade?, email?, categoriaPlano?, ativo? }` | `201 Mensalista` |
| PATCH | `/mensalistas/:id` | idem | `{ nome?, cpf?, placa?, telefone?, valorMensalidade?, email?, categoriaPlano?, ativo? }` (todos opcionais; `telefone` e `categoriaPlano` não podem ser enviados vazios) | `200 Mensalista` |
| DELETE | `/mensalistas/:id` | idem | — | `204` — exclusão **soft** (inativa o cadastro, não apaga) |

---

## 💳 Mensalidades (`/mensalidades`)

Entidade **Mensalidade**: `id, mensalistaId, referencia(YYYY-MM), dataInicio, dataFim, diasCobrados, diasNoMes, valor(Decimal), status(pendente|paga|cancelada), formaPagamento?, motivoCancelamento?, alteradoPorId?, alteradoEm?, comprovanteAnexo?, comprovanteNomeArquivo?, criadoEm`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/mensalidades/kpis` | Autenticado + papéis `admin, financeiro` | — | `200 { referencia, mrr, recebidoNoMes, recebidoNoMesQtd, ticketMedio, mensalistasAtivosQtd, semCicloAtivo, semCicloLista: Mensalista[] }` |
| GET | `/mensalidades` | Autenticado + perfil completo (sem `mensalistaId`, exige papel `admin`/`financeiro`) | query `mensalistaId?: string` | `200 Mensalidade[]` |
| PATCH | `/mensalidades/:id` | idem | `{ status: pendente\|paga\|cancelada, formaPagamento?, motivoCancelamento? (obrigatório se status=cancelada), comprovanteAnexo?, comprovanteNomeArquivo? }` | `200 Mensalidade` |
| POST | `/mensalidades/:id/lembrete` | idem | — | `201 { enviado: true }` — `400` se mensalista não tiver e-mail |

---

## 🎫 Tickets (`/tickets`)

Entidade **Ticket**: `id, placa, status(aberto|fechado), dataEntrada, dataSaida?, valorTotal?(Decimal), formaPagamento?, vagaId, tarifaId?, mensalistaId?, atendidoPorId?`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/tickets` | Autenticado + perfil completo | query `page?, pageSize?, status?, termo?` (sem `page`, retorna lista completa) | `200 Ticket[]` ou `{ dados: Ticket[], total, page, pageSize }` quando paginado |
| POST | `/tickets` | idem | `{ placa, vagaId, tarifaId?: string\|null, mensalistaId?: string\|null }` | `201 Ticket` |
| POST | `/tickets/:id/fechar` | idem | `{ formaPagamento?: string\|null }` | `201 Ticket` (com `valorTotal` calculado no servidor) |
| POST | `/tickets/:id/comprovante-email` | idem | — | `201 { enviado: true }` |
| DELETE | `/tickets/:id` | idem | — | `204` |

---

## 🅿️ Vagas (`/vagas`)

Entidade **Vaga**: `id, codigo(unique), tipo(comum|coberta|mensalista), status(livre|ocupada|manutencao), acessivel(bool)`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/vagas` | Autenticado + perfil completo | — | `200 Vaga[]` |
| POST | `/vagas` | idem | `{ codigo, tipo?, status?, acessivel? }` | `201 Vaga` |
| PATCH | `/vagas/:id` | idem | `{ codigo?, tipo?, status?, acessivel? }` | `200 Vaga` |
| DELETE | `/vagas/:id` | idem | — | `204` |

---

## 💲 Tarifas (`/tarifas`)

Entidade **Tarifa**: `id, categoria, valorHora(Decimal)`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/tarifas` | Autenticado + perfil completo | — | `200 Tarifa[]` |
| POST | `/tarifas` | idem | `{ categoria, valorHora }` (aceita alias `valor`) | `201 Tarifa` |
| PATCH | `/tarifas/:id` | idem | `{ categoria?, valorHora? }` | `200 Tarifa` |
| DELETE | `/tarifas/:id` | idem | — | `204` |

---

## 💰 Caixa Diário (`/caixa`)

Entidade **CaixaDiario**: `id, data(unique), valorAbertura, abertoPorId, abertoEm, valorFechamento?, valorEsperadoFechamento?, diferenca?, fechadoPorId?, fechadoEm?, observacoesFechamento?, status`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/caixa/hoje` | Autenticado + perfil completo | — | `200 CaixaDiario \| null` |
| POST | `/caixa/abrir` | idem | `{ valorAbertura: number }` | `201 CaixaDiario` |
| POST | `/caixa/:id/fechar` | idem | `{ valorFechamento: number, observacoes? }` | `201 CaixaDiario` (calcula `diferenca` no servidor) |

*(Não há rotas de edição/exclusão — o caixa é criado uma vez por dia e fechado uma única vez.)*

---

## 📊 Métricas (`/metricas`)

Somente leitura, sem entidade própria — agrega dados de Tickets, Mensalidades e Caixa.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/metricas` | Autenticado + perfil completo + papéis `admin, financeiro` | query `periodo?: 7_dias\|30_dias\|mes_atual\|todos` | `200 { periodo, kpis: {...}, graficos: {...} }` |

---

## 📈 Dashboard (`/dashboard`)

Somente leitura, aberto a qualquer usuário autenticado.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/dashboard/kpis` | Autenticado + perfil completo | query `tipo?` (filtro por tipo de vaga) | `200 { ocupacao, receitaHoje, ticketsAbertos, ... }` |
| GET | `/dashboard/ranking-vagas` | idem | — | `200 [{ id, codigo, tipo, totalUso, posicao }]` |

---

## 📡 Analytics (`/analytics`)

Entidade **EventoUso**: `id, tipo, tela, duracaoMs?, criadoEm` (anônimo, sem vínculo de usuário).

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| POST | `/analytics/eventos` | Público (rate limit 30/60s) | `{ eventos: [{ tipo: 'visualizacao'\|'tempo-na-tela', tela, duracaoMs?, quando }] }` (máx. 50 itens) | `204` |

---

## 🕵️ Auditoria (`/auditoria`)

Entidade **LogAuditoria**: `id, usuarioId, papel, acao, entidade, entidadeId, dadosAntes?(json), dadosDepois?(json), criadoEm`. Somente leitura — os registros são criados automaticamente pelo sistema.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/auditoria` | Autenticado + papéis `admin, rh` | query `entidade?, entidadeId?, usuarioId?` | `200 LogAuditoria[]` |

---

## 🧑‍💼 Perfil RH (`/rh-perfil`)

Entidade **PerfilRH**: `id, usuarioId, cargo, salarioBase(Decimal), tipoContrato(clt|pj), dataAdmissao, dataDemissao?, diasEscala(int[]), horasPorDia, horaInicioEscala, bancoNome, agencia, contaBancaria, direitos?, deveres?, tarefas?, tipoValeTransporte, bonusDesempenho?, observacoesBeneficios?, vagaOrigem?, gestorId?, etapaCarreiraAtualId?, criadoEm, atualizadoEm`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/rh-perfil/me` | Autenticado + perfil completo | — | `200 PerfilRH` (próprio) |
| GET | `/rh-perfil/organograma` | idem | — | `200` árvore do organograma (nome/cargo) |
| GET | `/rh-perfil/cargos` | idem + papéis `admin, rh` | — | `200 string[]` (lista de cargos distintos) |
| GET | `/rh-perfil/:usuarioId` | idem | — | `200 PerfilRH` |
| PATCH | `/rh-perfil/:usuarioId` | idem + papéis `admin, rh` | `{ cargo, salarioBase, tipoContrato?, dataAdmissao, dataDemissao?, diasEscala, horasPorDia?, horaInicioEscala?, bancoNome, agencia, contaBancaria, direitos?, deveres?, tarefas?, tipoValeTransporte?, bonusDesempenho?, observacoesBeneficios?, etapaCarreiraAtualId?, vagaOrigem?, gestorId? }` (upsert completo) | `200 PerfilRH` |

---

## ✍️ Assinatura Eletrônica (`/assinatura-eletronica`)

Entidade **AssinaturaEletronica**: `id, usuarioId(unique), imagemDataUri, criadoEm`. Sempre relativa ao próprio usuário logado; sem edição após criada.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/assinatura-eletronica/me` | Autenticado + perfil completo | — | `200 AssinaturaEletronica \| null` |
| POST | `/assinatura-eletronica/me` | idem | `{ imagemDataUri: string }` | `201 AssinaturaEletronica` |

---

## ⏱️ Ponto (`/ponto`)

Entidade **RegistroPonto**: `id, usuarioId, data(unique por usuário), horaEntrada?, horaSaida?, criadoEm`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| POST | `/ponto/entrada` | Autenticado + perfil completo | — | `201 RegistroPonto` |
| POST | `/ponto/saida` | idem | — | `201 RegistroPonto` |
| GET | `/ponto` | idem | query `usuarioId?, referencia?` | `200 RegistroPonto[]` |
| GET | `/ponto/resumo` | idem | query `referencia (obrigatório), usuarioId?` | `200 { horasNormais, horasExtras, horasForaEscala, faltas, ... }` |

---

## 📄 Justificativas de Ponto (`/ponto/justificativas`)

Entidade **JustificativaPonto**: `id, usuarioId, data(unique por usuário), tipo(atestado|abono|folga), descricao?, criadoPorId, criadoEm`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| POST | `/ponto/justificativas` | Autenticado + perfil completo + papéis `admin, rh` | `{ usuarioId, data(YYYY-MM-DD), tipo: atestado\|abono\|folga, descricao? }` | `201 JustificativaPonto` |
| GET | `/ponto/justificativas` | Autenticado + perfil completo | query `usuarioId?` | `200 JustificativaPonto[]` |

---

## 🕐 Trabalho Extra (`/ponto/trabalho-extra`)

Entidade **SolicitacaoTrabalhoExtra**: `id, usuarioId, data(unique por usuário), motivo, status(pendente|aprovada|rejeitada), aprovadoPorId?, aprovadoEm?, criadoEm`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| POST | `/ponto/trabalho-extra` | Autenticado + perfil completo | `{ data, motivo }` | `201 SolicitacaoTrabalhoExtra` |
| GET | `/ponto/trabalho-extra` | idem | query `usuarioId?` | `200 SolicitacaoTrabalhoExtra[]` |
| PATCH | `/ponto/trabalho-extra/:id` | idem + papéis `admin, rh` | `{ status: aprovada\|rejeitada }` | `200 SolicitacaoTrabalhoExtra` |

---

## 🏖️ Férias (`/ferias`)

Entidade **SolicitacaoFerias**: `id, usuarioId, dataInicio, dataFim, dias, status(pendente|aprovada|rejeitada), decididoPorId?, decididoEm?, criadoEm`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| POST | `/ferias` | Autenticado + perfil completo | `{ dataInicio, dataFim }` | `201 SolicitacaoFerias` |
| GET | `/ferias` | idem | query `usuarioId?` | `200 SolicitacaoFerias[]` |
| PATCH | `/ferias/:id` | idem + papéis `admin, rh` | `{ status: aprovada\|rejeitada }` | `200 SolicitacaoFerias` |
| PATCH | `/ferias/:id/datas` | idem + papéis `admin, rh` | `{ dataInicio, dataFim }` (edita solicitação ainda pendente) | `200 SolicitacaoFerias` |

---

## 🔔 Notificações (`/notificacoes`)

Entidade **Notificacao**: `id, usuarioId, tipo, titulo, mensagem, folhaPontoId?, holeriteId?, contratoId?, lida(bool), lidaEm?, criadoEm`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/notificacoes` | Autenticado + perfil completo | — (sempre do próprio usuário) | `200 Notificacao[]` |
| PATCH | `/notificacoes/:id/lida` | idem | — | `200 Notificacao` |

---

## 📑 Espelho de Ponto (`/espelho-ponto`)

Entidade **FolhaPontoMensal**: `id, usuarioId, referencia(unique por usuário), horasNormais, horasExtras, horasForaEscala, faltas, status(pendente_assinatura|assinado), geradoPorId, geradoEm, assinadoEm?`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| POST | `/espelho-ponto/gerar` | Autenticado + perfil completo + papéis `admin, rh` | `{ usuarioId, referencia(YYYY-MM) }` | `201 FolhaPontoMensal` |
| GET | `/espelho-ponto` | Autenticado + perfil completo | query `usuarioId?` | `200 FolhaPontoMensal[]` |
| POST | `/espelho-ponto/:id/assinar` | idem | — | `201 FolhaPontoMensal` (assinado com a `AssinaturaEletronica` do próprio usuário) |
| GET | `/espelho-ponto/:id/pdf` | idem | — | `200` stream `application/pdf` |

---

## 📝 Contrato de Trabalho (`/contrato-trabalho`)

Entidade **ContratoTrabalho**: `id, usuarioId, numeroVersao(unique por usuário), cargo, tipoContrato, dataAdmissao, diasEscala, horasPorDia, horaInicioEscala, salarioBase, tipoValeTransporte, bonusDesempenho?, observacoesBeneficios?, direitos?, deveres?, tarefas?, nomeGestorNoMomento?, cargoGestorNoMomento?, status(pendente_assinatura|assinado), geradoPorId, geradoEm, assinadoEm?`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| POST | `/contrato-trabalho/gerar` | Autenticado + perfil completo + papéis `admin, rh` | `{ usuarioId }` (fotografa o PerfilRH atual) | `201 ContratoTrabalho` |
| GET | `/contrato-trabalho` | Autenticado + perfil completo | query `usuarioId?` | `200 ContratoTrabalho[]` |
| POST | `/contrato-trabalho/:id/assinar` | idem | — | `201 ContratoTrabalho` |
| GET | `/contrato-trabalho/:id/pdf` | idem | — | `200` stream `application/pdf` |

---

## 💵 Folha de Pagamento (`/folha-pagamento`)

Entidade **Holerite**: `id, usuarioId, referencia(unique por usuário), salarioProporcional, valorHorasExtras, valorHorasForaEscala, valorVr, valorVa, inss, irrf, salarioLiquido, status(gerado|assinado|pago), geradoPorId, geradoEm, assinadoEm?, pagoEm?`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| POST | `/folha-pagamento/gerar` | Autenticado + perfil completo + papéis `admin, rh` | `{ usuarioId, referencia(YYYY-MM) }` | `201 Holerite` |
| GET | `/folha-pagamento` | Autenticado + perfil completo | query `usuarioId?` | `200 Holerite[]` |
| POST | `/folha-pagamento/:id/assinar` | idem | — | `201 Holerite` |
| POST | `/folha-pagamento/:id/pagar` | idem + papéis `admin, rh` | — (exige assinatura prévia; não repete) | `201 Holerite` |
| GET | `/folha-pagamento/:id/pdf` | idem | — | `200` stream `application/pdf` |

---

## 🏆 Desempenho (`/desempenho`)

Somente leitura — agrega atendimentos de Tickets por funcionário.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/desempenho` | Autenticado + papéis `admin, rh, gestor` | query `referencia?(YYYY-MM)` | `200 [{ usuarioId, nome, totalAtendimentos }]` |

---

## 🪜 Etapas de Carreira (`/etapas-carreira`)

Entidade **EtapaCarreira**: `id, ordem(unique), titulo, faixaSalarial?, descricao, criadoEm, atualizadoEm`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/etapas-carreira` | Autenticado + perfil completo | — | `200 EtapaCarreira[]` |
| POST | `/etapas-carreira` | idem + papéis `admin, rh` | `{ ordem, titulo, faixaSalarial?, descricao }` | `201 EtapaCarreira` |
| PATCH | `/etapas-carreira/:id` | idem + papéis `admin, rh` | `{ ordem?, titulo?, faixaSalarial?, descricao? }` | `200 EtapaCarreira` |
| DELETE | `/etapas-carreira/:id` | idem + papéis `admin, rh` | — | `204` |

---

## 🎯 PDI — Plano de Desenvolvimento Individual (`/pdi`)

Entidade **ItemPdi**: `id, usuarioId, ordem(unique por usuário), titulo, descricao?, status(pendente|concluido), concluidoEm?, criadoPorId, criadoEm, atualizadoEm`.

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/pdi/me` | Autenticado + perfil completo | — | `200 ItemPdi[]` (próprios) |
| GET | `/pdi/:usuarioId` | idem | — | `200 ItemPdi[]` |
| POST | `/pdi/:usuarioId` | idem + papéis `admin, rh` | `{ titulo, descricao? }` | `201 ItemPdi` |
| PATCH | `/pdi/item/:itemId` | idem + papéis `admin, rh` | `{ titulo?, descricao? }` | `200 ItemPdi` |
| PATCH | `/pdi/item/:itemId/concluir` | idem + papéis `admin, rh` | — | `200 ItemPdi` |
| PATCH | `/pdi/item/:itemId/reabrir` | idem + papéis `admin, rh` | — | `200 ItemPdi` |
| PATCH | `/pdi/item/:itemId/mover` | idem + papéis `admin, rh` | `{ direcao: cima\|baixo }` | `200 ItemPdi[]` (lista reordenada) |
| DELETE | `/pdi/item/:itemId` | idem + papéis `admin, rh` | — | `204` |

---

## 🩺 Rotas utilitárias (`/health`, `/config`)

| Método | Rota | Auth | Entrada | Saída |
|---|---|---|---|---|
| GET | `/health` | Público | — | `200 { ok: true }` |
| GET | `/config` | Público | — | `200 { toleranciaMinutos, duracaoCicloMensalistaDias, adicionalVagaCobertaValor }` |
