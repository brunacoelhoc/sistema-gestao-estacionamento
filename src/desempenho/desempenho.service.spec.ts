import { DesempenhoService } from './desempenho.service'

function criarPrismaFake (seed: { tickets?: any[], usuarios?: any[] } = {}) {
  const tickets = seed.tickets ?? []
  const usuarios = seed.usuarios ?? []

  function passaFiltro (t: any, where: any) {
    if (where.status && t.status !== where.status) return false
    if (where.atendidoPorId?.not === null && t.atendidoPorId === null) return false
    if (where.dataSaida) {
      if (where.dataSaida.gte && t.dataSaida < where.dataSaida.gte) return false
      if (where.dataSaida.lt && t.dataSaida >= where.dataSaida.lt) return false
    }
    return true
  }

  return {
    ticket: {
      async groupBy ({ by, where }: any) {
        const filtrados = tickets.filter((t: any) => passaFiltro(t, where))
        const contagem = new Map<string, number>()
        for (const t of filtrados) {
          const chave = t[by[0]]
          contagem.set(chave, (contagem.get(chave) || 0) + 1)
        }
        return Array.from(contagem.entries()).map(([atendidoPorId, count]) => ({
          atendidoPorId,
          _count: { _all: count }
        }))
      }
    },
    usuario: {
      async findMany ({ where }: any) {
        return usuarios.filter((u: any) => where.id.in.includes(u.id))
      }
    }
  }
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  const prismaFake = criarPrismaFake(seed)
  const service = new DesempenhoService(prismaFake as any)
  return { service }
}

describe('DesempenhoService', () => {
  describe('relatorio', () => {
    it('conta só tickets fechados com atendidoPorId preenchido', async () => {
      const { service } = criarService({
        tickets: [
          { status: 'fechado', atendidoPorId: 'u1', dataSaida: new Date(2026, 7, 10) },
          { status: 'fechado', atendidoPorId: 'u1', dataSaida: new Date(2026, 7, 11) },
          { status: 'aberto', atendidoPorId: null, dataSaida: null },
          { status: 'fechado', atendidoPorId: null, dataSaida: new Date(2026, 7, 12) }
        ],
        usuarios: [{ id: 'u1', nome: 'Fulano' }]
      })

      const resultado = await service.relatorio()

      expect(resultado).toEqual([{ usuarioId: 'u1', nome: 'Fulano', totalAtendimentos: 2 }])
    })

    it('ordena do maior para o menor número de atendimentos', async () => {
      const { service } = criarService({
        tickets: [
          { status: 'fechado', atendidoPorId: 'u1', dataSaida: new Date(2026, 7, 10) },
          { status: 'fechado', atendidoPorId: 'u2', dataSaida: new Date(2026, 7, 10) },
          { status: 'fechado', atendidoPorId: 'u2', dataSaida: new Date(2026, 7, 11) },
          { status: 'fechado', atendidoPorId: 'u2', dataSaida: new Date(2026, 7, 12) }
        ],
        usuarios: [{ id: 'u1', nome: 'Fulano' }, { id: 'u2', nome: 'Ciclana' }]
      })

      const resultado = await service.relatorio()

      expect(resultado.map(r => r.usuarioId)).toEqual(['u2', 'u1'])
    })

    it('filtra por referência (mês) quando informada', async () => {
      const { service } = criarService({
        tickets: [
          { status: 'fechado', atendidoPorId: 'u1', dataSaida: new Date(2026, 6, 15) }, // julho
          { status: 'fechado', atendidoPorId: 'u1', dataSaida: new Date(2026, 7, 15) } // agosto
        ],
        usuarios: [{ id: 'u1', nome: 'Fulano' }]
      })

      const resultado = await service.relatorio('2026-08')

      expect(resultado).toEqual([{ usuarioId: 'u1', nome: 'Fulano', totalAtendimentos: 1 }])
    })

    it('sem nenhum atendimento devolve lista vazia', async () => {
      const { service } = criarService()
      expect(await service.relatorio()).toEqual([])
    })
  })
})
