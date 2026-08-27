import PDFDocument from 'pdfkit'

// Mesmo padrão de src/tickets/comprovante-ticket.pdf.ts e
// src/espelho-ponto/espelho-ponto.pdf.ts: gerado no servidor a partir do
// snapshot já congelado em Holerite, nunca recalculado aqui.
export interface DadosHoleritePdf {
  nomeFuncionario: string
  cargo: string
  referencia: string
  salarioProporcional: number
  valorHorasExtras: number
  valorHorasForaEscala: number
  valorVr: number
  valorVa: number
  inss: number
  irrf: number
  salarioLiquido: number
  nomeGeradoPor: string
  assinadoEm: Date
  assinaturaDataUri: string
}

function formatarMoeda (valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`
}

function formatarReferencia (referencia: string): string {
  const [ano, mes] = referencia.split('-')
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${meses[Number(mes) - 1]} de ${ano}`
}

export async function gerarHoleritePdf (dados: DadosHoleritePdf): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } })
    const chunks: Buffer[] = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(16).font('Helvetica-Bold').text('ParkGestão', { align: 'center' })
    doc.fontSize(12).font('Helvetica').text('Holerite / Recibo de Pagamento', { align: 'center' })
    doc.moveDown(1.5)

    const linha = (rotulo: string, valor: string): void => {
      doc.font('Helvetica-Bold').fontSize(10).text(rotulo, { continued: true })
      doc.font('Helvetica').text(` ${valor}`)
    }

    linha('Funcionário:', dados.nomeFuncionario)
    linha('Cargo:', dados.cargo)
    linha('Referência:', formatarReferencia(dados.referencia))
    doc.moveDown(1)

    doc.font('Helvetica-Bold').fontSize(11).text('Proventos')
    doc.moveDown(0.3)
    linha('Salário (proporcional a faltas não abonadas):', formatarMoeda(dados.salarioProporcional))
    linha('Horas extras:', formatarMoeda(dados.valorHorasExtras))
    linha('Horas fora da escala (100% de adicional):', formatarMoeda(dados.valorHorasForaEscala))
    linha('Vale-Refeição:', formatarMoeda(dados.valorVr))
    linha('Vale-Alimentação:', formatarMoeda(dados.valorVa))
    doc.moveDown(1)

    doc.font('Helvetica-Bold').fontSize(11).text('Descontos obrigatórios')
    doc.moveDown(0.3)
    linha('INSS:', formatarMoeda(dados.inss))
    linha('IRRF:', formatarMoeda(dados.irrf))
    doc.moveDown(1)

    doc.font('Helvetica-Bold').fontSize(13).text(`Salário líquido: ${formatarMoeda(dados.salarioLiquido)}`)
    doc.moveDown(0.5)
    doc.font('Helvetica').fontSize(8).fillColor('gray').text(
      'Plano de convênio médico, odontológico e Gympass são benefícios sem desconto no salário — não entram neste cálculo.'
    )
    doc.fillColor('black')
    doc.moveDown(1.5)

    doc.font('Helvetica-Bold').fontSize(11).text('Assinatura')
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(10).text(
      `Documento assinado eletronicamente por ${dados.nomeFuncionario} em ${dados.assinadoEm.toLocaleString('pt-BR')}.`
    )
    doc.moveDown(0.5)

    try {
      const base64 = dados.assinaturaDataUri.split(',')[1]
      if (base64) {
        doc.image(Buffer.from(base64, 'base64'), { fit: [200, 80] })
      }
    } catch {
      // Assinatura corrompida/ilegível não deve derrubar a geração do PDF.
    }

    doc.moveDown(2)
    doc.fontSize(8).font('Helvetica').fillColor('gray').text(
      `Gerado por ${dados.nomeGeradoPor} em ${new Date().toLocaleString('pt-BR')}. Pagamento simulado — não representa uma transação bancária real.`,
      { align: 'left' }
    )

    doc.end()
  })
}
