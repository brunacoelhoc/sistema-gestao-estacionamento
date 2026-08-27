import PDFDocument from 'pdfkit'

// Gerado no servidor a partir do snapshot já congelado em FolhaPontoMensal
// (não recalcula nada aqui) — mesmo padrão de src/tickets/comprovante-ticket.pdf.ts.
export interface DadosEspelhoPontoPdf {
  nomeFuncionario: string
  cargo: string
  referencia: string
  horasNormais: number
  horasExtras: number
  horasForaEscala: number
  faltas: number
  nomeGeradoPor: string
  assinadoEm: Date
  assinaturaDataUri: string
}

function formatarReferencia (referencia: string): string {
  const [ano, mes] = referencia.split('-')
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${meses[Number(mes) - 1]} de ${ano}`
}

export async function gerarEspelhoPontoPdf (dados: DadosEspelhoPontoPdf): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } })
    const chunks: Buffer[] = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(16).font('Helvetica-Bold').text('ParkGestão', { align: 'center' })
    doc.fontSize(12).font('Helvetica').text('Espelho de Ponto Mensal', { align: 'center' })
    doc.moveDown(1.5)

    const linha = (rotulo: string, valor: string): void => {
      doc.font('Helvetica-Bold').fontSize(10).text(rotulo, { continued: true })
      doc.font('Helvetica').text(` ${valor}`)
    }

    linha('Funcionário:', dados.nomeFuncionario)
    linha('Cargo:', dados.cargo)
    linha('Referência:', formatarReferencia(dados.referencia))
    doc.moveDown(1)

    doc.font('Helvetica-Bold').fontSize(11).text('Resumo de horas')
    doc.moveDown(0.3)
    linha('Horas normais:', `${dados.horasNormais.toFixed(2)}h`)
    linha('Horas extras:', `${dados.horasExtras.toFixed(2)}h`)
    linha('Horas fora da escala (autorizadas):', `${dados.horasForaEscala.toFixed(2)}h`)
    linha('Faltas não abonadas:', `${dados.faltas} dia(s)`)
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
      // Assinatura corrompida/ilegível não deve derrubar a geração do PDF —
      // o texto acima já registra que o documento foi assinado.
    }

    doc.moveDown(2)
    doc.fontSize(8).font('Helvetica').fillColor('gray').text(
      `Gerado por ${dados.nomeGeradoPor} em ${new Date().toLocaleString('pt-BR')}.`,
      { align: 'left' }
    )

    doc.end()
  })
}
