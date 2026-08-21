# 🚗 ParkGestão

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white" alt="Node.js >= 18" />
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express 5" />
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white" alt="Prisma 7" />
  <img src="https://img.shields.io/badge/PostgreSQL-database-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/WCAG-2.1%20AAA-7C3AED" alt="WCAG 2.1 AAA" />
  <img src="https://img.shields.io/badge/LGPD-conforme-16A34A" alt="LGPD" />
  <img src="https://img.shields.io/badge/licença-MIT-F59E0B" alt="Licença MIT" />
</p>

<p align="center">
  <strong>Sistema de gestão de estacionamento</strong> — tickets avulsos, mensalistas com cobrança mensal de verdade, vagas, tarifas e métricas — acessível (WCAG 2.1 AAA) e em conformidade com a LGPD. 🅿️✨
</p>

---

## 📌 Índice

- [📖 Sobre o projeto](#-sobre-o-projeto)
- [🛠️ Stack e arquitetura](#️-stack-e-arquitetura)
- [📂 Estrutura do projeto (MVC)](#-estrutura-do-projeto-mvc)
- [🚀 Como rodar](#-como-rodar)
- [💳 Cobrança de mensalistas](#-cobrança-de-mensalistas)
- [🎟️ Regras de tickets avulsos](#️-regras-de-tickets-avulsos)
- [🔐 Autenticação e área administrativa](#-autenticação-e-área-administrativa)
- [♿ Acessibilidade (WCAG 2.1 AAA)](#-acessibilidade-wcag-21-aaa)
- [🛡️ LGPD](#️-lgpd)
- [🔑 Login com Google (opcional)](#-login-com-google-opcional)
- [📧 Recuperação de senha por e-mail](#-recuperação-de-senha-por-e-mail)
- [📐 Padrão de commits](#-padrão-de-commits)
- [👩‍💻 Autora](#-autora)

---

## 📖 Sobre o projeto

O **ParkGestão** cobre o dia a dia de um estacionamento: abrir e fechar tickets avulsos, controlar vagas e tarifas, cadastrar mensalistas (com cobrança mensal de verdade, não por ticket) e acompanhar tudo num painel de métricas.

**🎯 Objetivos principais**
- ⚡ **Eficiência operacional** — entrada, saída e cálculo de valor em poucos cliques.
- ♿ **Inclusão** — interface pensada para pessoas com baixa visão, dislexia ou daltonismo.
- 🔒 **Privacidade** — dados pessoais (CPF, placa) tratados em conformidade com a LGPD.

---

## 🛠️ Stack e arquitetura

| Camada | Tecnologias |
|---|---|
| **Front-end** | HTML5 semântico + SCSS + JavaScript ES6+ nativo (sem framework), Bootstrap 5.3 |
| **Back-end** | Node.js + Express 5, arquitetura MVC (rotas → controllers → services) |
| **Banco de dados** | PostgreSQL via Prisma ORM 7 |
| **Autenticação** | JWT assinado pelo servidor + senha com hash bcrypt + Google Identity Services (opcional) |
| **UI / Feedback** | SweetAlert2 (modais), FontAwesome 6 (ícones), GSAP (animações de entrada) |
| **Gráficos e relatórios** | Chart.js, jsPDF + jspdf-autotable (PDF), SheetJS/xlsx (Excel) |
| **Acessibilidade** | VLibras (tradução em Libras), painel próprio de contraste/dislexia/daltonismo/zoom |

O front-end é uma aplicação **multipágina (MPA)** — cada tela é um `.html` próprio — que fala com a API por `fetch`. Nenhuma regra de negócio (cálculo de tarifa, tolerância, cobrança de mensalista) roda no navegador: tudo é decidido e persistido pelo back-end.

---

## 📂 Estrutura do projeto (MVC)

```text
projeto/
├── index.html                    # Dashboard (entrada do site, fica na raiz)
├── 404.html                      # Página de erro (raiz, padrão de hosts estáticos)
├── views/                        # 🖼️ View — as demais telas
│   ├── tickets.html
│   ├── mensalistas.html
│   ├── vagas-tarifas.html
│   ├── metricas.html
│   ├── funcionarios.html         # Área administrativa (só para "admin")
│   ├── login.html
│   └── sobre.html
├── assets/
│   ├── scss/ + css/style.css     # Estilos (SCSS compilado)
│   ├── img/
│   └── js/
│       ├── main.js               # Bootstrap global (navbar, footer, status da API, VLibras)
│       ├── models/                # 🗄️ Model do front — camada de dados
│       │   └── api.js             #   único ponto de comunicação com a API REST
│       ├── controllers/          # 🎮 Controller de cada tela
│       │   ├── dashboard.js, tickets.js, mensalistas.js, vagas.js
│       │   └── metricas.js, funcionarios.js, login.js
│       └── modules/               # utilitários/serviços transversais (fora do
│                                   # tripé MVC): acessibilidade, sessão/login,
│                                   # LGPD, toast, paginação, exportação, PDF…
├── prisma/
│   ├── schema.prisma              # Modelo de dados (Model do back-end)
│   ├── migrations/
│   ├── db.json                    # Dados de exemplo usados por prisma/seed.js
│   └── seed.js                    # Popula o banco a partir de db.json
├── server/                        # 🧠 Back-end Express, em MVC
│   ├── index.js / app.js
│   ├── config/prisma.js           # Conexão com o banco (Prisma + driver adapter)
│   ├── routes/                    # Rotas HTTP — só wiring + validação, sem lógica
│   ├── controllers/                # Lógica de cada rota
│   ├── repositories/              # Acesso ao banco (isola o Prisma dos controllers)
│   ├── schemas/                   # Validação de entrada (Zod)
│   ├── services/mensalidade.js    # Regra do ciclo mensal do mensalista
│   └── middleware/auth.js         # JWT (requireAuth / requireAdmin)
└── generated/prisma/               # Cliente Prisma gerado (não versionado)
```

---

## 🚀 Como rodar

Pré-requisitos: **Node.js 18+** e um banco **PostgreSQL** acessível (local ou na nuvem).

```bash
# 1. Clonar e instalar dependências
git clone <url-do-repositório>
cd projeto
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env   # ou crie o .env manualmente (ver variáveis abaixo)

# 3. Criar as tabelas e popular com dados de exemplo
npx prisma migrate dev
npm run db:seed

# 4. Subir a API + compilar o SCSS em modo watch
npm run dev
```

Com a API rodando (`http://localhost:3001` por padrão), abra `index.html` no navegador — o jeito mais simples é a extensão **Live Server** do VS Code, já que o front-end é estático e só precisa ser servido por HTTP (não pelo `file://`) para os módulos JS funcionarem direito.

**Alternativa com Docker** (sem precisar instalar Postgres na máquina): o `docker-compose.yml` sobe a API + um Postgres já configurado.

```bash
cp .env.example .env      # se ainda não tiver feito
docker compose up --build

# Num outro terminal, popular com dados de exemplo (só na primeira vez)
docker compose exec api npm run db:seed
```

A API sobe em `http://localhost:3001` (o `docker compose up` já aplica as migrations via `prisma migrate deploy` antes de iniciar). O front-end continua fora do compose — abra `index.html` pelo Live Server normalmente, apontando pra essa API. O `DATABASE_URL` do `.env` é ignorado pelo container da API, que usa o serviço `db` do compose; as demais variáveis (`JWT_SECRET`, `GOOGLE_CLIENT_ID` etc.) vêm do `.env` normalmente.

**Produção:** `npm run build` compila o SCSS já minificado (sem watch) e `npm start` sobe a API em modo normal (sem o `sass:watch` do `npm run dev`). O front-end continua sendo arquivos estáticos — sirva `index.html`, `404.html`, `views/` e `assets/` por qualquer servidor HTTP/CDN, apontando para a URL da API publicada.

**Variáveis de ambiente (`.env`):**

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | String de conexão do PostgreSQL |
| `PORT` | Porta da API (padrão: `3001`) |
| `JWT_SECRET` | Chave usada para assinar o token de sessão |
| `JWT_EXPIRES_IN` | Validade do token (ex.: `8h`) |
| `GOOGLE_CLIENT_ID` | Opcional — habilita o "Entrar com Google" (ver seção própria) |

**Credenciais de teste** (criadas pelo `npm run db:seed`, com ~3 meses de tickets simulados):

| Papel | CPF | Senha |
|---|---|---|
| 👑 Administrador | `111.222.333-44` | `Admin@123` |
| 🧑‍💼 Funcionário | `222.333.444-55` | `Func@123` |
| 🧑‍💼 Funcionário | `333.444.555-66` | `Func@123` |
| 🚫 Funcionário (inativo) | `444.555.666-77` | `Func@123` |

O login é feito por **CPF**, não por e-mail — o e-mail só serve como via de recuperação de senha.

---

## 💳 Cobrança de mensalistas

Mensalista **não paga por ticket** — ele paga um **ciclo mensal** (`server/services/mensalidade.js`), que fica registrado no banco (`Mensalidade`) com histórico completo:

- ✅ **Ao cadastrar (ou reativar)** um mensalista, abre-se um ciclo do dia atual até o fim do mês corrente, no valor **cheio** da mensalidade.
- ⏳ **Se ele completar o mês** (continua ativo), o próximo ciclo nasce automaticamente cheio, e assim por diante.
- ✂️ **Se for inativado antes do fim do mês**, o ciclo em aberto é fechado na hora com valor **proporcional aos dias em que esteve ativo** naquele mês (`valor da mensalidade × dias ativos ÷ dias do mês`).
- 🎫 Tickets abertos por um mensalista ativo fecham sempre com `valorTotal = 0` — ele já pagou pelo ciclo, então cada entrada/saída não gera cobrança extra (o rótulo "Isento" no comprovante passa a ser literal, não um bug).

Na tela de **Mensalistas**, o botão <kbd>💵 Ver cobranças</kbd> em cada linha abre o histórico de ciclos daquele cliente (período, dias cobrados, valor, status) com opção de marcar um ciclo como pago. A página de **Métricas** soma a receita dos ciclos de mensalidade junto com a dos tickets avulsos, para o faturamento total refletir a realidade.

---

## 🎟️ Regras de tickets avulsos

- Não é possível abrir ticket numa vaga já ocupada.
- Permanências de até **15 minutos** são cortesia (sem cobrança).
- Acima disso, cobra-se por hora cheia (arredondada para cima) sobre a tarifa da categoria escolhida.
- Ao fechar o ticket, a vaga volta automaticamente para "livre".
- Todo o cálculo roda no servidor, numa transação — o front-end nunca envia nem decide o valor cobrado.

---

## 🔐 Autenticação e área administrativa

- Todas as páginas (exceto `sobre.html` e `login.html`) exigem sessão — sem uma sessão salva, o usuário é redirecionado para `views/login.html`.
- Senhas com hash **bcrypt** (nunca texto puro) e sessão via **JWT** assinado pelo servidor.
- Senhas novas (cadastro, reset, perfil, funcionários) exigem mínimo de 8 caracteres com maiúscula, minúscula, número e caractere especial — força mostrada em tempo real.
- Menu do usuário na navbar: avatar, "Meu Perfil" (trocar nome/e-mail/telefone/senha) e "Sair".
- `views/funcionarios.html`, visível só para contas "admin", cadastra/edita/inativa funcionários.
- Modo escuro, com o mesmo padrão de preferência salva localmente usado nos outros recursos de acessibilidade.

A recuperação de senha ("Esqueci minha senha") envia um código de verificação de 6 dígitos por e-mail de verdade — precisa de SMTP configurado, veja a seção [📧 Recuperação de senha por e-mail](#-recuperação-de-senha-por-e-mail).

---

## ♿ Acessibilidade (WCAG 2.1 AAA)

- 🔠 Aumentar/diminuir fonte sem quebrar o layout.
- 🌓 Alto contraste e modo escuro/claro.
- 🧠 Fonte para dislexia (tipografia e espaçamento adaptados).
- ⏸️ Reduzir animações (pausa efeitos para sensibilidade a movimento).
- 👁️ Filtros de daltonismo (protanopia, deuteranopia, tritanopia).
- 🤟 VLibras integrado (tradução automática para Libras).
- Navegação completa por teclado, `aria-label`/`aria-live`/`role` em tabelas, modais e formulários.

## 🛡️ LGPD

- **Minimização de dados** — coleta só o necessário para operar o estacionamento.
- **Mascaramento de CPF** (`***.***.**0-00`) nas listagens e tabelas.
- Mensalistas nunca são excluídos fisicamente, só inativados/reativados — preserva o histórico para auditoria.

---

## 🔑 Login com Google (opcional)

O botão "Entrar com Google" usa **Google Identity Services** (gratuito) e precisa de um Client ID OAuth real — sem ele, o botão fica escondido e mostra um aviso de indisponibilidade, sem simular um login inseguro.

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**.
2. Crie um **OAuth 2.0 Client ID** do tipo *Web application*, com a origem apontando para onde o projeto roda (ex.: `http://localhost:8080`).
3. Copie o Client ID gerado e cole em **dois lugares** (mesmo valor nos dois): a constante `GOOGLE_CLIENT_ID` no topo de `assets/js/modules/auth.js`, e a variável `GOOGLE_CLIENT_ID` no `.env`.

Client ID não é segredo — o fluxo de ID token do Google Identity Services não usa Client Secret.

---

## 📧 Recuperação de senha por e-mail

O fluxo "Esqueci minha senha" (tela de login) gera um código de 6 dígitos, guarda só o **hash** dele no banco (com expiração de 15 minutos e uso único) e envia por e-mail de verdade via **SMTP** (`server/services/email.js`). Sem essas variáveis configuradas, a API recusa o pedido com um erro claro (503) em vez de falhar silenciosamente.

Configure no `.env`:

| Variável | Para que serve |
|---|---|
| `SMTP_HOST` | Endereço do servidor SMTP |
| `SMTP_PORT` | Porta SMTP (padrão: `587`; use `465` para SSL implícito) |
| `SMTP_USER` | Usuário/e-mail de autenticação |
| `SMTP_PASS` | Senha ou senha de app do provedor |
| `SMTP_FROM` | Opcional — remetente exibido; se vazio, usa `SMTP_USER` |

**Opções práticas:**
- **Gmail** — em [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), gere uma "senha de app" (exige verificação em 2 etapas ativada) e use `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=seu-email@gmail.com`, `SMTP_PASS=<senha de app>`.
- **Ethereal Email** ([ethereal.email](https://ethereal.email/)) — cria uma conta SMTP de teste gratuita na hora, sem enviar e-mail de verdade para ninguém; os e-mails ficam disponíveis numa caixa de entrada falsa, ótimo para testar o fluxo sem depender de uma conta real.

---

## 📐 Padrão de commits

Este projeto segue [Conventional Commits](https://www.conventionalcommits.org/):

| Prefixo | Uso |
|---|---|
| `feat` | Nova funcionalidade — ex.: `feat(mensalistas): adiciona ciclo de cobrança mensal` |
| `fix` | Correção de bug — ex.: `fix(tickets): corrige cálculo do valor de permanência` |
| `style` | Formatação/CSS sem alterar lógica |
| `docs` | Documentação |
| `refactor` | Refatoração sem alterar comportamento |

---

## 👩‍💻 Autora

Desenvolvido por **Bruna Coelho**.

Projeto: Sistema de Estacionamento ParkGestão · Licença: **MIT** — livre para estudos e aprimoramentos.
