# 🔌 Integrações Externas e Geração de Documentos

Especificação de tudo que o back-end produz ou fala com o mundo fora do banco de dados: e-mails transacionais, PDFs gerados no servidor e login social com Google. Nenhuma dessas integrações depende de gateway de pagamento, storage externo (S3, etc.) ou fila de mensageria — tudo roda de forma síncrona, dentro do próprio processo Node.

## 📌 Índice

- [Login social — Google OAuth](#-login-social--google-oauth)
- [E-mails transacionais](#-e-mails-transacionais)
- [Documentos em PDF gerados no servidor](#-documentos-em-pdf-gerados-no-servidor)
- [O que este sistema explicitamente NÃO integra](#-o-que-este-sistema-explicitamente-não-integra)

---

## 🔐 Login social — Google OAuth

- Biblioteca: `google-auth-library`.
- Fluxo: o front-end obtém um **ID token** do Google (via Google Identity Services) e o envia em `POST /auth/google { credential }`. O back-end **verifica a assinatura desse token diretamente com o Google** — nunca confia em dados de usuário decodificados no cliente.
- Configuração necessária: variável `GOOGLE_CLIENT_ID` (o Client ID OAuth do projeto no Google Cloud Console). Sem ela, a rota responde `503 Service Unavailable` — a funcionalidade fica desabilitada de forma explícita, não quebra de forma confusa.
- Primeiro login de um e-mail novo via Google **cria a conta automaticamente**, papel `funcionario`, sem CPF preenchido (ver `ProfileCompleteGuard` no [AUTENTICACAO_PERMISSOES.md](./AUTENTICACAO_PERMISSOES.md)).
- Não há logout/revogação de token do lado do Google gerenciado pelo back-end — a sessão do sistema depois do login inicial é só o JWT próprio.

---

## 📧 E-mails transacionais

- Biblioteca: `nodemailer`, com transporte SMTP genérico (funciona com Gmail, provedores transacionais como SendGrid/Mailgun/SES via SMTP, ou Ethereal para testes).
- **Sem `SMTP_HOST`, `SMTP_USER` e `SMTP_PASS` configurados, o serviço de e-mail fica desativado** — qualquer rota que dependa de envio responde `503 'Envio de e-mail não está configurado neste servidor (SMTP_HOST/SMTP_USER/SMTP_PASS ausentes no .env).'` em vez de falhar silenciosamente ou travar.
- Todo e-mail é enviado em **texto simples + HTML** (multipart), com o nome do destinatário escapado contra HTML injection antes de ser interpolado no corpo (`escapeHtml()` — proteção específica contra um nome de cadastro tipo `<img src=x onerror=...>`).
- Em contas de teste (Ethereal), a URL de preview do e-mail é logada no console do servidor (`[email] preview (não enviado de verdade): ...`) — não é enviado de fato.

### 1. Redefinição de senha

| | |
|---|---|
| **Disparado por** | `POST /auth/reset/solicitar` |
| **Assunto** | `Código para redefinir sua senha — ParkGestão` |
| **Conteúdo** | Nome do usuário + código de verificação de 6 dígitos, em destaque visual (fonte grande, espaçada) |
| **Validade citada no corpo** | 15 minutos |
| **Variáveis** | `nome`, `codigo` |

### 2. Lembrete de cobrança de mensalista

| | |
|---|---|
| **Disparado por** | `POST /mensalidades/:id/lembrete` |
| **Assunto** | `Lembrete de cobrança — ParkGestão` |
| **Conteúdo** | Nome do mensalista, valor da mensalidade em destaque, data de fim do ciclo vigente |
| **Variáveis** | `nome`, `valor`, `dataFim` |
| **Pré-condição** | Mensalista precisa ter e-mail cadastrado (`400` caso contrário) |

### 3. Comprovante de saída de ticket

| | |
|---|---|
| **Disparado por** | `POST /tickets/:id/comprovante-email` |
| **Assunto** | `Comprovante de Saída — Ticket #{ticketId} — ParkGestão` |
| **Conteúdo** | Corpo curto + **anexo PDF** do comprovante (gerado no servidor, ver seção de PDFs) |
| **Variáveis** | `nome`, `ticketId`, `anexoPdf` (Buffer do PDF) |
| **Pré-condição** | Ticket precisa estar `fechado` e vinculado a um mensalista com e-mail cadastrado |

---

## 📄 Documentos em PDF gerados no servidor

- Biblioteca: `pdfkit` (geração imperativa, sem template engine/HTML-to-PDF).
- **Princípio comum a todos os quatro documentos**: o PDF é montado a partir do **snapshot já congelado** no banco (o documento correspondente já foi gerado/fechado antes) — nunca recalcula nada na hora de exportar, e nunca aceita dado vindo do cliente para montar o conteúdo.

### Holerite (`src/folha-pagamento/holerite.pdf.ts`)

- Formato A4, margens de 50pt.
- Seções: cabeçalho ("ParkGestão" + "Holerite / Recibo de Pagamento") → dados do funcionário/cargo/referência → **Proventos** (salário proporcional, horas extras, horas fora da escala, VR, VA) → **Descontos obrigatórios** (INSS, IRRF) → salário líquido em destaque → nota de rodapé sobre benefícios sem desconto (convênio/odonto/Gympass) → bloco de assinatura (nome + data/hora + imagem da assinatura eletrônica renderizada a partir do data URI) → rodapé com quem gerou e aviso de que o pagamento é simulado.
- Assinatura corrompida/ilegível não derruba a geração (`try/catch` silencioso ao decodificar a imagem).

### Espelho de Ponto (`src/espelho-ponto/espelho-ponto.pdf.ts`)

- Mesmo padrão visual do holerite (A4, mesmas margens, mesmo cabeçalho de marca).
- Seções: identificação → **Resumo de horas** (normais, extras, fora da escala, faltas não abonadas) → bloco de assinatura → rodapé com quem gerou.

### Contrato de Trabalho (`src/contrato-trabalho/contrato-trabalho.pdf.ts`)

- O mais extenso dos quatro. Seções: cabeçalho com número da versão e data de geração → **Identificação** (funcionário, cargo, vaga de origem, modalidade CLT/PJ, data de admissão) → **Jornada de Trabalho** (dias de escala por extenso, horário, horas/dia, horas/semana e horas/mês calculadas apenas informativamente) → **Remuneração** (salário-base) → **Hierarquia** (nome e cargo do gestor **no momento da geração**) → **Direitos**, **Deveres** e **Tarefas do Cargo** (cada um como lista de bullets a partir do texto congelado, ou "Não informado.") → **Benefícios** (lista fixa institucional + os que variam por funcionário: vale-transporte/combustível, bônus, observações) → bloco de assinatura → rodapé reforçando que é um registro imutável daquela versão.
- Só é chamado depois que o service já confirmou `status === 'assinado'` — não existe, neste arquivo, um caminho para "assinatura ainda pendente".

### Comprovante de Ticket (`src/tickets/comprovante-ticket.pdf.ts`)

- Formato de **recibo térmico** (227×340pt, bem menor que A4), espelhando visualmente o comprovante que o front já gera em `jsPDF` no navegador (`assets/js/modules/comprovante.js`) — mas aqui construído com dados vindos do banco, não do cliente.
- Campos: ticket, placa, vaga, mensalista (se houver), entrada, saída, permanência calculada, forma de pagamento (com rótulo amigável — ex.: `pix` → "PIX", `isento` → "Isento (Mensalista)") e total em destaque.
- É o mesmo PDF anexado no e-mail de comprovante de saída.

---

## 🚫 O que este sistema explicitamente NÃO integra

Para evitar que o colega gaste tempo procurando uma integração que não existe:

- **Gateway de pagamento** — nenhum. PIX/cartão/dinheiro são apenas rótulos informativos (`formaPagamento`); nenhuma cobrança é processada de fato.
- **Storage de arquivos externo** (S3, Cloud Storage, etc.) — nenhum. Todo anexo (avatar, comprovante, assinatura) é base64 embutido em coluna de texto do banco.
- **Fila de mensageria** (SQS, RabbitMQ, etc.) — nenhuma. Envio de e-mail e geração de PDF são síncronos, dentro da própria requisição HTTP.
- **Cron/scheduler** — nenhum. Não há `@nestjs/schedule` nem job agendado; toda ação (gerar ciclo de mensalidade, folha de pagamento, espelho de ponto) acontece sob demanda, disparada por uma chamada de rota.
- **SMS** — nenhum. Comunicação com mensalistas/funcionários é só por e-mail (quando configurado).
