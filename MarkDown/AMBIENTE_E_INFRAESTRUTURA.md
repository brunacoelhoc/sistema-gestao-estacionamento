# ⚙️ Ambiente, Infraestrutura e Operação

Tudo que é necessário para configurar, rodar, testar e publicar o back-end — sem depender de descobrir por tentativa e erro. Complementa o [README.md](./README.md) (visão geral do produto) com o detalhamento técnico de setup.

## 📌 Índice

- [Stack e versões](#-stack-e-versões)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Scripts do projeto](#-scripts-do-projeto)
- [Rodando localmente do zero](#-rodando-localmente-do-zero)
- [Dados de seed](#-dados-de-seed)
- [Logging e observabilidade](#-logging-e-observabilidade)
- [Segurança de infraestrutura aplicada no boot](#-segurança-de-infraestrutura-aplicada-no-boot)
- [Integração contínua (CI)](#-integração-contínua-ci)
- [Testes](#-testes)
- [Pendência de infraestrutura conhecida](#-pendência-de-infraestrutura-conhecida)

---

## 🧱 Stack e versões

| Camada | Tecnologia | Versão (conforme `package.json`) |
|---|---|---|
| Runtime | Node.js | `>= 18` (CI roda em Node 24) |
| Framework | NestJS | `^11.2.1` (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) |
| Linguagem | TypeScript | `^6.0.3` |
| ORM | Prisma | `^7.9.1` (`@prisma/client` + `@prisma/adapter-pg`) |
| Banco | PostgreSQL | via driver `pg` `^8.23.0` |
| Autenticação | `@nestjs/jwt` `^11.0.2` + `bcryptjs` `^3.0.3` + `google-auth-library` `^11.0.2` |
| Validação | `class-validator` `^0.15.1` + `class-transformer` `^0.5.1` |
| Rate limiting | `@nestjs/throttler` `^6.5.0` |
| Segurança HTTP | `helmet` `^8.3.0` + `cors` `^2.8.6` |
| E-mail | `nodemailer` `^9.0.5` |
| Geração de PDF | `pdfkit` `^0.20.1` |
| Logging | `pino` `^10.3.1` + `pino-http` `^11.0.0` (+ `pino-pretty` em dev) |
| Testes | `jest` `^30.4.2` + `ts-jest` + `@nestjs/testing` |
| Lint | `eslint` `^9.39.5` com `neostandard` |
| Front-end (fora do Nest) | HTML/SCSS/JS puro, compilado via `sass` |

---

## 🔑 Variáveis de ambiente

Arquivo `.env.example` já existe no repositório e deve ser copiado para `.env`. Todas as variáveis:

| Variável | Obrigatória? | Efeito |
|---|---|---|
| `DATABASE_URL` | ✅ **obrigatória** | string de conexão Postgres. Boot falha (`process.exit(1)`) se ausente. |
| `JWT_SECRET` | ✅ **obrigatória** | segredo de assinatura do JWT. Boot falha se ausente — nunca há fallback inseguro. |
| `PORT` | opcional (default `3001`) | porta HTTP da API. |
| `JWT_EXPIRES_IN` | opcional (default `8h`) | validade do token de login. |
| `GOOGLE_CLIENT_ID` | opcional | habilita `POST /auth/google`. Sem ela, a rota responde `503 Service Unavailable`. |
| `CORS_ORIGIN` | opcional | lista de origens permitidas, separadas por vírgula. Sem ela: em dev aceita qualquer origem; em produção (`NODE_ENV=production`) **bloqueia** cross-origin até ser configurada. |
| `POSTGRES_PASSWORD` | opcional | usada apenas por um eventual `docker-compose.yml` local (ver [pendência](#-pendência-de-infraestrutura-conhecida)). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | opcionais (as 3 primeiras juntas) | sem elas, todo envio de e-mail (reset de senha, lembrete de cobrança, comprovante de ticket) responde `503` com mensagem explícita em vez de falhar silenciosamente. `SMTP_PORT` default `587`; porta `465` ativa TLS implícito (`secure: true`). |
| `SMTP_FROM` | opcional | remetente exibido; se vazio, usa `SMTP_USER`. |
| `NODE_ENV` | opcional | `production` ativa o bloqueio de CORS sem origem configurada (ver acima). |

> Para testar envio de e-mail sem um provedor real, uma conta [Ethereal](https://ethereal.email/) funciona como SMTP fake — o serviço de e-mail já loga a URL de preview no console quando detecta uma conta de teste.

---

## 📜 Scripts do projeto

| Script | Comando | Uso |
|---|---|---|
| `npm run api` | `nest start --watch` | sobe só a API em modo watch |
| `npm run sass:watch` | compila SCSS em modo watch | usado durante desenvolvimento do front |
| `npm run dev` | `concurrently` de `api` + `sass:watch` | comando principal para desenvolvimento local |
| `npm run build` | compila SCSS + `nest build` | build de produção |
| `npm start` | `node dist/main.js` | roda o build já compilado |
| `npm run db:seed` | `node prisma/seed.js` | popula o banco (ver seção de seed) |
| `npm run lint` / `lint:fix` | ESLint (`neostandard`) | |
| `npm test` | `jest` | roda a suíte de testes |

---

## 🚀 Rodando localmente do zero

1. `npm install`
2. Copiar `.env.example` para `.env` e preencher ao menos `DATABASE_URL` e `JWT_SECRET`.
3. Ter um PostgreSQL acessível na `DATABASE_URL` configurada (local, container manual, ou um serviço como Neon/Supabase — não há `docker-compose.yml` pronto no repositório, ver pendência abaixo).
4. Rodar as migrations: `npx prisma migrate deploy` (ambiente já com histórico de migrations) ou `npx prisma migrate dev` (para gerar o schema em um banco vazio a partir de `prisma/schema.prisma`).
5. Gerar o client do Prisma se necessário: `npx prisma generate`.
6. (Opcional) `npm run db:seed` para popular dados de exemplo.
7. `npm run dev` (API + SCSS) ou `npm run api` (só a API).
8. API disponível em `http://localhost:3001` (ou a `PORT` configurada); front-end estático servido separadamente (ex.: Live Server) apontando para essa URL.

---

## 🌱 Dados de seed

`prisma/seed.js` (`npm run db:seed`) é **idempotente** (usa `upsert` por id/chave única — pode rodar mais de uma vez sem duplicar) e faz duas coisas:

1. **Importa `prisma/db.json`** (dado legado de uma versão anterior baseada em `json-server`) para as tabelas `vagas`, `tarifas`, `mensalistas`, `usuarios` e `tickets`. Senhas de usuário vêm em texto puro nesse arquivo e são convertidas para hash bcrypt (custo 12) durante a importação. Papéis fora de `admin|rh|gestor` caem para `funcionario`.
2. **Cria dados de demonstração de RH** (não vêm do `db.json`, são fixos no script):
   - `operador.sistema@parkgestao.com.br` — papel `funcionario`, com `PerfilRH` completo (cargo, salário R$2.500, escala segunda–quinta, 6h/dia, dados bancários simulados), 4 etapas de carreira cadastradas e 2 itens de PDI concluídos + 2 pendentes.
   - `rh@parkgestao.com.br` — papel `rh`.
   - `gestor@parkgestao.com.br` — papel `gestor`, definido como gestor do funcionário demo.
   - **Senha de todas as contas demo**: `Demo@123`.

Se `prisma/db.json` não existir/estiver vazio, a primeira parte do seed simplesmente não importa nada (`dados.vagas?.length || 0` etc. tolera arrays ausentes) — o seed de RH sempre roda.

---

## 📈 Logging e observabilidade

- Logger estruturado com **pino**, plugado via `pino-http` em `src/main.ts` como middleware do Express.
- `customProps` inclui `usuarioId` (extraído de `req.usuario`, populado pelo `JwtAuthGuard`) em toda linha de log — permite rastrear todas as requisições de um usuário específico.
- **Serializers customizados** (`src/main.ts:56-58`) reduzem o ruído: log de request só grava `{ method, url }`, log de response só grava `{ statusCode }` — o padrão do `pino-http` (que despejaria todos os headers) é deliberadamente substituído.
- Em desenvolvimento, `pino-pretty` formata o log de forma legível no terminal; em produção, o log sai como JSON estruturado (adequado para agregadores como Datadog/CloudWatch/Loki).
- Erros não tratados são logados com detalhe completo **apenas no servidor** — a resposta ao cliente nunca inclui stack trace (ver `HttpExceptionFilter`).
- Não há um APM/tracing distribuído configurado (New Relic, OpenTelemetry, etc.) — se o colega precisar disso em produção, é uma adição nova, não uma peça já esperada pelo sistema.

---

## 🛡️ Segurança de infraestrutura aplicada no boot

Configurada uma única vez em `src/main.ts`, nesta ordem:

1. `helmet()` — headers de segurança padrão (CSP básica, `X-Content-Type-Options`, etc.).
2. `cors()` — com a lógica de `CORS_ORIGIN` descrita acima.
3. `pinoHttp()` — logging de toda requisição.
4. `ValidationPipe` global — `whitelist + forbidNonWhitelisted + transform`.
5. `HttpExceptionFilter` global — normaliza toda resposta de erro para `{ erro: string }`.
6. `app.enableShutdownHooks()` — permite que o Nest feche conexões (ex.: Prisma) de forma limpa em `SIGTERM`/`SIGINT`, importante para deploys com rolling restart.
7. Limite de body JSON em `6mb` (`app.useBodyParser('json', { limit: '6mb' })`).

---

## 🔄 Integração contínua (CI)

`.github/workflows/ci.yml` — dispara em push para `main` e em qualquer Pull Request:

1. Checkout do código.
2. Setup Node 24 com cache de `npm`.
3. `npm ci` (instalação determinística a partir do lockfile).
4. `npm run lint`.
5. `npm test`.
6. `npm run build` (compila Sass + `nest build`).

Não há, hoje, um step de deploy automatizado nem de `prisma migrate deploy` no pipeline — publicar em produção é um processo manual/fora deste workflow.

---

## 🧪 Testes

- Framework: **Jest** com **ts-jest**, `rootDir: src`, padrão de arquivo `*.spec.ts`.
- Cobertura configurada via `collectCoverageFrom: ["**/*.(t|j)s"]`, saída em `../coverage` (fora de `src/`).
- O projeto original tem testes unitários cobrindo guards (`jwt-auth.guard.spec.ts`, `profile-complete.guard.spec.ts`, `roles.guard.spec.ts`) e outras peças de `src/common/`, além de specs por módulo de negócio.
- Rodar tudo: `npm test`. Rodar um arquivo específico: `npx jest caminho/do/arquivo.spec.ts`.
- Não há suíte de testes E2E/integração contra um banco real configurada neste repositório — os specs existentes são unitários (services/guards isolados, dependências mockadas).

---

## 🚧 Pendência de infraestrutura conhecida

O `.env.example` comenta a variável `POSTGRES_PASSWORD` como "usada só pelo `docker-compose.yml` (serviço `db`)", mas **esse arquivo não existe no repositório**. Ou seja, o projeto documenta a existência de uma forma de subir o Postgres via Docker Compose que nunca foi de fato commitada. Ao recriar o projeto, seu colega deve:

- Criar um `docker-compose.yml` mínimo com um serviço `db` (Postgres) usando `POSTGRES_PASSWORD`, **ou**
- Apontar `DATABASE_URL` para um Postgres já existente (local ou hospedado) e ignorar essa variável.
