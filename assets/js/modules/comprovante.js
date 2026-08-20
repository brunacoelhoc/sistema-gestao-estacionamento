/**
 * Comprovante de Saída (Ticket) em PDF
 * Gera um recibo compacto, no estilo de impressora térmica de cancela,
 * usando jsPDF (carregado via CDN nas páginas onde um ticket pode ser
 * fechado: Dashboard e Tickets).
 */

function formatarDataHoraComprovante (data) {
  if (!data) return '-'
  const d = data instanceof Date ? data : new Date(data)
  if (isNaN(d)) return '-'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatarFormaPagamentoComprovante (forma) {
  const mapa = {
    pix: 'PIX',
    cartao_credito: 'Cartão de Crédito',
    cartao_debito: 'Cartão de Débito',
    dinheiro: 'Dinheiro',
    isento: 'Isento (Mensalista)'
  }
  return mapa[forma] || forma || '-'
}

/**
 * @param {Object} dados
 * @param {string|number} dados.ticketId
 * @param {string} dados.placa
 * @param {string} [dados.vagaCodigo]
 * @param {Date|string} dados.horaEntrada
 * @param {Date|string} dados.horaSaida
 * @param {string} dados.tempoTexto Permanência já formatada (ex.: "1h 20min")
 * @param {string} dados.formaPagamento
 * @param {number} dados.valor
 */
function gerarComprovanteTicketPDF (dados) {
  if (typeof window.jspdf === 'undefined') {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Comprovante indisponível',
        text: 'Não foi possível carregar a biblioteca de geração de PDF.'
      })
    }
    return
  }

  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ unit: 'mm', format: [80, 160] })
  const centro = 40
  let y = 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('ParkGestão', centro, y, { align: 'center' })

  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Comprovante de Saída', centro, y, { align: 'center' })

  y += 4
  doc.line(5, y, 75, y)
  y += 6

  const linha = (rotulo, valor) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(rotulo, 5, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(valor ?? '-'), 75, y, { align: 'right' })
    y += 5
  }

  linha('Ticket:', `#${dados.ticketId}`)
  linha('Placa:', dados.placa)
  linha('Vaga:', dados.vagaCodigo)
  linha('Entrada:', formatarDataHoraComprovante(dados.horaEntrada))
  linha('Saída:', formatarDataHoraComprovante(dados.horaSaida))
  linha('Permanência:', dados.tempoTexto)
  linha('Pagamento:', formatarFormaPagamentoComprovante(dados.formaPagamento))

  y += 2
  doc.line(5, y, 75, y)
  y += 7

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL', 5, y)
  doc.text(
    `R$ ${Number(dados.valor || 0).toFixed(2).replace('.', ',')}`,
    75,
    y,
    { align: 'right' }
  )

  y += 9
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('Obrigado pela preferência!', centro, y, { align: 'center' })
  y += 4
  doc.text(new Date().toLocaleString('pt-BR'), centro, y, { align: 'center' })

  doc.save(`comprovante-ticket-${dados.ticketId}.pdf`)
}

window.gerarComprovanteTicketPDF = gerarComprovanteTicketPDF
