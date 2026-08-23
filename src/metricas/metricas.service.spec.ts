import { MetricasService } from './metricas.service'

function referenciaDe (data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

function criarPrismaFake (seed: { tickets?: any[], mensalidades?: any[], mensalistas?: any[], vagas?: any[] } = {}) {
  return {
    ticket: { async findMany () { return seed.tickets ?? [] } },
    mensalidade: { async findMany () { return seed.mensalidades ?? [] } },
    mensalista: { async findMany () { return seed.mensalistas ?? [] } },
    vaga: { async findMany () { return seed.vagas ?? [] } }
  }
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  return new MetricasService(criarPrismaFake(seed) as any)
}

// Dia 15 evita qualquer problema de "mês sem esse dia" (ex.: 31 de fev).
function diaNoMes (offsetMeses: number): Date {
  const agora = new Date()
  return new Date(agora.getFullYear(), agora.getMonth() + offsetMeses, 15)
}

describe('MetricasService', () => {
  describe('período', () => {
    it('"mes_atual" só considera tickets fechados dentro do mês corrente', async () => {
      const esteMes = diaNoMes(0)
      const mesPassado = diaNoMes(-1)
      const service = criarService({
        tickets: [
          { status: 'fechado', dataEntrada: esteMes, dataSaida: esteMes, valorTotal: 50, formaPagamento: 'pix', mensalistaId: null },
          { status: 'fechado', dataEntrada: mesPassado, dataSaida: mesPassado, valorTotal: 999, formaPagamento: 'pix', mensalistaId: null }
        ]
      })

      const resultado = await service.calcular('mes_atual')

      expect(resultado.kpis.totalAtendimentos).toBe(1)
      expect(resultado.kpis.receitaTickets).toBe(50)
    })

    it('"todos" considera o histórico inteiro, sem filtro de data', async () => {
      const esteMes = diaNoMes(0)
      const mesPassado = diaNoMes(-1)
      const service = criarService({
        tickets: [
          { status: 'fechado', dataEntrada: esteMes, dataSaida: esteMes, valorTotal: 50, formaPagamento: 'pix', mensalistaId: null },
          { status: 'fechado', dataEntrada: mesPassado, dataSaida: mesPassado, valorTotal: 999, formaPagamento: 'pix', mensalistaId: null }
        ]
      })

      const resultado = await service.calcular('todos')

      expect(resultado.kpis.totalAtendimentos).toBe(2)
      expect(resultado.kpis.receitaTickets).toBe(1049)
    })
  })

  it('receitaTotal é a soma de tickets fechados + mensalidades no período', async () => {
    const hoje = diaNoMes(0)
    const service = criarService({
      tickets: [{ status: 'fechado', dataEntrada: hoje, dataSaida: hoje, valorTotal: 100, formaPagamento: 'pix', mensalistaId: null }],
      mensalidades: [{ valor: 300, dataFim: hoje, referencia: referenciaDe(hoje) }]
    })

    const resultado = await service.calcular('mes_atual')

    expect(resultado.kpis.receitaTickets).toBe(100)
    expect(resultado.kpis.receitaMensalidades).toBe(300)
    expect(resultado.kpis.receitaTotal).toBe(400)
  })

  it('tempo médio de permanência formata como "Xh Ym"', async () => {
    const hoje = diaNoMes(0)
    const entrada = new Date(hoje)
    entrada.setHours(10, 0, 0, 0)
    const saida1 = new Date(entrada.getTime() + 90 * 60 * 1000) // 1h30
    const saida2 = new Date(entrada.getTime() + 30 * 60 * 1000) // 0h30

    const service = criarService({
      tickets: [
        { status: 'fechado', dataEntrada: entrada, dataSaida: saida1, valorTotal: 10, formaPagamento: 'pix', mensalistaId: null },
        { status: 'fechado', dataEntrada: entrada, dataSaida: saida2, valorTotal: 10, formaPagamento: 'pix', mensalistaId: null }
      ]
    })

    const resultado = await service.calcular('todos')

    expect(resultado.kpis.tempoMedioPermanencia).toBe('1h 0m') // média de 60min
  })

  it('conta mensalistas ativos e inativos', async () => {
    const service = criarService({
      mensalistas: [{ id: 'm1', ativo: true }, { id: 'm2', ativo: true }, { id: 'm3', ativo: false }]
    })
    const resultado = await service.calcular('todos')
    expect(resultado.kpis.totalMensalistas).toBe(3)
    expect(resultado.kpis.mensalistasAtivos).toBe(2)
    expect(resultado.kpis.mensalistasInativos).toBe(1)
  })

  describe('gráfico de meios de pagamento', () => {
    it('classifica ticket de mensalista sem forma de pagamento como isento', async () => {
      const hoje = diaNoMes(0)
      // valorTotal não-zero de propósito: o objetivo aqui é testar em qual
      // balde a classificação cai, e somar zero seria indistinguível de não
      // ter caído em balde nenhum (na prática um ticket isento sempre fecha
      // com valorTotal 0 — ver TicketsService.fechar — mas essa função
      // classifica só por formaPagamento/mensalistaId, sem saber disso).
      const service = criarService({
        tickets: [{ status: 'fechado', dataEntrada: hoje, dataSaida: hoje, valorTotal: 50, formaPagamento: null, mensalistaId: 'm1' }]
      })
      const resultado = await service.calcular('mes_atual')
      expect(resultado.graficos.meiosPagamento.isento).toBe(50)
      expect(resultado.graficos.meiosPagamento.pix).toBe(0)
    })

    it('ticket avulso sem forma de pagamento cai no fallback pix', async () => {
      const hoje = diaNoMes(0)
      const service = criarService({
        tickets: [{ status: 'fechado', dataEntrada: hoje, dataSaida: hoje, valorTotal: 25, formaPagamento: null, mensalistaId: null }]
      })
      const resultado = await service.calcular('mes_atual')
      expect(resultado.graficos.meiosPagamento.pix).toBe(25)
    })

    it('soma corretamente por forma de pagamento explícita', async () => {
      const hoje = diaNoMes(0)
      const service = criarService({
        tickets: [
          { status: 'fechado', dataEntrada: hoje, dataSaida: hoje, valorTotal: 10, formaPagamento: 'cartao_credito', mensalistaId: null },
          { status: 'fechado', dataEntrada: hoje, dataSaida: hoje, valorTotal: 20, formaPagamento: 'dinheiro', mensalistaId: null }
        ]
      })
      const resultado = await service.calcular('mes_atual')
      expect(resultado.graficos.meiosPagamento.cartaoCredito).toBe(10)
      expect(resultado.graficos.meiosPagamento.dinheiro).toBe(20)
    })
  })

  it('gráfico de categorias soma vagas ocupadas e total por tipo', async () => {
    const service = criarService({
      vagas: [
        { tipo: 'comum', status: 'ocupada' },
        { tipo: 'comum', status: 'livre' },
        { tipo: 'coberta', status: 'ocupada' }
      ]
    })
    const resultado = await service.calcular('todos')
    const porTipo = Object.fromEntries(resultado.graficos.categorias.map(c => [c.tipo, c]))
    expect(porTipo.COMUM).toEqual({ tipo: 'COMUM', ocupadas: 1, total: 2 })
    expect(porTipo.COBERTA).toEqual({ tipo: 'COBERTA', ocupadas: 1, total: 1 })
  })

  it('comparação com o mês anterior calcula a variação percentual', async () => {
    const esteMes = diaNoMes(0)
    const mesPassado = diaNoMes(-1)
    const service = criarService({
      tickets: [
        { status: 'fechado', dataEntrada: esteMes, dataSaida: esteMes, valorTotal: 150, formaPagamento: 'pix', mensalistaId: null },
        { status: 'fechado', dataEntrada: mesPassado, dataSaida: mesPassado, valorTotal: 100, formaPagamento: 'pix', mensalistaId: null }
      ]
    })

    const resultado = await service.calcular('todos')

    expect(resultado.kpis.comparacaoReceitaMesAnterior.receitaMesAtual).toBe(150)
    expect(resultado.kpis.comparacaoReceitaMesAnterior.receitaMesAnterior).toBe(100)
    expect(resultado.kpis.comparacaoReceitaMesAnterior.variacaoPercentual).toBe(50)
  })
})
