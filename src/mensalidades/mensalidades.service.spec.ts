import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { EmailService } from '../email/email.service'
import { MensalidadesService } from './mensalidades.service'

function referenciaAtual (data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

function criarPrismaFake (seed: { mensalistas?: any[], mensalidades?: any[] } = {}) {
  const mensalistas = seed.mensalistas ?? []
  const mensalidades = seed.mensalidades ?? []

  return {
    mensalidades,
    mensalista: {
      async findMany () { return mensalistas }
    },
    mensalidade: {
      async findMany ({ where }: any) {
        if (!where?.mensalistaId) return mensalidades
        return mensalidades.filter(m => m.mensalistaId === where.mensalistaId)
      },
      async findUnique ({ where: { id } }: any) { return mensalidades.find(m => m.id === id) ?? null },
      async update ({ where: { id }, data }: any) {
        const mensalidade = mensalidades.find(m => m.id === id)
        Object.assign(mensalidade, data)
        return mensalidade
      }
    }
  }
}

function criarEmailFake (): EmailService {
  return { enviarEmailLembreteCobranca: jest.fn().mockResolvedValue(undefined) } as unknown as EmailService
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  const prismaFake = criarPrismaFake(seed)
  const emailFake = criarEmailFake()
  const service = new MensalidadesService(prismaFake as any, emailFake)
  return { service, prismaFake, emailFake }
}

describe('MensalidadesService', () => {
  describe('calcularKpis', () => {
    it('MRR é a soma do valor do plano só dos mensalistas ativos', async () => {
      const { service } = criarService({
        mensalistas: [
          { id: 'm1', nome: 'A', placa: 'AAA0000', ativo: true, valorMensalidade: 300 },
          { id: 'm2', nome: 'B', placa: 'BBB1111', ativo: true, valorMensalidade: 200 },
          { id: 'm3', nome: 'C', placa: 'CCC2222', ativo: false, valorMensalidade: 500 }
        ]
      })

      const kpis = await service.calcularKpis()

      expect(kpis.mrr).toBe(500)
      expect(kpis.mensalistasAtivosQtd).toBe(2)
      expect(kpis.ticketMedio).toBe(250)
    })

    it('recebido no mês soma só cobranças pagas com referência no mês corrente', async () => {
      const referencia = referenciaAtual(new Date())
      const { service } = criarService({
        mensalistas: [{ id: 'm1', nome: 'A', placa: 'AAA0000', ativo: true, valorMensalidade: 300 }],
        mensalidades: [
          { id: 'mv1', mensalistaId: 'm1', status: 'paga', referencia, valor: 300, dataFim: new Date() },
          { id: 'mv2', mensalistaId: 'm1', status: 'pendente', referencia, valor: 300, dataFim: new Date() },
          { id: 'mv3', mensalistaId: 'm1', status: 'paga', referencia: '2000-01', valor: 999, dataFim: new Date(2000, 0, 31) }
        ]
      })

      const kpis = await service.calcularKpis()

      expect(kpis.recebidoNoMes).toBe(300)
      expect(kpis.recebidoNoMesQtd).toBe(1)
    })

    it('"sem ciclo ativo" pega mensalista sem nenhum ciclo pago e com ciclo já vencido', async () => {
      const hoje = new Date()
      const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000)
      const amanha = new Date(hoje.getTime() + 24 * 60 * 60 * 1000)

      const { service } = criarService({
        mensalistas: [
          { id: 'm1', nome: 'Sem ciclo nenhum', placa: 'AAA0000', ativo: true, valorMensalidade: 300 },
          { id: 'm2', nome: 'Ciclo vencido', placa: 'BBB1111', ativo: true, valorMensalidade: 300 },
          { id: 'm3', nome: 'Ciclo vigente', placa: 'CCC2222', ativo: true, valorMensalidade: 300 }
        ],
        mensalidades: [
          { id: 'mv1', mensalistaId: 'm2', status: 'paga', referencia: 'x', valor: 300, dataFim: ontem },
          { id: 'mv2', mensalistaId: 'm3', status: 'paga', referencia: 'x', valor: 300, dataFim: amanha }
        ]
      })

      const kpis = await service.calcularKpis()

      expect(kpis.semCicloAtivo).toBe(2)
      expect(kpis.semCicloLista.map(m => m.id).sort()).toEqual(['m1', 'm2'])
    })
  })

  describe('listar', () => {
    it('filtra por mensalistaId quando informado', async () => {
      const { service } = criarService({
        mensalidades: [
          { id: 'mv1', mensalistaId: 'm1' },
          { id: 'mv2', mensalistaId: 'm2' }
        ]
      })
      const resultado = await service.listar('m1')
      expect(resultado).toHaveLength(1)
      expect(resultado[0].id).toBe('mv1')
    })

    it('sem mensalistaId devolve tudo', async () => {
      const { service } = criarService({
        mensalidades: [{ id: 'mv1', mensalistaId: 'm1' }, { id: 'mv2', mensalistaId: 'm2' }]
      })
      expect(await service.listar()).toHaveLength(2)
    })
  })

  describe('atualizar', () => {
    it('grava motivoCancelamento só quando o status é cancelada', async () => {
      const { service, prismaFake } = criarService({
        mensalidades: [{ id: 'mv1', status: 'pendente', motivoCancelamento: null }]
      })

      await service.atualizar('mv1', { status: 'paga', formaPagamento: 'pix' } as any, 'user1')
      expect(prismaFake.mensalidades[0].motivoCancelamento).toBeNull()

      await service.atualizar('mv1', { status: 'cancelada', motivoCancelamento: 'Cliente desistiu' } as any, 'user1')
      expect(prismaFake.mensalidades[0].motivoCancelamento).toBe('Cliente desistiu')
      expect(prismaFake.mensalidades[0].alteradoPorId).toBe('user1')
    })

    it('não apaga um comprovante já anexado quando a chamada não reenvia um novo', async () => {
      const { service, prismaFake } = criarService({
        mensalidades: [{ id: 'mv1', status: 'pendente', comprovanteAnexo: 'data:antigo' }]
      })
      await service.atualizar('mv1', { status: 'paga' } as any, 'user1')
      expect(prismaFake.mensalidades[0].comprovanteAnexo).toBe('data:antigo')
    })
  })

  describe('enviarLembrete', () => {
    it('recusa quando a cobrança não existe', async () => {
      const { service } = criarService()
      await expect(service.enviarLembrete('inexistente')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('recusa quando o mensalista não tem e-mail cadastrado', async () => {
      const { service, prismaFake } = criarService()
      ;(prismaFake.mensalidade as any).findUnique = async () => ({
        id: 'mv1', valor: 300, dataFim: new Date(), mensalista: { nome: 'Fulano', email: null }
      })
      await expect(service.enviarLembrete('mv1')).rejects.toBeInstanceOf(BadRequestException)
    })

    it('envia o e-mail com valor e data formatados', async () => {
      const { service, prismaFake, emailFake } = criarService()
      ;(prismaFake.mensalidade as any).findUnique = async () => ({
        id: 'mv1', valor: 300, dataFim: new Date(2026, 7, 31), mensalista: { nome: 'Fulano', email: 'f@x.com' }
      })

      const resultado = await service.enviarLembrete('mv1')

      expect(resultado).toEqual({ enviado: true })
      expect(emailFake.enviarEmailLembreteCobranca).toHaveBeenCalledWith({
        to: 'f@x.com', nome: 'Fulano', valor: '300,00', dataFim: '31/08/2026'
      })
    })
  })
})
