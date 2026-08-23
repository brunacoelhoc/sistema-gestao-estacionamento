import { DashboardService } from './dashboard.service'

function criarPrismaFake (seed: { vagas?: any[], tickets?: any[] } = {}) {
  const vagas = seed.vagas ?? []
  // Cada ticket pode carregar `vagaTipo` — o fake usa isso pra simular o
  // filtro real `where: { vaga: { tipo } } }`, que no Postgres de verdade é
  // resolvido via join pela FK vagaId.
  const tickets = seed.tickets ?? []

  return {
    vaga: {
      async findMany () { return vagas }
    },
    ticket: {
      async findMany ({ where }: any) {
        if (!where?.vaga?.tipo) return tickets
        return tickets.filter(t => t.vagaTipo === where.vaga.tipo)
      },
      async groupBy ({ by }: any) {
        if (by[0] !== 'vagaId') throw new Error('groupBy fake só suporta by: ["vagaId"]')
        const contagem = new Map<string, number>()
        tickets.forEach(t => { if (t.vagaId) contagem.set(t.vagaId, (contagem.get(t.vagaId) ?? 0) + 1) })
        return Array.from(contagem, ([vagaId, count]) => ({ vagaId, _count: { vagaId: count } }))
      }
    }
  }
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  const prismaFake = criarPrismaFake(seed)
  const service = new DashboardService(prismaFake as any)
  return { service, prismaFake }
}

describe('DashboardService', () => {
  describe('calcularKpis', () => {
    it('conta vagas por status e calcula a taxa de ocupação sem filtro de tipo', async () => {
      const { service } = criarService({
        vagas: [
          { tipo: 'comum', status: 'livre' },
          { tipo: 'comum', status: 'ocupada' },
          { tipo: 'coberta', status: 'ocupada' },
          { tipo: 'coberta', status: 'manutencao' }
        ]
      })

      const kpis = await service.calcularKpis()

      expect(kpis.vagasLivres).toBe(1)
      expect(kpis.vagasOcupadas).toBe(2)
      expect(kpis.vagasManutencao).toBe(1)
      expect(kpis.totalVagas).toBe(4)
      expect(kpis.totalVagasFiltradas).toBe(4)
      expect(kpis.taxaOcupacao).toBe(50)
    })

    it('filtro por tipo restringe os cartões, mas totalVagas continua sendo o total geral', async () => {
      const { service } = criarService({
        vagas: [
          { tipo: 'comum', status: 'livre' },
          { tipo: 'comum', status: 'ocupada' },
          { tipo: 'coberta', status: 'ocupada' }
        ]
      })

      const kpis = await service.calcularKpis('comum')

      expect(kpis.totalVagas).toBe(3) // geral, sem filtro
      expect(kpis.totalVagasFiltradas).toBe(2) // só "comum"
      expect(kpis.vagasOcupadas).toBe(1)
    })

    it('"todos" é tratado como ausência de filtro', async () => {
      const { service } = criarService({
        vagas: [{ tipo: 'comum', status: 'livre' }, { tipo: 'coberta', status: 'ocupada' }]
      })
      const kpis = await service.calcularKpis('todos')
      expect(kpis.totalVagasFiltradas).toBe(2)
    })

    it('agrupa vagas livres/ocupadas/manutenção por tipo', async () => {
      const { service } = criarService({
        vagas: [
          { tipo: 'comum', status: 'livre' },
          { tipo: 'comum', status: 'livre' },
          { tipo: 'coberta', status: 'livre' }
        ]
      })
      const kpis = await service.calcularKpis()
      expect(kpis.porTipoLivres).toEqual({ comum: 2, coberta: 1 })
    })

    it('faturamento e ticket médio só consideram tickets fechados', async () => {
      const { service } = criarService({
        vagas: [{ tipo: 'comum', status: 'ocupada' }],
        tickets: [
          { status: 'fechado', valorTotal: 20, dataEntrada: new Date(2026, 0, 1, 10), dataSaida: new Date(2026, 0, 1, 12) },
          { status: 'fechado', valorTotal: 30, dataEntrada: new Date(2026, 0, 1, 10), dataSaida: new Date(2026, 0, 1, 11) },
          { status: 'aberto', valorTotal: null, dataEntrada: new Date(), dataSaida: null }
        ]
      })

      const kpis = await service.calcularKpis()

      expect(kpis.ticketsAbertosQtd).toBe(1)
      expect(kpis.ticketsFechadosQtd).toBe(2)
      expect(kpis.faturamentoTotal).toBe(50)
      expect(kpis.ticketMedio).toBe(25)
    })

    it('tempo médio de permanência é calculado só sobre tickets fechados com entrada e saída válidas', async () => {
      const { service } = criarService({
        vagas: [],
        tickets: [
          { status: 'fechado', valorTotal: 10, dataEntrada: new Date(2026, 0, 1, 10, 0), dataSaida: new Date(2026, 0, 1, 11, 0) },
          { status: 'fechado', valorTotal: 10, dataEntrada: new Date(2026, 0, 1, 10, 0), dataSaida: new Date(2026, 0, 1, 12, 0) }
        ]
      })

      const kpis = await service.calcularKpis()

      expect(kpis.tempoMedioMinutos).toBe(90) // média entre 60min e 120min
      expect(kpis.tempoMedioAmostraQtd).toBe(2)
    })

    it('tempo médio é null quando não há nenhum ticket fechado', async () => {
      const { service } = criarService({ vagas: [], tickets: [] })
      const kpis = await service.calcularKpis()
      expect(kpis.tempoMedioMinutos).toBeNull()
    })
  })

  describe('calcularRankingVagas', () => {
    it('ordena por uso decrescente e atribui posição, incluindo vagas sem nenhum ticket', async () => {
      const { service } = criarService({
        vagas: [
          { id: 'v1', codigo: 'A1', tipo: 'comum' },
          { id: 'v2', codigo: 'A2', tipo: 'comum' },
          { id: 'v3', codigo: 'A3', tipo: 'coberta' }
        ],
        tickets: [
          { vagaId: 'v2' }, { vagaId: 'v2' }, { vagaId: 'v2' },
          { vagaId: 'v1' }
        ]
      })

      const ranking = await service.calcularRankingVagas()

      expect(ranking.map(r => r.id)).toEqual(['v2', 'v1', 'v3'])
      expect(ranking[0].totalUso).toBe(3)
      expect(ranking[0].posicao).toBe(1)
      expect(ranking[2].totalUso).toBe(0) // v3 nunca foi usada
    })
  })
})
