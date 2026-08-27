import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { NotificacoesService } from './notificacoes.service'

function criarPrismaFake (seed: { notificacoes?: any[] } = {}) {
  const notificacoes = seed.notificacoes ?? []

  return {
    notificacoes,
    notificacao: {
      async create ({ data }: any) {
        const nova = { id: `notif-${notificacoes.length + 1}`, lida: false, lidaEm: null, criadoEm: new Date(), ...data }
        notificacoes.push(nova)
        return nova
      },
      async findMany ({ where }: any) {
        return notificacoes.filter(n => n.usuarioId === where.usuarioId)
      },
      async findUnique ({ where: { id } }: any) { return notificacoes.find(n => n.id === id) ?? null },
      async update ({ where: { id }, data }: any) {
        const notificacao = notificacoes.find(n => n.id === id)
        Object.assign(notificacao, data)
        return notificacao
      }
    }
  }
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  const prismaFake = criarPrismaFake(seed)
  const service = new NotificacoesService(prismaFake as any)
  return { service, prismaFake }
}

describe('NotificacoesService', () => {
  describe('criar', () => {
    it('cria uma notificação não lida', async () => {
      const { service, prismaFake } = criarService()
      const notificacao = await service.criar({
        usuarioId: 'u1', tipo: 'geral', titulo: 'Título', mensagem: 'Mensagem'
      })
      expect(notificacao.lida).toBe(false)
      expect(prismaFake.notificacoes).toHaveLength(1)
    })
  })

  describe('listarMinhas', () => {
    it('só devolve notificações do próprio usuário', async () => {
      const { service } = criarService({
        notificacoes: [
          { id: 'n1', usuarioId: 'u1', tipo: 'geral', titulo: 'A', mensagem: 'A', lida: false },
          { id: 'n2', usuarioId: 'u2', tipo: 'geral', titulo: 'B', mensagem: 'B', lida: false }
        ]
      })
      const resultado = await service.listarMinhas('u1')
      expect(resultado).toHaveLength(1)
      expect(resultado[0].id).toBe('n1')
    })
  })

  describe('marcarComoLida', () => {
    it('recusa quando a notificação não existe', async () => {
      const { service } = criarService()
      await expect(service.marcarComoLida('inexistente', 'u1')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('recusa marcar como lida a notificação de outra pessoa', async () => {
      const { service } = criarService({
        notificacoes: [{ id: 'n1', usuarioId: 'u1', tipo: 'geral', titulo: 'A', mensagem: 'A', lida: false }]
      })
      await expect(service.marcarComoLida('n1', 'u2')).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('marca como lida e preenche lidaEm', async () => {
      const { service, prismaFake } = criarService({
        notificacoes: [{ id: 'n1', usuarioId: 'u1', tipo: 'geral', titulo: 'A', mensagem: 'A', lida: false }]
      })
      const resultado = await service.marcarComoLida('n1', 'u1')
      expect(resultado.lida).toBe(true)
      expect(resultado.lidaEm).toBeInstanceOf(Date)
      expect(prismaFake.notificacoes[0].lida).toBe(true)
    })

    it('é idempotente: marcar como lida de novo não quebra', async () => {
      const { service } = criarService({
        notificacoes: [{ id: 'n1', usuarioId: 'u1', tipo: 'geral', titulo: 'A', mensagem: 'A', lida: true, lidaEm: new Date() }]
      })
      const resultado = await service.marcarComoLida('n1', 'u1')
      expect(resultado.lida).toBe(true)
    })
  })
})
