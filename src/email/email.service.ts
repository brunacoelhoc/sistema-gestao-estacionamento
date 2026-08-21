import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import * as nodemailer from 'nodemailer'

// Sem SMTP_HOST/SMTP_USER/SMTP_PASS configurados no .env, o envio fica
// desativado (erro 503 claro em vez de falhar de forma confusa) — ver
// README para como configurar (Gmail, Ethereal para testes, etc.).
const SMTP_HOST = process.env.SMTP_HOST || null
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587
const SMTP_USER = process.env.SMTP_USER || null
const SMTP_PASS = process.env.SMTP_PASS || null
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER

interface ParametrosEmailReset {
  to: string
  nome: string
  codigo: string
}

@Injectable()
export class EmailService {
  private readonly transporter = SMTP_HOST && SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    })
    : null

  async enviarEmailResetSenha ({ to, nome, codigo }: ParametrosEmailReset) {
    if (!this.transporter) {
      throw new ServiceUnavailableException(
        'Envio de e-mail não está configurado neste servidor (SMTP_HOST/SMTP_USER/SMTP_PASS ausentes no .env).'
      )
    }

    await this.transporter.sendMail({
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
          <p>Olá, ${nome}!</p>
          <p>Recebemos um pedido de redefinição de senha da sua conta. Use o código abaixo para continuar:</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; text-align: center; background: #f1f5f9; padding: 12px; border-radius: 8px;">${codigo}</p>
          <p>Esse código é válido por <strong>15 minutos</strong>. Se você não pediu essa redefinição, pode ignorar este e-mail com segurança — sua senha continua a mesma.</p>
        </div>
      `
    })
  }
}
