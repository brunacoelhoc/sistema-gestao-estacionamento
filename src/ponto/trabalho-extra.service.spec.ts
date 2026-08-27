import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import { parseDataLocal } from './ponto-datas.util'
import { TrabalhoExtraService } from './trabalho-extra.service'

function erroConflitoUnico () {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['usuarioId', 'data'] }
  })
}

function criarPrismaFake (seed: { perfis?: any[], solicitacoes?: any[] } = {}) {
  const perfis = seed.perfis ?? []
  const solicitacoes = seed.solicitacoes ?? []

  return {
    solicitacoes,
    perfilRH: {
      async findUnique ({ where: { usuarioId } }: any) { return perfis.find(p => p.usuarioId === usuarioId) ?? null }
    },
    solicitacaoTrabalhoExtra: {
      async findUnique ({ where: { id } }: any) { return solicitacoes.find(s => s.id === id) ?? null },
      async create ({ data }: any) {
        if (solicitacoes.some(s => s.usuarioId === data.usuarioId && s.data.getTime() === data.data.getTime())) {
          throw erroConflitoUnico()
        }
        const nova = { id: `extra-${solicitacoes.length + 1}`, status: 'pendente', criadoEm: new Date(), ...data }
        solicitacoes.push(nova)
        return nova
      },
      async update ({ where: { id }, data }: any) {
        const solicitacao = solicitacoes.find(s => s.id === id)
        Object.assign(solicitacao, data)
        return solicitacao
      },
      async findMany ({ where }: any) {
        return solicitacoes.filter(s => !where.usuarioId || s.usuarioId === where.usuarioId)
      }
    }
  }
}

function criarAuditoriaFake (): AuditoriaService {
  return { registrar: jest.fn() } as unknown as AuditoriaService
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  const prismaFake = criarPrismaFake(seed)
  const auditoriaFake = criarAuditoriaFake()
  const service = new TrabalhoExtraService(prismaFake as any, auditoriaFake)
  return { service, prismaFake, auditoriaFake }
}

const HOJE = new Date(2026, 7, 25) // terça

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(HOJE)
})

afterEach(() => {
  jest.useRealTimers()
})

describe('TrabalhoExtraService', () => {
  describe('solicitar', () => {
    it('recusa quando não tem perfil de RH', async () => {
      const { service } = criarService()
      await expect(service.solicitar('u1', { data: '2026-08-29', motivo: 'Cobrir plantão' }))
        .rejects.toBeInstanceOf(NotFoundException)
    })

    it('recusa quando a data já é um dia da escala normal', async () => {
      const diaDaSemanaAlvo = new Date(2026, 7, 29).getDay()
      const { service } = criarService({ perfis: [{ usuarioId: 'u1', diasEscala: [diaDaSemanaAlvo] }] })
      await expect(service.solicitar('u1', { data: '2026-08-29', motivo: 'Cobrir plantão' }))
        .rejects.toBeInstanceOf(BadRequestException)
    })

    it('recusa data no passado', async () => {
      const { service } = criarService({ perfis: [{ usuarioId: 'u1', diasEscala: [0, 1, 2, 3] }] })
      await expect(service.solicitar('u1', { data: '2026-08-01', motivo: 'Cobrir plantão' }))
        .rejects.toBeInstanceOf(BadRequestException)
    })

    it('cria a solicitação para um dia futuro fora da escala', async () => {
      const { service, prismaFake } = criarService({ perfis: [{ usuarioId: 'u1', diasEscala: [0, 1, 2, 3] }] })
      const solicitacao = await service.solicitar('u1', { data: '2026-08-29', motivo: 'Cobrir plantão' })
      expect(solicitacao.status).toBe('pendente')
      expect(prismaFake.solicitacoes).toHaveLength(1)
    })

    it('recusa segunda solicitação para a mesma data', async () => {
      const { service } = criarService({
        perfis: [{ usuarioId: 'u1', diasEscala: [0, 1, 2, 3] }],
        solicitacoes: [{ id: 'e1', usuarioId: 'u1', data: parseDataLocal('2026-08-29'), status: 'pendente' }]
      })
      await expect(service.solicitar('u1', { data: '2026-08-29', motivo: 'Outra' }))
        .rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('decidir', () => {
    it('recusa quando a solicitação não existe', async () => {
      const { service } = criarService()
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.decidir('inexistente', { status: 'aprovada' }, solicitante))
        .rejects.toBeInstanceOf(NotFoundException)
    })

    it('recusa decidir uma solicitação que já foi decidida', async () => {
      const { service } = criarService({
        solicitacoes: [{ id: 'e1', usuarioId: 'u1', data: parseDataLocal('2026-08-29'), status: 'aprovada' }]
      })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.decidir('e1', { status: 'rejeitada' }, solicitante))
        .rejects.toBeInstanceOf(ConflictException)
    })

    it('aprova e audita a decisão', async () => {
      const { service, prismaFake, auditoriaFake } = criarService({
        solicitacoes: [{ id: 'e1', usuarioId: 'u1', data: parseDataLocal('2026-08-29'), status: 'pendente' }]
      })
      const solicitante: any = { id: 'rh1', role: 'rh' }

      const resultado = await service.decidir('e1', { status: 'aprovada' }, solicitante)

      expect(resultado.status).toBe('aprovada')
      expect(prismaFake.solicitacoes[0].aprovadoPorId).toBe('rh1')
      expect(auditoriaFake.registrar).toHaveBeenCalledWith(expect.objectContaining({
        acao: 'trabalho-extra.aprovar', entidade: 'SolicitacaoTrabalhoExtra', entidadeId: 'e1'
      }))
    })
  })
})
