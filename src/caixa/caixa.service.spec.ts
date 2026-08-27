import { ConflictException, NotFoundException } from '@nestjs/common'
import { dataSemHora } from './caixa-datas.util'
import { CaixaService } from './caixa.service'

/**
 * Fake em memória do PrismaService: replica só os métodos que CaixaService
 * usa (caixaDiario.findUnique/create/update, ticket.aggregate), com
 * $transaction chamando o callback direto sobre o mesmo storage — mesmo
 * padrão de tickets.service.spec.ts.
 */
function criarPrismaFake (seed: { caixas?: any[], tickets?: any[] } = {}) {
  const caixas = seed.caixas ?? []
  const tickets = seed.tickets ?? []
  let proximoCaixaId = 1

  const modelos = {
    caixaDiario: {
      async findUnique ({ where: { id, data } }: any) {
        if (id) return caixas.find(c => c.id === id) ?? null
        return caixas.find(c => c.data.getTime() === data.getTime()) ?? null
      },
      async create ({ data }: any) {
        const caixa = { id: String(proximoCaixaId++), status: 'aberto', ...data }
        caixas.push(caixa)
        return caixa
      },
      async update ({ where: { id }, data }: any) {
        const caixa = caixas.find(c => c.id === id)
        Object.assign(caixa, data)
        return caixa
      }
    },
    ticket: {
      async aggregate ({ where }: any) {
        const bateData = (t: any) => t.dataSaida >= where.dataSaida.gte && t.dataSaida < where.dataSaida.lt
        const soma = tickets
          .filter(t => t.status === where.status && t.formaPagamento === where.formaPagamento && bateData(t))
          .reduce((acc, t) => acc + Number(t.valorTotal || 0), 0)
        return { _sum: { valorTotal: soma } }
      }
    }
  }

  return {
    ...modelos,
    caixas,
    tickets,
    async $transaction (fn: any) { return fn(modelos) }
  }
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  const prismaFake = criarPrismaFake(seed)
  const service = new CaixaService(prismaFake as any)
  return { service, prismaFake }
}

describe('CaixaService', () => {
  describe('verificarAbertoParaTicket', () => {
    it('recusa quando não existe caixa aberto para hoje', async () => {
      const { service, prismaFake } = criarService()
      await expect(service.verificarAbertoParaTicket(prismaFake as any)).rejects.toBeInstanceOf(ConflictException)
    })

    it('passa quando existe caixa aberto para hoje', async () => {
      const { service, prismaFake } = criarService({
        caixas: [{ id: 'c1', data: dataSemHora(new Date()), valorAbertura: 100, status: 'aberto' }]
      })
      await expect(service.verificarAbertoParaTicket(prismaFake as any)).resolves.toBeUndefined()
    })

    it('recusa quando o caixa de hoje já foi fechado', async () => {
      const { service, prismaFake } = criarService({
        caixas: [{ id: 'c1', data: dataSemHora(new Date()), valorAbertura: 100, status: 'fechado' }]
      })
      await expect(service.verificarAbertoParaTicket(prismaFake as any)).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('abrir', () => {
    it('cria o caixa do dia com o valor contado', async () => {
      const { service, prismaFake } = criarService()
      const caixa: any = await service.abrir({ valorAbertura: 150 }, 'user1')
      expect(caixa.valorAbertura).toBe(150)
      expect(caixa.abertoPorId).toBe('user1')
      expect(caixa.status).toBe('aberto')
      expect(prismaFake.caixas).toHaveLength(1)
    })

    it('recusa abrir de novo se o caixa de hoje já existe', async () => {
      const { service } = criarService({
        caixas: [{ id: 'c1', data: dataSemHora(new Date()), valorAbertura: 100, status: 'aberto' }]
      })
      await expect(service.abrir({ valorAbertura: 50 }, 'user1')).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('fechar', () => {
    it('recusa fechar caixa inexistente', async () => {
      const { service } = criarService()
      await expect(service.fechar('inexistente', { valorFechamento: 100 }, 'user1')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('recusa fechar um caixa que já está fechado', async () => {
      const { service } = criarService({
        caixas: [{ id: 'c1', data: dataSemHora(new Date()), valorAbertura: 100, status: 'fechado' }]
      })
      await expect(service.fechar('c1', { valorFechamento: 100 }, 'user1')).rejects.toBeInstanceOf(ConflictException)
    })

    it('calcula o valor esperado (abertura + dinheiro recebido hoje) e a diferença', async () => {
      const hoje = dataSemHora(new Date())
      const { service, prismaFake } = criarService({
        caixas: [{ id: 'c1', data: hoje, valorAbertura: 100, status: 'aberto' }],
        tickets: [
          { status: 'fechado', formaPagamento: 'dinheiro', valorTotal: 30, dataSaida: new Date() },
          { status: 'fechado', formaPagamento: 'dinheiro', valorTotal: 20, dataSaida: new Date() },
          // PIX não entra na conta (não movimenta a gaveta física)
          { status: 'fechado', formaPagamento: 'pix', valorTotal: 1000, dataSaida: new Date() },
          // Ticket ainda aberto não entra na conta
          { status: 'aberto', formaPagamento: null, valorTotal: null, dataSaida: null }
        ]
      })

      const resultado: any = await service.fechar('c1', { valorFechamento: 160 }, 'user1')

      expect(resultado.valorEsperadoFechamento).toBe(150) // 100 + 30 + 20
      expect(resultado.diferenca).toBe(10) // 160 contado - 150 esperado (sobra)
      expect(resultado.status).toBe('fechado')
      expect(resultado.fechadoPorId).toBe('user1')
      expect(prismaFake.caixas[0].status).toBe('fechado')
    })
  })
})
