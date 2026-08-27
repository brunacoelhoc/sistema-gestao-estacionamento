import { calcularHolerite, calcularInss, calcularIrrf, VALOR_VA_MENSAL, VALOR_VR_POR_DIA } from './folha-pagamento-calculo.util'

describe('calcularInss', () => {
  it('devolve 0 para base zero ou negativa', () => {
    expect(calcularInss(0)).toBe(0)
    expect(calcularInss(-100)).toBe(0)
  })

  it('tributa só a 1ª faixa (7,5%) quando o valor não passa dela', () => {
    expect(calcularInss(1000)).toBe(75) // 1000 * 0.075
  })

  it('é progressivo: cada faixa tributa só a parte dentro dela', () => {
    // 1412*0.075 + (2666.68-1412)*0.09 + (3000-2666.68)*0.12
    const esperado = 1412 * 0.075 + (2666.68 - 1412) * 0.09 + (3000 - 2666.68) * 0.12
    expect(calcularInss(3000)).toBeCloseTo(esperado, 2)
  })

  it('não tributa acima do teto da última faixa', () => {
    expect(calcularInss(20000)).toBe(calcularInss(7786.02))
  })
})

describe('calcularIrrf', () => {
  it('é isento abaixo do limite mínimo', () => {
    expect(calcularIrrf(2000)).toBe(0)
    expect(calcularIrrf(2259.20)).toBe(0)
  })

  it('aplica alíquota efetiva com parcela a deduzir na 2ª faixa', () => {
    expect(calcularIrrf(2500)).toBeCloseTo(2500 * 0.075 - 169.44, 2)
  })

  it('nunca devolve valor negativo mesmo perto do limite da faixa', () => {
    expect(calcularIrrf(2259.21)).toBeGreaterThanOrEqual(0)
  })
})

describe('calcularHolerite', () => {
  const ENTRADA_BASE = {
    salarioBase: 2500,
    horasPorDia: 6,
    diasEscalaNoMes: 18,
    faltas: 0,
    horasExtras: 0,
    horasForaEscala: 0,
    diasTrabalhados: 18
  }

  it('sem faltas/extras: salário integral, VR proporcional aos dias trabalhados, VA fixo', () => {
    const resultado = calcularHolerite(ENTRADA_BASE)
    expect(resultado.salarioProporcional).toBe(2500)
    expect(resultado.valorVr).toBe(18 * VALOR_VR_POR_DIA)
    expect(resultado.valorVa).toBe(VALOR_VA_MENSAL)
    expect(resultado.valorHorasExtras).toBe(0)
    expect(resultado.valorHorasForaEscala).toBe(0)
  })

  it('desconta proporcionalmente o valor de cada falta não abonada', () => {
    const resultado = calcularHolerite({ ...ENTRADA_BASE, faltas: 2 })
    const valorPorDia = 2500 / 18
    expect(resultado.salarioProporcional).toBeCloseTo(2500 - valorPorDia * 2, 2)
  })

  // Usa o valor-hora "cru" (não arredondado) pra comparar — resultado.valorHora
  // já vem arredondado a 2 casas pra exibição, e multiplicar o valor já
  // arredondado dá um resultado ligeiramente diferente do que a implementação
  // calcula internamente (que arredonda só uma vez, no fim).
  const VALOR_HORA_CRU = (ENTRADA_BASE.salarioBase / ENTRADA_BASE.diasEscalaNoMes) / ENTRADA_BASE.horasPorDia

  it('hora extra é paga pelo valor-hora normal', () => {
    const resultado = calcularHolerite({ ...ENTRADA_BASE, horasExtras: 4 })
    expect(resultado.valorHorasExtras).toBeCloseTo(VALOR_HORA_CRU * 4, 2)
  })

  it('hora fora da escala é paga em dobro (100% de adicional)', () => {
    const resultado = calcularHolerite({ ...ENTRADA_BASE, horasForaEscala: 3 })
    expect(resultado.valorHorasForaEscala).toBeCloseTo(VALOR_HORA_CRU * 3 * 2, 2)
  })

  it('desconta INSS e IRRF, nunca VR/VA/benefícios', () => {
    const resultado = calcularHolerite(ENTRADA_BASE)
    expect(resultado.inss).toBeGreaterThan(0)
    // Salário líquido soma VR/VA sem desconto — se eles fossem tributados, o
    // líquido seria menor que salarioProporcional + VR + VA - inss - irrf.
    const esperado = resultado.salarioProporcional + resultado.valorVr + resultado.valorVa - resultado.inss - resultado.irrf
    expect(resultado.salarioLiquido).toBeCloseTo(esperado, 2)
  })

  it('salário líquido nunca conta duas vezes nem esquece nenhuma parcela', () => {
    const resultado = calcularHolerite({ ...ENTRADA_BASE, horasExtras: 2, horasForaEscala: 1, faltas: 1 })
    const somaEsperada =
      resultado.salarioProporcional +
      resultado.valorHorasExtras +
      resultado.valorHorasForaEscala +
      resultado.valorVr +
      resultado.valorVa -
      resultado.inss -
      resultado.irrf
    expect(resultado.salarioLiquido).toBeCloseTo(somaEsperada, 2)
  })
})
