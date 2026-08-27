import PDFDocument from 'pdfkit'

// Gerado a partir do snapshot já congelado em ContratoTrabalho (não relê
// PerfilRH) — mesmo padrão de src/espelho-ponto/espelho-ponto.pdf.ts. Só é
// chamado depois que o service confirma status === 'assinado', por isso não
// existe aqui o caminho de "assinatura ainda não cadastrada".
export interface DadosContratoTrabalhoPdf {
  nomeFuncionario: string
  numeroVersao: number
  cargo: string
  vagaOrigem: string | null
  tipoContrato: 'clt' | 'pj'
  dataAdmissao: Date
  diasEscala: number[]
  horasPorDia: number
  horaInicioEscala: string
  salarioBase: number
  tipoValeTransporte: 'vale_transporte' | 'vale_combustivel' | 'nenhum'
  bonusDesempenho: number | null
  observacoesBeneficios: string | null
  nomeGestor: string | null
  cargoGestor: string | null
  direitos: string | null
  deveres: string | null
  tarefas: string | null
  nomeGeradoPor: string
  geradoEm: Date
  assinadoEm: Date
  assinaturaDataUri: string
}

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

// Benefícios institucionais fixos — iguais para todo mundo (ver
// views/rh.html, card "Benefícios"). Os que variam por funcionário
// (vale-transporte/combustível, bônus, observações) vêm do snapshot e são
// impressos à parte, logo abaixo desta lista.
const BENEFICIOS = [
  'Vale-Refeição (VR): mínimo de R$ 45,00 por dia trabalhado.',
  'Vale-Alimentação (VA): mínimo de R$ 1.000,00 fixo por mês.',
  'Plano de saúde: subsidiado em 100% pela empresa, sem desconto no salário.',
  'Plano odontológico: sem desconto no salário.',
  'TotalPass: acesso a qualquer modalidade esportiva, sem desconto no salário.',
  'Folga remunerada no dia do aniversário.',
  'Recesso remunerado de uma semana no final do ano, com escala revezada entre os funcionários.',
  'Apoio à saúde mental: suporte com terapia e psicólogos, em parceria com a empresa.',
  'Desconto para compra de livros, em parceria com a empresa.'
]

function formatarMoeda (valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`
}

function formatarData (data: Date): string {
  return data.toLocaleDateString('pt-BR')
}

function formatarDiasEscala (dias: number[]): string {
  return [...dias].sort((a, b) => a - b).map(d => DIAS_SEMANA[d]).join(', ')
}

export async function gerarContratoTrabalhoPdf (dados: DadosContratoTrabalhoPdf): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } })
    const chunks: Buffer[] = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(16).font('Helvetica-Bold').text('ParkGestão', { align: 'center' })
    doc.fontSize(12).font('Helvetica').text('Contrato de Trabalho', { align: 'center' })
    doc.fontSize(10).fillColor('gray').text(`Versão ${dados.numeroVersao} — gerada em ${formatarData(dados.geradoEm)}`, { align: 'center' })
    doc.fillColor('black')
    doc.moveDown(1.5)

    const linha = (rotulo: string, valor: string): void => {
      doc.font('Helvetica-Bold').fontSize(10).text(rotulo, { continued: true })
      doc.font('Helvetica').text(` ${valor}`)
    }

    doc.font('Helvetica-Bold').fontSize(11).text('Identificação')
    doc.moveDown(0.3)
    linha('Funcionário:', dados.nomeFuncionario)
    linha('Cargo:', dados.cargo)
    linha('Vaga de origem:', dados.vagaOrigem || 'Não informada.')
    linha('Modalidade de contrato:', dados.tipoContrato === 'clt' ? 'CLT' : 'PJ (Pessoa Jurídica)')
    linha('Data de admissão:', formatarData(dados.dataAdmissao))
    doc.moveDown(1)

    const horasPorSemana = dados.horasPorDia * dados.diasEscala.length
    const horasPorMes = Math.round(horasPorSemana * (52 / 12) * 10) / 10

    doc.font('Helvetica-Bold').fontSize(11).text('Jornada de Trabalho')
    doc.moveDown(0.3)
    linha('Dias de escala:', formatarDiasEscala(dados.diasEscala))
    linha('Horário de entrada previsto:', dados.horaInicioEscala)
    linha('Horas por dia:', `${dados.horasPorDia}h`)
    linha('Horas por semana (informativo):', `${horasPorSemana}h`)
    linha('Horas por mês (informativo):', `${horasPorMes}h`)
    doc.font('Helvetica').fontSize(8).fillColor('gray').text(
      'Trabalho fora dos dias de escala exige autorização prévia do RH e é pago com 100% de adicional.'
    )
    doc.fillColor('black')
    doc.moveDown(1)

    doc.font('Helvetica-Bold').fontSize(11).text('Remuneração')
    doc.moveDown(0.3)
    linha('Salário-base:', formatarMoeda(dados.salarioBase))
    doc.moveDown(1)

    doc.font('Helvetica-Bold').fontSize(11).text('Hierarquia')
    doc.moveDown(0.3)
    linha('Responde diretamente a:', dados.nomeGestor
      ? `${dados.nomeGestor}${dados.cargoGestor ? ` (${dados.cargoGestor})` : ''}`
      : 'Não definido.')
    doc.moveDown(1)

    const listaDeTexto = (titulo: string, texto: string | null): void => {
      doc.font('Helvetica-Bold').fontSize(11).text(titulo)
      doc.moveDown(0.3)
      const linhas = (texto || '').split('\n').map(l => l.trim()).filter(Boolean)
      doc.font('Helvetica').fontSize(10)
      if (linhas.length === 0) {
        doc.fillColor('gray').text('Não informado.')
        doc.fillColor('black')
      } else {
        linhas.forEach(l => doc.text(`• ${l}`))
      }
      doc.moveDown(1)
    }

    listaDeTexto('Direitos', dados.direitos)
    listaDeTexto('Deveres', dados.deveres)
    listaDeTexto('Tarefas do Cargo', dados.tarefas)

    doc.font('Helvetica-Bold').fontSize(11).text('Benefícios')
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(10)
    BENEFICIOS.forEach(b => doc.text(`• ${b}`))
    if (dados.tipoValeTransporte !== 'nenhum') {
      doc.text(`• Benefício de deslocamento escolhido: ${dados.tipoValeTransporte === 'vale_transporte' ? 'Vale-transporte' : 'Vale-combustível'}.`)
    }
    if (dados.bonusDesempenho != null) {
      doc.text(`• Bônus por desempenho: ${formatarMoeda(dados.bonusDesempenho)}.`)
    }
    if (dados.observacoesBeneficios) {
      doc.text(`• Observações sobre benefícios: ${dados.observacoesBeneficios}`)
    }
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
      `Gerado por ${dados.nomeGeradoPor} em ${dados.geradoEm.toLocaleString('pt-BR')}. Este documento é um registro imutável da versão ${dados.numeroVersao} deste contrato — alterações posteriores no cadastro de RH não afetam esta versão já assinada.`,
      { align: 'left' }
    )

    doc.end()
  })
}
