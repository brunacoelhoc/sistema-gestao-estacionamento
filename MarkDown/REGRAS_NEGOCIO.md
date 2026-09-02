# 📏 Regras de Negócio e Validações

Mapeamento das regras de negócio, validações de entrada e máquinas de estado implementadas no back-end (NestJS + Prisma), com referências a arquivo/linha. Complementa o [README.md](./README.md) (visão geral) e o [MAPEAMENTO_ROTAS.md](./MAPEAMENTO_ROTAS.md) (contrato de rotas).

> ⚠️ Ao longo do documento, blocos "⚠️ Divergência" apontam pontos em que o comportamento real do código difere do que está descrito no README atual — o comportamento aqui documentado é o que **realmente roda em produção**.

## 📌 Índice

- [Regras globais](#-regras-globais)
- [Autenticação](#-autenticação)
- [Usuários / Funcionários](#-usuários--funcionários)
- [Mensalistas](#-mensalistas)
- [Mensalidades e Ciclo de Cobrança](#-mensalidades-e-ciclo-de-cobrança)
- [Tickets e Cobrança Avulsa](#-tickets-e-cobrança-avulsa)
- [Vagas e Tarifas](#-vagas-e-tarifas)
- [Caixa Diário](#-caixa-diário)
- [Métricas, Dashboard, Desempenho, Analytics, Auditoria](#-métricas-dashboard-desempenho-analytics-auditoria)
- [Perfil RH](#-perfil-rh)
- [Assinatura Eletrônica](#-assinatura-eletrônica)
- [Ponto, Justificativas e Trabalho Extra](#-ponto-justificativas-e-trabalho-extra)
- [Férias](#-férias)
- [Notificações](#-notificações)
- [Espelho de Ponto](#-espelho-de-ponto)
- [Contrato de Trabalho](#-contrato-de-trabalho)
- [Folha de Pagamento / Holerite](#-folha-de-pagamento--holerite)
- [Etapas de Carreira](#-etapas-de-carreira)
- [PDI](#-pdi)
- [Divergências conhecidas com o README](#-divergências-conhecidas-com-o-readme)

---

## 🌐 Regras globais

- **Validação de entrada**: `ValidationPipe` global com `whitelist: true` e `forbidNonWhitelisted: true` (`src/main.ts:62-67`) — qualquer campo enviado que não esteja declarado no DTO gera `400`. Somente a **primeira** mensagem de erro é retornada ao cliente (`src/common/validation-exception-factory.ts:7-23`).
- **Formato de erro**: todo erro é normalizado para `{ erro: string, ...extra }` (`src/common/filters/http-exception.filter.ts`). 404 genérico do Nest vira `{ erro: 'Rota não encontrada.' }`. Erros não tratados nunca vazam detalhes internos ao cliente.
- **Limite de payload**: `6mb` (`src/main.ts:42`), necessário para aceitar imagens/comprovantes em base64 (avatar, assinatura, comprovante de pagamento).
- **CORS**: sem `CORS_ORIGIN` definida, em produção o acesso cross-origin é **bloqueado** (não liberado).
- **Boot fail-fast**: a aplicação recusa subir se `JWT_SECRET` ou `DATABASE_URL` não estiverem configuradas.
- **Visibilidade de dados de RH** — regra central única (`src/common/utils/papel.util.ts:8-10`): `ehGestaoDeRh(role) = role === 'admin' || role === 'rh'`. Esta função decide, em todos os módulos de RH (ponto, férias, perfil, folha, contrato, espelho, PDI), quem pode ver dados de terceiros. **`gestor` está deliberadamente excluído** — só enxerga organograma e desempenho, nunca salário/ponto/férias de outra pessoa.
- **Mascaramento de CPF**: usuários e mensalistas têm o CPF mascarado (`***.***.**XX-XX`) para quem não é admin, tanto em listagem quanto (no caso de mensalistas) em busca por id.
- **Validadores customizados reutilizáveis** (`src/common/*.decorator.ts`):
  - `@IsCpfValido()` — formato `000.000.000-00` (regex), **sem cálculo de dígito verificador**.
  - `@IsPlacaValida()` — formato antigo (`ABC1234`) ou Mercosul (`ABC1D23`), maiúsculas obrigatórias.
  - `@IsSenhaForte()` — mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número, 1 símbolo; máximo 72 (limite do bcrypt).
  - `@IsDiasEscalaValidos()` — array com exatamente 4 inteiros únicos entre 0 e 6 (0=domingo … 6=sábado).
- **Erros de FK do Prisma**: violações de restrição (P2003, ou os códigos `23001`/`23503` do driver adapter Postgres) são tratadas explicitamente antes de deletar registros com histórico vinculado (ver seções de Mensalistas, Vagas, Tarifas, Etapas de Carreira).

---

## 🔐 Autenticação

- Login é feito por **CPF**, não por e-mail. Mitigação de timing-attack: o `bcrypt.compare` sempre roda (contra um hash "fantasma") mesmo se o usuário não existir, para não vazar por tempo de resposta se o CPF existe.
- CPF/senha inválidos → `401 'CPF ou senha inválidos.'` (mensagem genérica, não distingue CPF inexistente de senha errada).
- Conta inativa → `403 'Este usuário está inativo. Fale com um administrador do sistema.'` (login local e Google).
- **Registro público**: sempre cria `role: 'funcionario'` — não é possível se autocadastrar como admin/rh/gestor. `aceitouTermos` deve ser literalmente `true` (`@Equals(true)`). CPF ou e-mail duplicado → `409 Conflict` com mensagens específicas por campo.
- **Google OAuth**: o token é validado no servidor (assinatura verificada), nunca confia no payload decodificado no cliente. Sem `GOOGLE_CLIENT_ID` configurada → `503 Service Unavailable`.
- **Recuperação de senha**: código de 6 dígitos, válido por **15 minutos**, armazenado apenas como hash SHA-256 (nunca em texto puro), uso único. Ao solicitar um novo código, códigos anteriores não usados são invalidados. Contas Google não têm senha para redefinir. Mensagem de código inválido/expirado é **idêntica** independente do motivo (evita vazar qual etapa falhou).

---

## 👤 Usuários / Funcionários

- Papéis normalizados no service: `admin | rh | gestor | funcionario` — o service tem uma allowlist própria (`PAPEIS_VALIDOS`) separada da validação do DTO (que também aceita `financeiro`). Um valor de role que passe pelo DTO mas não esteja nessa lista é rebaixado para `funcionario` (defesa em profundidade).
- **Autoedição ou admin**: `PATCH /usuarios/:id` só é permitido se o solicitante é o próprio usuário ou tem `role === 'admin'`, senão `403 'Você só pode editar o seu próprio perfil.'`.
- **Troca de senha**: se `senhaAtual` for enviada, precisa bater com o hash atual (`400 'Senha atual incorreta.'`). Autoalteração marca `senhaTemporaria: false`; reset feito por admin em nome de outro usuário marca `senhaTemporaria: true` (força o usuário a trocar no próximo login).
- Somente admin pode alterar os campos `role` e `ativo` de qualquer conta — se um não-admin enviar esses campos, eles são **silenciosamente ignorados** (não gera erro).
- Ao editar o próprio cadastro, um novo JWT é emitido na resposta (necessário porque o token carrega `cpfPendente`, que muda quando o CPF é preenchido).
- CPF/e-mail duplicado → `409 Conflict`.

---

## 🚙 Mensalistas

- CPF e placa são únicos (`@unique` no schema); violação → `409` com mensagem específica de qual campo colidiu.
- **Campos restritos a admin dentro do service** (defesa além do DTO): `cpf` e `valorMensalidade` só são aplicados em um `PATCH` se `solicitante.role === 'admin'` — enviados por outro papel, são ignorados silenciosamente.
- CPF mascarado para não-admins tanto na listagem quanto na busca por id.
- `telefone` e `categoriaPlano`: se enviados vazios, geram erro de validação; se **omitidos**, o valor atual é preservado (não são apagados por omissão). `email` enviado como string vazia é interpretado como "limpar o campo" (vira `null`); `email` omitido não altera nada.
- **Exclusão (`DELETE`)**: tentativa de exclusão física real. Se o mensalista já tiver histórico de mensalidades, a FK bloqueia e a API responde `409 'Este mensalista tem histórico de cobranças e não pode ser excluído. Use "Inativar" em vez disso.'` — **um mensalista sem nenhuma cobrança gerada pode, sim, ser excluído fisicamente**. (Ver [divergência](#-divergências-conhecidas-com-o-readme).)

---

## 💳 Mensalidades e Ciclo de Cobrança

- **Como um ciclo nasce**: não existe abertura automática de ciclo no cadastro/reativação do mensalista. Um ciclo (registro `Mensalidade`) só é criado no momento em que um **ticket do mensalista é fechado** e não há ciclo vigente cobrindo a data de entrada daquele ticket.
- **Duração fixa**: todo ciclo dura exatamente **30 dias corridos** a partir da data de abertura (`DURACAO_CICLO_DIAS = 30`) — não há rateio proporcional a dias do mês; `diasCobrados` e `diasNoMes` são sempre gravados como `30`. O valor cobrado é sempre o `valorMensalidade` cheio do mensalista.
- Um novo ciclo já nasce com `status: 'paga'` — não existe estado intermediário "pendente" na criação; o "pagamento" corresponde ao fechamento do ticket que disparou a cobrança.
- **Isenção**: se o mensalista está `ativo` e possui ciclo vigente cobrindo a data de entrada do ticket, o ticket fecha com `valorTotal = 0` e `formaPagamento = 'isento'`.
- **Atualização de status** (`PATCH /mensalidades/:id`): `status` deve ser `pendente | paga | cancelada`; `formaPagamento` restrito a `pix | cartao_credito | cartao_debito | dinheiro`. `motivoCancelamento` é **obrigatório quando `status = cancelada`** (`400 'Informe o motivo do cancelamento.'`) e é **forçado para `null`** no service sempre que o status enviado não é `cancelada` (mesmo que o cliente tente reenviar um motivo antigo).
- `comprovanteAnexo`: aceita apenas `image/png`, `image/jpeg`, `image/jpg`, `image/webp` ou `application/pdf` em base64 (**SVG é explicitamente proibido**, por risco de XSS), limite de 6.000.000 caracteres.
- **Acesso**: `GET /mensalidades` sem o parâmetro `mensalistaId` exige papel `admin` ou `financeiro` (checagem feita no controller, não em um guard, pois a mesma rota é usada sem restrição quando `mensalistaId` está presente — ex.: tela de Tickets consultando o ciclo, modal de histórico do mensalista).
- **Lembrete por e-mail**: `404` se a cobrança não existe; `400 'Este mensalista não tem e-mail cadastrado.'` se não houver e-mail.
- **KPIs** (`GET /mensalidades/kpis`): MRR = soma de `valorMensalidade` de todos os mensalistas `ativo` (projeção, não valor efetivamente recebido); "recebido no mês" = soma de mensalidades com `status = paga` e `referencia` igual ao mês atual; "sem ciclo ativo" = mensalista ativo sem nenhuma mensalidade `paga` com `dataFim >= hoje`.

---

## 🎫 Tickets e Cobrança Avulsa

- **Constantes de cobrança** (também expostas em `GET /config`): tolerância de **15 minutos** sem cobrança (`TEMPO_TOLERANCIA_MINUTOS`); tarifa padrão de **R$ 10/hora** se a vaga não tiver tarifa vinculada; adicional de **R$ 3/hora** para vaga do tipo `coberta` (somado ao valor da tarifa, independente da categoria).
- **Cálculo**: horas pagas = `max(1, ceil(minutos / 60))` — arredondamento **para cima**, mínimo de 1 hora após o período de tolerância. `valorTotal = horasPagas * (valorHora + adicionalCoberta)`.
- **Abertura de ticket** (tudo em uma transação):
  1. Exige o caixa do dia **aberto** — senão `409 { erro: 'O caixa do dia ainda não foi aberto...', codigo: 'CAIXA_FECHADO' }`.
  2. Vaga deve existir e estar `livre` — senão `409 'A vaga selecionada não está livre ou é inválida.'`.
  3. **Uma placa não pode ter dois tickets abertos simultaneamente** → `409 'A placa {placa} já possui um ticket aberto.'`.
  4. Se `mensalistaId` não for enviado explicitamente, o sistema tenta resolver automaticamente um mensalista ativo pela placa.
  5. A vaga muda para `ocupada` na mesma transação.
- **Fechamento**: ticket precisa existir e estar `aberto` (`409 'Ticket inválido ou já finalizado.'`). Todo o cálculo de valor acontece no servidor — o front nunca envia nem decide o preço. A vaga volta para `livre`.
- **Exclusão**: exclusão física direta, sem bloqueio mesmo para tickets já fechados com histórico (nada referencia `Ticket` por FK obrigatória).
- **Comprovante por e-mail**: só disponível para tickets `fechado` vinculados a um mensalista com e-mail cadastrado.

---

## 🅿️ Vagas e Tarifas

- **Vaga**: exclusão bloqueada por FK se houver qualquer ticket vinculado (mesmo já fechado) → `409 'Esta vaga tem tickets vinculados (mesmo já fechados) e não pode ser excluída. Marque como "Manutenção" em vez disso.'`. `codigo` é normalizado para maiúsculas; `tipo`/`status` normalizados para minúsculas antes de validar contra os enums.
- **Tarifa**: exclusão bloqueada **preventivamente** (checagem explícita, não depende do `SET NULL` do banco) se qualquer **ticket aberto** referenciar a tarifa → `409 'Esta tarifa está vinculada a um ticket em aberto e não pode ser excluída até ele ser fechado.'`. Motivo: se um ticket aberto perdesse a tarifa, o fechamento cairia silenciosamente na "primeira tarifa da tabela", cobrando valor diferente do exibido na entrada. Aceita o alias `valor` como sinônimo de `valorHora` na entrada.

---

## 💰 Caixa Diário

- Um caixa por dia (`data` é única). `POST /caixa/abrir` com um caixa já existente para hoje → `409 'O caixa de hoje já foi aberto.'`.
- `POST /caixa/:id/fechar`: `404` se não existir; `409 'Este caixa já foi fechado.'` se `status !== 'aberto'`.
- `valorEsperadoFechamento` é **sempre recalculado no momento do fechamento** somando `valorAbertura` + todos os tickets fechados no dia com `formaPagamento = 'dinheiro'` — nunca é acumulado incrementalmente, evitando divergência se um ticket for editado/removido depois de aberto.
- `diferenca = valorFechamento - valorEsperadoFechamento` (positivo = sobra, negativo = falta). Apenas pagamentos em dinheiro afetam o valor físico do caixa — PIX e cartão nunca entram nessa conta.
- **Nenhum ticket pode ser aberto sem o caixa do dia estar aberto** — regra aplicada tanto para tickets avulsos quanto para mensalistas.

---

## 📊 Métricas, Dashboard, Desempenho, Analytics, Auditoria

- **Métricas**: filtro de período `7_dias | 30_dias | mes_atual | todos`; valor não reconhecido cai em "sem filtro". ⚠️ Ao calcular receita do período, **soma mensalidades de qualquer status** (pendente, paga e cancelada), diferente do KPI de Mensalidades (que só soma `status = paga`) — os dois números de "receita" podem legitimamente divergir.
- **Dashboard**: ocupação/faturamento/ticket médio/tempo médio são calculados sobre **todo o histórico** de tickets (não respeitam período), exceto quando filtrados por `tipo` de vaga.
- **Desempenho**: "atendimento" = ticket **fechado** pelo funcionário (`atendidoPorId`); filtro opcional por `referencia` (YYYY-MM) usa a data de saída.
- **Analytics**: lote de no máximo 50 eventos por chamada; `tipo` restrito a `visualizacao | tempo-na-tela`; nenhum vínculo com usuário é armazenado (anonimato por design, conforme LGPD).
- **Auditoria**: somente leitura via API — os registros são criados internamente pelos próprios services de RH (perfil, trabalho extra, justificativas, férias, espelho de ponto, contrato, holerite, etapas de carreira, PDI). Uma falha ao gravar o log de auditoria **nunca** bloqueia a operação de negócio em si. O papel do usuário é gravado **no momento da ação** (não é lido "ao vivo" depois, já que o papel pode mudar).

---

## 🧑‍💼 Perfil RH

- Visualização de perfil de terceiros restrita a `ehGestaoDeRh` (admin/rh) ou ao próprio dono — senão `403 'Você só pode ver o seu próprio perfil de RH.'`. O organograma é aberto a qualquer usuário autenticado, mas expõe apenas nome/cargo/papel — nunca salário ou dados bancários.
- `PATCH /rh-perfil/:usuarioId` é um **upsert completo** — RH sempre reenvia o perfil inteiro, não há PATCH parcial.
- **Um funcionário não pode ser seu próprio gestor** → `403 'Um funcionário não pode ser o próprio gestor.'`. Gestor inexistente → `404`.
- `diasEscala`: exatamente 4 dias únicos (0–6). `horasPorDia`: entre 1 e 12 (padrão 6). `horaInicioEscala`: formato `HH:mm` 24h (padrão `"08:00"`).
- **Proteção contra ciclos no organograma**: se a cadeia de `gestorId` formar um ciclo, o nó é tratado como raiz em vez de causar loop infinito; `gestorId` órfão (apontando para alguém sem perfil de RH) também vira raiz.
- Toda alteração de perfil gera registro de auditoria.

---

## ✍️ Assinatura Eletrônica

- **Uma assinatura por usuário, para sempre** — não existe endpoint de edição. Uma segunda tentativa de cadastro → `409 'Você já tem uma assinatura eletrônica cadastrada.'`. Aceita apenas `image/png|jpeg|jpg|webp` (sem SVG), limite de 300.000 caracteres em base64.

---

## ⏱️ Ponto, Justificativas e Trabalho Extra

- **Tolerância de atraso: 20 minutos** (`TOLERANCIA_ATRASO_MINUTOS`) — regra diferente e independente da tolerância de 15 minutos usada na cobrança de tickets avulsos; não confundir as duas.
- **Bater ponto exige perfil de RH cadastrado** (`404 'Você ainda não tem um perfil de RH cadastrado. Fale com o RH.'`). Apenas um registro de entrada/saída por dia por usuário. Duplicar entrada → `409 'Você já registrou entrada hoje.'`.
- **Trabalhar fora da escala** exige uma `SolicitacaoTrabalhoExtra` **aprovada** para aquele dia exato — senão `403 'Hoje não é um dia da sua escala. Trabalhar fora da escala exige uma solicitação aprovada previamente.'`. O horário sempre vem do relógio do servidor, nunca do cliente.
- **Registrar saída** exige entrada prévia no dia (`409 'Registre a entrada antes de registrar a saída.'`); duplicar saída → `409 'Você já registrou saída hoje.'`.
- **Cálculo de horas** (mensal, por dia):
  - Dia de escala sem entrada = falta, exceto se coberto por justificativa ou férias aprovada.
  - Entrada sem saída = dia "em aberto", não soma horas até ser fechado.
  - Atraso ≤ 20 min é tolerado (considera o horário de início da escala como início do cálculo); atraso > 20 min usa o horário real de entrada como início (o tempo perdido não é pago, mas também não vira falta).
  - `horasNormais = min(horasTrabalhadas, horasPorDia)`; `horasExtras = max(0, horasTrabalhadas - horasPorDia)` — extras só existem em dias de escala.
  - Em dia fora de escala com trabalho extra aprovado, todas as horas vão para o bucket `horasForaEscala` (não são divididas em normais/extras).
  - Justificativas (atestado/abono/folga) e férias aprovadas sempre contam como dia pago e sem falta.
- **Solicitação de trabalho extra**: não pode ser para um dia que já é da escala normal (`400 'Este já é um dia da sua escala normal — não precisa de autorização.'`); não pode ser para data passada; uma solicitação por dia por usuário → `409 'Você já tem uma solicitação para esta data.'`. Uma vez decidida (aprovada/rejeitada), não pode ser decidida de novo → `409 'Esta solicitação já foi decidida.'`.
- **Justificativas de ponto**: só RH/admin lançam (nunca o próprio funcionário); o funcionário-alvo precisa ter perfil de RH; uma justificativa por dia por usuário → `409 'Já existe uma justificativa lançada para este funcionário nesta data.'`.

---

## 🏖️ Férias

- Antecedência mínima: **90 dias** antes da data de início. Limite anual: **60 dias** por ano-calendário.
- **Validações** (compartilhadas entre solicitar e editar):
  1. Data de fim não pode ser anterior à data de início.
  2. Quantidade de dias = diferença inclusiva entre as datas.
  3. Precisa respeitar os 90 dias de antecedência → `400`.
  4. Limite de 60 dias/ano soma solicitações **pendentes + aprovadas** do mesmo ano (não só as aprovadas) — excedendo, retorna mensagem detalhando uso atual e limite.
  5. Não pode haver sobreposição com outra solicitação (pendente ou aprovada) do próprio usuário no mesmo ano → `409 'Já existe uma solicitação sua (pendente ou aprovada) que se sobrepõe a este período.'`.
- **Editar datas**: só permitido enquanto `status = pendente` → `409 'Só é possível editar uma solicitação ainda pendente.'`; reaplica todas as validações acima, ignorando a própria solicitação no cálculo dos totais.
- **Decidir** (aprovar/rejeitar): só solicitações pendentes podem ser decididas → `409 'Esta solicitação já foi decidida.'`.

---

## 🔔 Notificações

- Não existe endpoint público de criação — notificações só são geradas internamente por outros fluxos de RH (espelho de ponto, contrato, holerite). Marcar como lida uma notificação de outro usuário → `403 'Esta notificação não é sua.'`. Marcar uma notificação já lida como lida de novo é idempotente (não gera erro).

---

## 📑 Espelho de Ponto

- Geração restrita a admin/rh; o funcionário-alvo precisa ter perfil de RH; **só é possível gerar o espelho de um mês já encerrado** → `400 'Só é possível gerar o espelho de um mês já encerrado.'`. Um espelho por usuário/referência → `409 'Já existe um espelho de ponto gerado para este funcionário nesta referência.'`.
- O snapshot é **congelado** no momento da geração — nunca recalculado mesmo que o histórico de ponto mude depois.
- **Assinatura**: só o próprio dono do documento pode assinar (nunca RH/admin em nome dele) → `403 'Você só pode assinar o seu próprio espelho de ponto.'`; documento já assinado → `409`; exige assinatura eletrônica previamente cadastrada → `400 'Cadastre sua assinatura eletrônica antes de assinar documentos.'`.
- **PDF**: só disponível após `status = assinado` → `400 'Este espelho de ponto ainda não foi assinado.'`.

---

## 📝 Contrato de Trabalho

- `numeroVersao` é sequencial por usuário; em caso de concorrência na geração simultânea, o conflito na constraint única vira `409 'Uma nova versão já está sendo gerada para este funcionário. Tente novamente.'`.
- Todos os campos são **cópias congeladas** do Perfil RH no momento da geração (inclusive nome/cargo do gestor à época) — edições posteriores no perfil nunca alteram retroativamente um contrato já gerado.
- Mesmas regras de assinatura (só o dono) e liberação de PDF (só após assinado) do Espelho de Ponto.

---

## 💵 Folha de Pagamento / Holerite

- Mesma regra de "mês precisa estar encerrado" da geração do Espelho de Ponto. Um holerite por usuário/referência.
- **Cálculo**:
  - Vale-refeição: **R$ 45/dia** trabalhado (entrada e saída registradas); vale-alimentação: **R$ 800/mês fixo**, sem rateio.
  - `valorPorDiaEscala = salarioBase / diasEscalaNoMes` (dias de escala reais daquele mês específico); `valorHora = valorPorDiaEscala / horasPorDia`.
  - `salarioProporcional = salarioBase - valorPorDiaEscala * faltas` — só descontam faltas **não justificadas** (justificativas e férias já são excluídas da contagem de faltas antes deste cálculo).
  - Horas extras (dentro da escala): pagas a **100% da hora normal**, sem adicional.
  - Horas fora da escala (trabalho extra aprovado): pagas em **dobro** (100% de adicional).
  - **INSS**: cálculo progressivo por faixa — 7,5% até R$1.412; 9% até R$2.666,68; 12% até R$4.000,03; 14% até R$7.786,02 (teto).
  - **IRRF**: método de alíquota efetiva com parcela a deduzir — isento até R$2.259,20; 7,5% (deduz R$169,44) até R$2.826,65; 15% (deduz R$381,44) até R$3.751,05; 22,5% (deduz R$662,77) até R$4.664,68; 27,5% (deduz R$896,00) acima disso — calculado sobre `baseInss - inss` (o INSS é abatido da base do IRRF primeiro).
  - `salarioLiquido = salarioProporcional + horasExtras + horasForaEscala + VR + VA - INSS - IRRF`. VR, VA e benefícios (convênio, Gympass) são **custeados 100% pela empresa** e nunca descontados do funcionário — só INSS e IRRF são descontos reais.
- **Máquina de estados**: `gerado → assinado → pago`.
  - Assinar: só o dono, exige assinatura eletrônica cadastrada, não pode assinar duas vezes (`409 'Este holerite já foi assinado.'`).
  - Pagar (RH/admin): exige que já esteja assinado (`400 'O holerite precisa estar assinado pelo funcionário antes de ser pago.'`); não pode pagar duas vezes (`409 'Este holerite já foi pago.'`).
  - PDF só disponível após assinado.

---

## 🪜 Etapas de Carreira

- `ordem` é única — duplicada → `409 'Já existe uma etapa cadastrada com essa ordem.'` (na criação e na edição).
- Exclusão bloqueada por FK se algum funcionário estiver com essa etapa atribuída → `409 'Esta etapa está atribuída a um ou mais funcionários e não pode ser removida.'`.
- Toda escrita (criar/editar/remover) gera registro de auditoria.

---

## 🎯 PDI (Plano de Desenvolvimento Individual)

- Visualização: só `ehGestaoDeRh` ou o próprio dono do PDI (`403 'Você só pode ver o seu próprio PDI.'`). **Criação, edição, conclusão, reordenação e remoção são sempre exclusivas de admin/rh** — o funcionário nunca autodeclara progresso no próprio PDI.
- `ordem` é auto-incrementada por usuário. A reordenação (`mover`) usa um valor temporário negativo de `ordem` dentro de uma transação para trocar dois itens de posição sem violar a constraint única — mecanismo interno não-óbvio, mas necessário.
- Toda mutação gera registro de auditoria.

---

## ⚠️ Divergências conhecidas com o README

Estas diferenças foram identificadas comparando o código-fonte real com o texto atual do [README.md](./README.md). Recomenda-se atualizar o README para refletir o comportamento abaixo (o código é a fonte da verdade):

1. **Ciclo de mensalidade não é proporcional aos dias do mês.** O README descreve abertura de ciclo ao cadastrar/reativar um mensalista e rateio ao inativar. Na prática, o ciclo só nasce quando um ticket do mensalista é fechado sem ciclo vigente, e dura sempre **30 dias corridos completos**, cobrando o valor cheio — não existe rateio por dias do mês em nenhum ponto do código.
2. **Exclusão de mensalista não é sempre bloqueada.** O README afirma que mensalistas nunca são excluídos fisicamente. Na prática, a exclusão só é bloqueada quando existe histórico de mensalidades (violação de FK); um mensalista sem nenhuma cobrança gerada pode ser excluído fisicamente.
3. **Duas tolerâncias diferentes, com o mesmo nome genérico de "tolerância".** Tickets avulsos usam 15 minutos de carência antes de cobrar a primeira hora; o ponto dos funcionários usa 20 minutos de tolerância para atraso. São regras de módulos diferentes e não devem ser confundidas.
4. **Dois números de "receita" com filtros diferentes.** A tela de Métricas soma mensalidades de qualquer status no período; o KPI de Mensalidades soma apenas `status = paga`. Os dois valores podem divergir legitimamente e isso não é um bug.
5. **Papel `financeiro` está incompleto na normalização de usuários.** Os DTOs de usuário aceitam `financeiro` como papel válido, mas a lista de normalização interna do `UsuariosService` não o inclui — se esse valor chegasse ao service por outro caminho, seria rebaixado para `funcionario`. Não é um problema no fluxo normal (o DTO já valida), mas é um ponto de atenção para quem for estender os papéis do sistema.
