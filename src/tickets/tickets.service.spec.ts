import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { CobrancaService } from '../cobranca/cobranca.service'
import { MensalidadeCicloService } from '../mensalidade-ciclo/mensalidade-ciclo.service'
import { TicketsService } from './tickets.service'

/**
 * Fake em memória do PrismaService: replica só os métodos que TicketsService
 * usa (findFirst/findUnique/create/update/delete), com $transaction apenas
 * chamando o callback com o mesmo storage — não simula rollback real, o que
 * não importa pra testar a lógica de negócio isoladamente.
 */
function criarPrismaFake (seed: {
  vagas?: any[]
  tickets?: any[]
  mensalistas?: any[]
  tarifas?: any[]
  mensalidades?: any[]
} = {}) {
  const vagas = seed.vagas ?? []
  const tickets = seed.tickets ?? []
  const mensalistas = seed.mensalistas ?? []
  const tarifas = seed.tarifas ?? []
  const mensalidades = seed.mensalidades ?? []
  let proximoTicketId = 1
  let proximaMensalidadeId = 1

  const bateFiltro = (registro: any, where: any) =>
    Object.entries(where).every(([campo, valor]) => registro[campo] === valor)

  const modelos = {
    vaga: {
      async findUnique ({ where: { id } }: any) { return vagas.find(v => v.id === id) ?? null },
      async update ({ where: { id }, data }: any) {
        const vaga = vagas.find(v => v.id === id)
        Object.assign(vaga, data)
        return vaga
      }
    },
    ticket: {
      async findFirst ({ where }: any) { return tickets.find(t => bateFiltro(t, where)) ?? null },
      async findUnique ({ where: { id }, include }: any) {
        const ticket = tickets.find(t => t.id === id) ?? null
        if (!ticket || !include) return ticket
        return {
          ...ticket,
          ...(include.vaga ? { vaga: vagas.find(v => v.id === ticket.vagaId) ?? null } : {}),
          ...(include.mensalista
            ? { mensalista: ticket.mensalistaId ? (mensalistas.find(m => m.id === ticket.mensalistaId) ?? null) : null }
            : {})
        }
      },
      async create ({ data }: any) {
        const ticket = {
          id: String(proximoTicketId++),
          dataEntrada: new Date(),
          dataSaida: null,
          valorTotal: null,
          formaPagamento: null,
          ...data
        }
        tickets.push(ticket)
        return ticket
      },
      async update ({ where: { id }, data }: any) {
        const ticket = tickets.find(t => t.id === id)
        Object.assign(ticket, data)
        return ticket
      },
      async delete ({ where: { id } }: any) {
        const indice = tickets.findIndex(t => t.id === id)
        if (indice === -1) throw new Error('Ticket não encontrado.')
        tickets.splice(indice, 1)
      }
    },
    mensalista: {
      async findFirst ({ where }: any) { return mensalistas.find(m => bateFiltro(m, where)) ?? null },
      async findUnique ({ where: { id } }: any) { return mensalistas.find(m => m.id === id) ?? null }
    },
    tarifa: {
      async findUnique ({ where: { id } }: any) { return tarifas.find(t => t.id === id) ?? null },
      async findFirst () { return tarifas[0] ?? null }
    },
    // Só o suficiente pra MensalidadeCicloService (usada como instância real
    // aqui, não mockada) buscar/abrir ciclo dentro da mesma transação.
    mensalidade: {
      async findFirst ({ where: { mensalistaId, dataFim } }: any) {
        return mensalidades
          .filter(m => m.mensalistaId === mensalistaId && m.dataFim >= dataFim.gte)
          .sort((a, b) => b.dataInicio - a.dataInicio)[0] ?? null
      },
      async create ({ data }: any) {
        const registro = { id: String(proximaMensalidadeId++), ...data }
        mensalidades.push(registro)
        return registro
      }
    }
  }

  return {
    ...modelos,
    vagas,
    tickets,
    mensalistas,
    mensalidades,
    async $transaction (fn: any) { return fn(modelos) }
  }
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  const prismaFake = criarPrismaFake(seed)
  const emailServiceFake = { enviarComprovanteTicket: jest.fn() }
  const service = new TicketsService(
    prismaFake as any,
    new CobrancaService(),
    new MensalidadeCicloService(),
    emailServiceFake as any
  )
  return { service, prismaFake, emailServiceFake }
}

describe('TicketsService', () => {
  describe('abrir', () => {
    it('cria o ticket com a placa normalizada e marca a vaga como ocupada', async () => {
      const { service, prismaFake } = criarService({ vagas: [{ id: 'v1', status: 'livre' }] })

      const ticket: any = await service.abrir({ placa: 'abc1234', vagaId: 'v1' } as any)

      expect(ticket.placa).toBe('ABC1234')
      expect(ticket.status).toBe('aberto')
      expect(prismaFake.vagas[0].status).toBe('ocupada')
    })

    it('recusa quando a vaga não existe', async () => {
      const { service } = criarService({ vagas: [] })
      await expect(service.abrir({ placa: 'ABC1234', vagaId: 'inexistente' } as any))
        .rejects.toBeInstanceOf(ConflictException)
    })

    it('recusa quando a vaga não está livre', async () => {
      const { service } = criarService({ vagas: [{ id: 'v1', status: 'ocupada' }] })
      await expect(service.abrir({ placa: 'ABC1234', vagaId: 'v1' } as any))
        .rejects.toBeInstanceOf(ConflictException)
    })

    it('recusa quando a placa já tem um ticket aberto', async () => {
      const { service } = criarService({
        vagas: [{ id: 'v1', status: 'livre' }],
        tickets: [{ id: 't1', placa: 'ABC1234', status: 'aberto', vagaId: 'v0', dataEntrada: new Date() }]
      })
      await expect(service.abrir({ placa: 'ABC1234', vagaId: 'v1' } as any))
        .rejects.toBeInstanceOf(ConflictException)
    })

    it('resolve o mensalista automaticamente pela placa quando não vem no dto', async () => {
      const { service } = criarService({
        vagas: [{ id: 'v1', status: 'livre' }],
        mensalistas: [{ id: 'm1', placa: 'ABC1234', ativo: true }]
      })
      const ticket: any = await service.abrir({ placa: 'ABC1234', vagaId: 'v1' } as any)
      expect(ticket.mensalistaId).toBe('m1')
    })

    it('não resolve mensalista inativo com a mesma placa', async () => {
      const { service } = criarService({
        vagas: [{ id: 'v1', status: 'livre' }],
        mensalistas: [{ id: 'm1', placa: 'ABC1234', ativo: false }]
      })
      const ticket: any = await service.abrir({ placa: 'ABC1234', vagaId: 'v1' } as any)
      expect(ticket.mensalistaId).toBeNull()
    })
  })

  describe('fechar', () => {
    it('recusa fechar um ticket inexistente ou já fechado', async () => {
      const { service } = criarService({
        tickets: [{ id: 't1', status: 'fechado', vagaId: 'v1', dataEntrada: new Date() }]
      })
      await expect(service.fechar('t1', {})).rejects.toBeInstanceOf(ConflictException)
      await expect(service.fechar('inexistente', {})).rejects.toBeInstanceOf(ConflictException)
    })

    it('ticket avulso dentro da tolerância fecha sem cobrar e libera a vaga', async () => {
      const dataEntrada = new Date(Date.now() - 5 * 60 * 1000) // 5 minutos atrás
      const { service, prismaFake } = criarService({
        vagas: [{ id: 'v1', status: 'ocupada' }],
        tickets: [{ id: 't1', status: 'aberto', vagaId: 'v1', dataEntrada, mensalistaId: null, tarifaId: null }],
        tarifas: [{ id: 'tar1', valorHora: 10 }]
      })

      const resultado: any = await service.fechar('t1', { formaPagamento: 'pix' })

      expect(resultado.valorTotal).toBe(0)
      expect(resultado.status).toBe('fechado')
      expect(prismaFake.vagas[0].status).toBe('livre')
    })

    it('ticket avulso fora da tolerância cobra pela tarifa (hora arredondada pra cima)', async () => {
      const dataEntrada = new Date(Date.now() - 90 * 60 * 1000) // 90 minutos atrás
      const { service } = criarService({
        vagas: [{ id: 'v1', status: 'ocupada' }],
        tickets: [{ id: 't1', status: 'aberto', vagaId: 'v1', dataEntrada, mensalistaId: null, tarifaId: 'tar1' }],
        tarifas: [{ id: 'tar1', valorHora: 10 }]
      })

      const resultado: any = await service.fechar('t1', { formaPagamento: 'dinheiro' })

      expect(resultado.valorTotal).toBe(20) // 2 horas x R$10
      expect(resultado.formaPagamento).toBe('dinheiro')
    })

    it('mensalista ativo sem ciclo vigente cobra o ciclo inteiro e o abre a partir da entrada', async () => {
      const dataEntrada = new Date(2026, 7, 5)
      const { service, prismaFake } = criarService({
        vagas: [{ id: 'v1', status: 'ocupada' }],
        tickets: [{ id: 't1', status: 'aberto', vagaId: 'v1', dataEntrada, mensalistaId: 'm1', tarifaId: null }],
        mensalistas: [{ id: 'm1', ativo: true, valorMensalidade: 300 }]
      })

      const resultado: any = await service.fechar('t1', { formaPagamento: 'pix' })

      expect(resultado.valorTotal).toBe(300)
      expect(resultado.formaPagamento).toBe('pix')
      expect(resultado.mensalistaCiclo.cobradoAgora).toBe(true)
      expect(prismaFake.mensalidades).toHaveLength(1)
      expect(prismaFake.mensalidades[0].mensalistaId).toBe('m1')
    })

    it('mensalista ativo com ciclo vigente fecha isento e não cria uma nova cobrança', async () => {
      const dataEntrada = new Date(2026, 7, 20)
      const { service } = criarService({
        vagas: [{ id: 'v1', status: 'ocupada' }],
        tickets: [{ id: 't1', status: 'aberto', vagaId: 'v1', dataEntrada, mensalistaId: 'm1', tarifaId: null }],
        mensalistas: [{ id: 'm1', ativo: true, valorMensalidade: 300 }],
        mensalidades: [{
          id: 'mv1',
          mensalistaId: 'm1',
          dataInicio: new Date(2026, 7, 1),
          dataFim: new Date(2026, 7, 31),
          status: 'paga'
        }]
      })

      const resultado: any = await service.fechar('t1', {})

      expect(resultado.valorTotal).toBe(0)
      expect(resultado.formaPagamento).toBe('isento')
      expect(resultado.mensalistaCiclo.cobradoAgora).toBe(false)
    })

    it('ticket avulso em vaga coberta cobra a tarifa com o acréscimo de R$3,00/hora', async () => {
      const dataEntrada = new Date(Date.now() - 90 * 60 * 1000) // 90 minutos atrás
      const { service } = criarService({
        vagas: [{ id: 'v1', status: 'ocupada', tipo: 'coberta' }],
        tickets: [{ id: 't1', status: 'aberto', vagaId: 'v1', dataEntrada, mensalistaId: null, tarifaId: 'tar1' }],
        tarifas: [{ id: 'tar1', valorHora: 7 }]
      })

      const resultado: any = await service.fechar('t1', { formaPagamento: 'dinheiro' })

      expect(resultado.valorTotal).toBe(20) // 2 horas x (R$7 + R$3)
    })

    it('mensalista inativo é cobrado como avulso, não como mensalista', async () => {
      const dataEntrada = new Date(Date.now() - 90 * 60 * 1000)
      const { service } = criarService({
        vagas: [{ id: 'v1', status: 'ocupada' }],
        tickets: [{ id: 't1', status: 'aberto', vagaId: 'v1', dataEntrada, mensalistaId: 'm1', tarifaId: 'tar1' }],
        mensalistas: [{ id: 'm1', ativo: false, valorMensalidade: 300 }],
        tarifas: [{ id: 'tar1', valorHora: 10 }]
      })

      const resultado: any = await service.fechar('t1', {})

      expect(resultado.valorTotal).toBe(20)
      expect(resultado.mensalistaCiclo).toBeNull()
    })
  })

  describe('enviarComprovanteEmail', () => {
    it('recusa ticket inexistente', async () => {
      const { service } = criarService()
      await expect(service.enviarComprovanteEmail('inexistente')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('recusa ticket ainda aberto', async () => {
      const { service } = criarService({
        vagas: [{ id: 'v1', codigo: 'A1' }],
        tickets: [{ id: 't1', status: 'aberto', vagaId: 'v1', dataEntrada: new Date(), dataSaida: null, mensalistaId: 'm1' }],
        mensalistas: [{ id: 'm1', nome: 'Fulano', email: 'fulano@example.com' }]
      })
      await expect(service.enviarComprovanteEmail('t1')).rejects.toBeInstanceOf(BadRequestException)
    })

    it('recusa ticket avulso (sem mensalista vinculado)', async () => {
      const { service } = criarService({
        vagas: [{ id: 'v1', codigo: 'A1' }],
        tickets: [{
          id: 't1', status: 'fechado', vagaId: 'v1', dataEntrada: new Date(), dataSaida: new Date(), mensalistaId: null
        }]
      })
      await expect(service.enviarComprovanteEmail('t1')).rejects.toBeInstanceOf(BadRequestException)
    })

    it('recusa mensalista sem e-mail cadastrado', async () => {
      const { service } = criarService({
        vagas: [{ id: 'v1', codigo: 'A1' }],
        tickets: [{
          id: 't1', status: 'fechado', vagaId: 'v1', dataEntrada: new Date(), dataSaida: new Date(), mensalistaId: 'm1'
        }],
        mensalistas: [{ id: 'm1', nome: 'Fulano', email: null }]
      })
      await expect(service.enviarComprovanteEmail('t1')).rejects.toBeInstanceOf(BadRequestException)
    })

    it('envia o comprovante para o e-mail do mensalista vinculado', async () => {
      const { service, emailServiceFake } = criarService({
        vagas: [{ id: 'v1', codigo: 'A1' }],
        tickets: [{
          id: 't1',
          status: 'fechado',
          vagaId: 'v1',
          dataEntrada: new Date(Date.now() - 60 * 60 * 1000),
          dataSaida: new Date(),
          valorTotal: 300,
          formaPagamento: 'isento',
          mensalistaId: 'm1'
        }],
        mensalistas: [{ id: 'm1', nome: 'Fulano', email: 'fulano@example.com' }]
      })

      const resultado = await service.enviarComprovanteEmail('t1')

      expect(resultado).toEqual({ enviado: true })
      expect(emailServiceFake.enviarComprovanteTicket).toHaveBeenCalledTimes(1)
      const chamada = emailServiceFake.enviarComprovanteTicket.mock.calls[0][0]
      expect(chamada.to).toBe('fulano@example.com')
      expect(chamada.ticketId).toBe('t1')
      expect(Buffer.isBuffer(chamada.anexoPdf)).toBe(true)
    })
  })

  describe('remover', () => {
    it('remove o ticket pelo id', async () => {
      const { service, prismaFake } = criarService({ tickets: [{ id: 't1', status: 'fechado' }] })
      await service.remover('t1')
      expect(prismaFake.tickets.find((t: any) => t.id === 't1')).toBeUndefined()
    })
  })
})
