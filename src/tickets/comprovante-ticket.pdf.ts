import PDFDocument from 'pdfkit'

// Gerado no servidor (não a partir de dado enviado pelo cliente) para que o
// comprovante anexado ao e-mail sempre reflita o registro real do ticket no
// banco — ver TicketsService.enviarComprovanteEmail.
export interface DadosComprovanteTicket {
  ticketId: string
  placa: string
  vagaCodigo: string
  nomeMensalista: string | null
  dataEntrada: Date
  dataSaida: Date
  formaPagamento: string | null
  valorTotal: number
}

const FORMAS_PAGAMENTO: Record<string, string> = {
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro',
  isento: 'Isento (Mensalista)'
}

function formatarDataHora (data: Date): string {
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatarPermanencia (entrada: Date, saida: Date): string {
  const diffMinutos = Math.max(1, Math.floor((saida.getTime() - entrada.getTime()) / (1000 * 60)))
  const horas = Math.floor(diffMinutos / 60)
  const minutos = diffMinutos % 60
  return `${horas > 0 ? `${horas}h ` : ''}${minutos}min`
}

// Layout espelha o comprovante em jsPDF do front (assets/js/modules/comprovante.js)
// no estilo de recibo de impressora térmica, só que gerado aqui com dados
// confiáveis (vindos do banco) em vez de dados soltos vindos do cliente.
export async function gerarComprovanteTicketPdf (dados: DadosComprovanteTicket): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [227, 340], margins: { top: 15, bottom: 15, left: 15, right: 15 } })
    const chunks: Buffer[] = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const largura = 197
    let y = 15

    doc.fontSize(14).font('Helvetica-Bold').text('ParkGestão', 15, y, { width: largura, align: 'center' })
    y += 18
    doc.fontSize(9).font('Helvetica').text('Comprovante de Saída', 15, y, { width: largura, align: 'center' })
    y += 16

    doc.moveTo(15, y).lineTo(15 + largura, y).stroke()
    y += 8

    const linha = (rotulo: string, valor: string): void => {
      doc.fontSize(9).font('Helvetica-Bold').text(rotulo, 15, y, { width: 90 })
      doc.font('Helvetica').text(valor, 15, y, { width: largura, align: 'right' })
      y += 14
    }

    linha('Ticket:', `#${dados.ticketId}`)
    linha('Placa:', dados.placa)
    linha('Vaga:', dados.vagaCodigo)
    if (dados.nomeMensalista) linha('Mensalista:', dados.nomeMensalista)
    linha('Entrada:', formatarDataHora(dados.dataEntrada))
    linha('Saída:', formatarDataHora(dados.dataSaida))
    linha('Permanência:', formatarPermanencia(dados.dataEntrada, dados.dataSaida))
    linha('Pagamento:', FORMAS_PAGAMENTO[dados.formaPagamento || ''] || dados.formaPagamento || '-')

    y += 4
    doc.moveTo(15, y).lineTo(15 + largura, y).stroke()
    y += 10

    doc.fontSize(12).font('Helvetica-Bold').text('TOTAL', 15, y, { width: 90 })
    doc.text(`R$ ${dados.valorTotal.toFixed(2).replace('.', ',')}`, 15, y, { width: largura, align: 'right' })
    y += 22

    doc.fontSize(7).font('Helvetica').text('Obrigado pela preferência!', 15, y, { width: largura, align: 'center' })
    y += 10
    doc.text(new Date().toLocaleString('pt-BR'), 15, y, { width: largura, align: 'center' })

    doc.end()
  })
}
