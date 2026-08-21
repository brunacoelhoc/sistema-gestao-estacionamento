const nodemailer = require('nodemailer')

// Escapa caracteres especiais de HTML antes de interpolar dado do usuário
// (nome) no corpo do e-mail — sem isso, um nome de cadastro como
// `<img src=x onerror=...>` iria parar cru no HTML do e-mail enviado.
function escapeHtml (valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Sem SMTP_HOST/SMTP_USER/SMTP_PASS configurados no .env, o envio fica
// desativado (erro 503 claro em vez de falhar de forma confusa) — ver
// README para como configurar (Gmail, Ethereal para testes, etc.).
const SMTP_HOST = process.env.SMTP_HOST || null
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587
const SMTP_USER = process.env.SMTP_USER || null
const SMTP_PASS = process.env.SMTP_PASS || null
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER

const transporter = SMTP_HOST && SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  })
  : null

async function enviarEmailResetSenha ({ to, nome, codigo }) {
  if (!transporter) {
    throw Object.assign(
      new Error('Envio de e-mail não está configurado neste servidor (SMTP_HOST/SMTP_USER/SMTP_PASS ausentes no .env).'),
      { status: 503 }
    )
  }

  await transporter.sendMail({
    from: `"ParkGestão" <${SMTP_FROM}>`,
    to,
    subject: 'Código para redefinir sua senha — ParkGestão',
    text:
      `Olá, ${nome}!\n\n` +
      'Recebemos um pedido de redefinição de senha da sua conta no ParkGestão.\n' +
      `Seu código de verificação é: ${codigo}\n\n` +
      'Ele é válido por 15 minutos. Se você não pediu essa redefinição, ignore este e-mail.',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        <h2 style="color: #0d6efd; margin-bottom: 8px;">ParkGestão</h2>
        <p>Olá, ${escapeHtml(nome)}!</p>
        <p>Recebemos um pedido de redefinição de senha da sua conta. Use o código abaixo para continuar:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; text-align: center; background: #f1f5f9; padding: 12px; border-radius: 8px;">${codigo}</p>
        <p>Esse código é válido por <strong>15 minutos</strong>. Se você não pediu essa redefinição, pode ignorar este e-mail com segurança — sua senha continua a mesma.</p>
      </div>
    `
  })
}

module.exports = { enviarEmailResetSenha }
