import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'

// Escapa caracteres especiais de HTML antes de interpolar dado do usuário
// (nome) no corpo do e-mail — sem isso, um nome de cadastro como
// `<img src=x onerror=...>` iria parar cru no HTML do e-mail enviado.
function escapeHtml (valor: string): string {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface ParametrosEmailReset {
  to: string
  nome: string
  codigo: string
}

interface ParametrosEmailLembreteCobranca {
  to: string
  nome: string
  valor: string
  dataFim: string
}

interface ParametrosEmailComprovanteTicket {
  to: string
  nome: string
  ticketId: string
  anexoPdf: Buffer
}

@Injectable()
export class EmailService {
  private readonly transporter: nodemailer.Transporter | null
  private readonly smtpFrom: string | null

  // Sem SMTP_HOST/SMTP_USER/SMTP_PASS configurados no .env, o envio fica
  // desativado (erro 503 claro em vez de falhar de forma confusa) — ver
  // README para como configurar (Gmail, Ethereal para testes, etc.).
  constructor (configService: ConfigService) {
    const smtpHost = configService.get<string>('SMTP_HOST') || null
    // ConfigService não converte tipo sozinho — env var sempre chega como
    // string, por isso o Number() explícito (senão "465" === 465 seria false
    // logo abaixo, e a porta SSL nunca seria detectada corretamente).
    const smtpPort = Number(configService.get<string>('SMTP_PORT')) || 587
    const smtpUser = configService.get<string>('SMTP_USER') || null
    const smtpPass = configService.get<string>('SMTP_PASS') || null
    this.smtpFrom = configService.get<string>('SMTP_FROM') || smtpUser

    this.transporter = smtpHost && smtpUser && smtpPass
      ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass }
      })
      : null
  }

  async enviarEmailResetSenha ({ to, nome, codigo }: ParametrosEmailReset) {
    if (!this.transporter) {
      throw new ServiceUnavailableException(
        'Envio de e-mail não está configurado neste servidor (SMTP_HOST/SMTP_USER/SMTP_PASS ausentes no .env).'
      )
    }

    const info = await this.transporter.sendMail({
      from: `"ParkGestão" <${this.smtpFrom}>`,
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

    // Só retorna URL para contas de teste (Ethereal); em SMTP real é `false`.
    const previewUrl = nodemailer.getTestMessageUrl(info)
    if (previewUrl) console.log(`[email] preview (não enviado de verdade): ${previewUrl}`)
  }

  async enviarEmailLembreteCobranca ({ to, nome, valor, dataFim }: ParametrosEmailLembreteCobranca) {
    if (!this.transporter) {
      throw new ServiceUnavailableException(
        'Envio de e-mail não está configurado neste servidor (SMTP_HOST/SMTP_USER/SMTP_PASS ausentes no .env).'
      )
    }

    const info = await this.transporter.sendMail({
      from: `"ParkGestão" <${this.smtpFrom}>`,
      to,
      subject: 'Lembrete de cobrança — ParkGestão',
      text:
        `Olá, ${nome}!\n\n` +
        `Passando para lembrar sobre sua mensalidade de vaga no ParkGestão, no valor de R$ ${valor}.\n` +
        `Seu ciclo atual é válido até ${dataFim}.\n\n` +
        'Qualquer dúvida, fale com a nossa equipe.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
          <h2 style="color: #0d6efd; margin-bottom: 8px;">ParkGestão</h2>
          <p>Olá, ${escapeHtml(nome)}!</p>
          <p>Passando para lembrar sobre sua mensalidade de vaga no estacionamento.</p>
          <p style="font-size: 22px; font-weight: bold; text-align: center; background: #f1f5f9; padding: 12px; border-radius: 8px;">R$ ${escapeHtml(valor)}</p>
          <p>Seu ciclo atual é válido até <strong>${escapeHtml(dataFim)}</strong>.</p>
          <p>Qualquer dúvida, fale com a nossa equipe.</p>
        </div>
      `
    })

    const previewUrl = nodemailer.getTestMessageUrl(info)
    if (previewUrl) console.log(`[email] preview (não enviado de verdade): ${previewUrl}`)
  }

  async enviarComprovanteTicket ({ to, nome, ticketId, anexoPdf }: ParametrosEmailComprovanteTicket) {
    if (!this.transporter) {
      throw new ServiceUnavailableException(
        'Envio de e-mail não está configurado neste servidor (SMTP_HOST/SMTP_USER/SMTP_PASS ausentes no .env).'
      )
    }

    const info = await this.transporter.sendMail({
      from: `"ParkGestão" <${this.smtpFrom}>`,
      to,
      subject: `Comprovante de Saída — Ticket #${ticketId} — ParkGestão`,
      text:
        `Olá, ${nome}!\n\n` +
        `Segue em anexo o comprovante de saída do seu veículo (ticket #${ticketId}).\n\n` +
        'Qualquer dúvida, fale com a nossa equipe.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
          <h2 style="color: #0d6efd; margin-bottom: 8px;">ParkGestão</h2>
          <p>Olá, ${escapeHtml(nome)}!</p>
          <p>Segue em anexo o comprovante de saída do seu veículo.</p>
          <p>Qualquer dúvida, fale com a nossa equipe.</p>
        </div>
      `,
      attachments: [
        {
          filename: `comprovante-ticket-${ticketId}.pdf`,
          content: anexoPdf,
          contentType: 'application/pdf'
        }
      ]
    })

    const previewUrl = nodemailer.getTestMessageUrl(info)
    if (previewUrl) console.log(`[email] preview (não enviado de verdade): ${previewUrl}`)
  }
}
