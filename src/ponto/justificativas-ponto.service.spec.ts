import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import { JustificativasPontoService } from './justificativas-ponto.service'
import { parseDataLocal } from './ponto-datas.util'

function erroConflitoUnico () {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['usuarioId', 'data'] }
  })
}

function criarPrismaFake (seed: { perfis?: any[], justificativas?: any[] } = {}) {
  const perfis = seed.perfis ?? []
  const justificativas = seed.justificativas ?? []

  return {
    justificativas,
    perfilRH: {
      async findUnique ({ where: { usuarioId } }: any) { return perfis.find(p => p.usuarioId === usuarioId) ?? null }
    },
    justificativaPonto: {
      async create ({ data }: any) {
        if (justificativas.some(j => j.usuarioId === data.usuarioId && j.data.getTime() === data.data.getTime())) {
          throw erroConflitoUnico()
        }
        const nova = { id: `just-${justificativas.length + 1}`, criadoEm: new Date(), ...data }
        justificativas.push(nova)
        return nova
      },
      async findMany ({ where }: any) {
        return justificativas.filter(j => !where.usuarioId || j.usuarioId === where.usuarioId)
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
  const service = new JustificativasPontoService(prismaFake as any, auditoriaFake)
  return { service, prismaFake, auditoriaFake }
}

describe('JustificativasPontoService', () => {
  describe('criar', () => {
    it('recusa quando o funcionário não tem perfil de RH', async () => {
      const { service } = criarService()
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.criar({ usuarioId: 'u1', data: '2026-08-11', tipo: 'folga' }, solicitante))
        .rejects.toBeInstanceOf(NotFoundException)
    })

    it('rh cria uma folga e a ação é auditada', async () => {
      const { service, prismaFake, auditoriaFake } = criarService({ perfis: [{ usuarioId: 'u1' }] })
      const solicitante: any = { id: 'rh1', role: 'rh' }

      const justificativa = await service.criar({ usuarioId: 'u1', data: '2026-08-11', tipo: 'folga' }, solicitante)

      expect(justificativa.tipo).toBe('folga')
      expect(justificativa.criadoPorId).toBe('rh1')
      expect(prismaFake.justificativas).toHaveLength(1)
      expect(auditoriaFake.registrar).toHaveBeenCalledWith(expect.objectContaining({
        acao: 'justificativa-ponto.criar', entidade: 'JustificativaPonto'
      }))
    })

    it('recusa duas justificativas para o mesmo funcionário e data', async () => {
      const { service } = criarService({
        perfis: [{ usuarioId: 'u1' }],
        justificativas: [{ id: 'j1', usuarioId: 'u1', data: parseDataLocal('2026-08-11'), tipo: 'folga' }]
      })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.criar({ usuarioId: 'u1', data: '2026-08-11', tipo: 'atestado' }, solicitante))
        .rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('listar', () => {
    it('funcionário só vê as próprias justificativas', async () => {
      const { service } = criarService({
        justificativas: [
          { id: 'j1', usuarioId: 'u1', data: parseDataLocal('2026-08-11'), tipo: 'folga' },
          { id: 'j2', usuarioId: 'u2', data: parseDataLocal('2026-08-12'), tipo: 'atestado' }
        ]
      })
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      const resultado = await service.listar(solicitante)
      expect(resultado).toHaveLength(1)
      expect(resultado[0].usuarioId).toBe('u1')
    })

    it('funcionário não pode pedir a lista de outra pessoa', async () => {
      const { service } = criarService()
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      await expect(service.listar(solicitante, 'u2')).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('rh vê justificativas de todo mundo', async () => {
      const { service } = criarService({
        justificativas: [
          { id: 'j1', usuarioId: 'u1', data: parseDataLocal('2026-08-11'), tipo: 'folga' },
          { id: 'j2', usuarioId: 'u2', data: parseDataLocal('2026-08-12'), tipo: 'atestado' }
        ]
      })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      const resultado = await service.listar(solicitante)
      expect(resultado).toHaveLength(2)
    })
  })
})
