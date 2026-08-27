// Fórmula de cálculo do holerite — documentada também na tela "Sobre" (ver
// views/sobre.html) pra transparência do funcionário. Tabelas de INSS/IRRF
// são simplificadas (valores aproximados de referência, não a tabela legal
// vigente exata) — este é um sistema de simulação, não um cálculo trabalhista
// oficial. Único desconto do funcionário: INSS e IRRF (obrigatórios por lei).
// VR, VA, convênio médico, odontológico e Gympass nunca descontam do
// funcionário — a empresa paga 100% (ver requisito de negócio).

export const VALOR_VR_POR_DIA = 45
export const VALOR_VA_MENSAL = 800

const FAIXAS_INSS = [
  { ate: 1412.00, aliquota: 0.075 },
  { ate: 2666.68, aliquota: 0.09 },
  { ate: 4000.03, aliquota: 0.12 },
  { ate: 7786.02, aliquota: 0.14 }
]

const FAIXAS_IRRF = [
  { ate: 2259.20, aliquota: 0, deduzir: 0 },
  { ate: 2826.65, aliquota: 0.075, deduzir: 169.44 },
  { ate: 3751.05, aliquota: 0.15, deduzir: 381.44 },
  { ate: 4664.68, aliquota: 0.225, deduzir: 662.77 },
  { ate: Infinity, aliquota: 0.275, deduzir: 896.00 }
]

export function arredondar2 (numero: number): number {
  return Math.round(numero * 100) / 100
}

// Progressivo por faixa (cada faixa tributa só a parte do salário dentro
// dela) — é assim que o INSS funciona desde 2020, não é uma alíquota única
// sobre o valor cheio.
export function calcularInss (baseValor: number): number {
  if (baseValor <= 0) return 0
  const tetoFaixaFinal = FAIXAS_INSS[FAIXAS_INSS.length - 1].ate
  const baseComTeto = Math.min(baseValor, tetoFaixaFinal)

  let total = 0
  let limiteAnterior = 0
  for (const faixa of FAIXAS_INSS) {
    if (baseComTeto <= limiteAnterior) break
    const limiteFaixa = Math.min(baseComTeto, faixa.ate)
    total += (limiteFaixa - limiteAnterior) * faixa.aliquota
    limiteAnterior = faixa.ate
  }
  return arredondar2(total)
}

// Método "alíquota efetiva com parcela a deduzir" — matematicamente
// equivalente ao cálculo progressivo por faixa, é como a Receita Federal
// documenta a tabela do IRRF.
export function calcularIrrf (baseValor: number): number {
  if (baseValor <= 0) return 0
  const faixa = FAIXAS_IRRF.find(f => baseValor <= f.ate) ?? FAIXAS_IRRF[FAIXAS_IRRF.length - 1]
  return arredondar2(Math.max(0, baseValor * faixa.aliquota - faixa.deduzir))
}

export interface EntradaCalculoHolerite {
  salarioBase: number
  horasPorDia: number
  diasEscalaNoMes: number
  faltas: number
  horasExtras: number
  horasForaEscala: number
  diasTrabalhados: number
}

export interface ResultadoCalculoHolerite {
  valorHora: number
  salarioProporcional: number
  valorHorasExtras: number
  valorHorasForaEscala: number
  valorVr: number
  valorVa: number
  inss: number
  irrf: number
  salarioLiquido: number
}

export function calcularHolerite (entrada: EntradaCalculoHolerite): ResultadoCalculoHolerite {
  const { salarioBase, horasPorDia, diasEscalaNoMes, faltas, horasExtras, horasForaEscala, diasTrabalhados } = entrada

  // Valor por dia de escala e valor-hora derivados da própria escala do
  // funcionário NO MÊS (dias de escala reais do período, não uma média
  // genérica) — cada funcionário pode ter uma escala diferente (4 dias
  // fixos, quaisquer 4 dias da semana, X horas por dia).
  const valorPorDiaEscala = diasEscalaNoMes > 0 ? salarioBase / diasEscalaNoMes : 0
  const valorHora = horasPorDia > 0 ? valorPorDiaEscala / horasPorDia : 0

  // Salário integral menos só o proporcional das faltas NÃO abonadas
  // (justificativas e férias aprovadas já não entram em `faltas` — ver
  // PontoCalculoService) — "o que puder não descontar, não desconte".
  const salarioProporcional = arredondar2(salarioBase - valorPorDiaEscala * faltas)

  const valorHorasExtras = arredondar2(horasExtras * valorHora)
  const valorHorasForaEscala = arredondar2(horasForaEscala * valorHora * 2) // 100% de adicional
  const valorVr = arredondar2(diasTrabalhados * VALOR_VR_POR_DIA)
  const valorVa = VALOR_VA_MENSAL

  const baseInss = salarioProporcional + valorHorasExtras + valorHorasForaEscala
  const inss = calcularInss(baseInss)
  const irrf = calcularIrrf(baseInss - inss)

  const salarioLiquido = arredondar2(
    salarioProporcional + valorHorasExtras + valorHorasForaEscala + valorVr + valorVa - inss - irrf
  )

  return {
    valorHora: arredondar2(valorHora),
    salarioProporcional,
    valorHorasExtras,
    valorHorasForaEscala,
    valorVr,
    valorVa,
    inss,
    irrf,
    salarioLiquido
  }
}
