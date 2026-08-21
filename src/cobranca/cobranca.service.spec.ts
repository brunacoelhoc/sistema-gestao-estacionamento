import { CobrancaService, TEMPO_TOLERANCIA_MINUTOS, VALOR_HORA_PADRAO } from './cobranca.service'

describe('CobrancaService', () => {
  const service = new CobrancaService()

  it('dentro da tolerância de cortesia não cobra nada', () => {
    const valor = service.calcularTarifaAvulsa(TEMPO_TOLERANCIA_MINUTOS, 20)
    expect(valor).toBe(0)
  })

  it('um minuto além da tolerância já cobra a primeira hora cheia', () => {
    const valor = service.calcularTarifaAvulsa(TEMPO_TOLERANCIA_MINUTOS + 1, 20)
    expect(valor).toBe(20)
  })

  it('hora quebrada é sempre arredondada para cima', () => {
    const valor = service.calcularTarifaAvulsa(61, 10)
    expect(valor).toBe(20)
  })

  it('permanência de exatas 2 horas cobra só 2 horas', () => {
    const valor = service.calcularTarifaAvulsa(120, 10)
    expect(valor).toBe(20)
  })

  it('sem valorHora informado, usa o valor padrão', () => {
    const valor = service.calcularTarifaAvulsa(90, undefined)
    expect(valor).toBe(2 * VALOR_HORA_PADRAO)
  })
})
