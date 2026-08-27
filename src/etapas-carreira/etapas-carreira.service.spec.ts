import { ConflictException, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import { EtapasCarreiraService } from './etapas-carreira.service'

function erroConflitoUnico () {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['ordem'] }
  })
}

function erroRestricaoFk () {
  return new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
    code: 'P2003',
    clientVersion: 'test'
  })
}

function criarPrismaFake (seed: { etapas?: any[] } = {}) {
  const etapas = seed.etapas ?? []

  return {
    etapas,
    etapaCarreira: {
      async findMany () {
        return [...etapas].sort((a, b) => a.ordem - b.ordem)
      },
      async findUnique ({ where: { id } }: any) {
        const encontrada = etapas.find(e => e.id === id)
        return encontrada ? { ...encontrada } : null
      },
      async create ({ data }: any) {
        if (etapas.some(e => e.ordem === data.ordem)) throw erroConflitoUnico()
        const nova = { id: `etapa-${etapas.length + 1}`, ...data }
        etapas.push(nova)
        return nova
      },
      async update ({ where: { id }, data }: any) {
        const existente = etapas.find(e => e.id === id)
        if (data.ordem !== undefined && etapas.some(e => e.id !== id && e.ordem === data.ordem)) {
          throw erroConflitoUnico()
        }
        Object.assign(existente, data)
        return existente
      },
      async delete ({ where: { id } }: any) {
        const indice = etapas.findIndex(e => e.id === id)
        etapas.splice(indice, 1)
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
  const service = new EtapasCarreiraService(prismaFake as any, auditoriaFake)
  return { service, prismaFake, auditoriaFake }
}

const solicitanteRh: any = { id: 'rh1', role: 'rh' }

function dtoValido (extra: Partial<Record<string, unknown>> = {}) {
  return { ordem: 1, titulo: 'Operador de Sistema Júnior', descricao: 'Atua sob supervisão direta.', ...extra } as any
}

describe('EtapasCarreiraService', () => {
  describe('listar', () => {
    it('devolve o catálogo ordenado por ordem', async () => {
      const { service } = criarService({
        etapas: [
          { id: 'e2', ordem: 2, titulo: 'Pleno' },
          { id: 'e1', ordem: 1, titulo: 'Júnior' }
        ]
      })
      const etapas = await service.listar()
      expect(etapas.map(e => e.id)).toEqual(['e1', 'e2'])
    })
  })

  describe('criar', () => {
    it('cria a etapa e audita', async () => {
      const { service, prismaFake, auditoriaFake } = criarService()
      const etapa = await service.criar(dtoValido(), solicitanteRh)

      expect(etapa.titulo).toBe('Operador de Sistema Júnior')
      expect(prismaFake.etapas).toHaveLength(1)
      expect(auditoriaFake.registrar).toHaveBeenCalledWith(expect.objectContaining({
        acao: 'etapa-carreira.criar', entidade: 'EtapaCarreira'
      }))
    })

    it('recusa ordem duplicada', async () => {
      const { service } = criarService({ etapas: [{ id: 'e1', ordem: 1, titulo: 'Júnior' }] })
      await expect(service.criar(dtoValido({ ordem: 1 }), solicitanteRh)).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('editar', () => {
    it('recusa etapa inexistente', async () => {
      const { service } = criarService()
      await expect(service.editar('inexistente', dtoValido(), solicitanteRh)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('edita e audita com dadosAntes preenchido', async () => {
      const { service, auditoriaFake } = criarService({
        etapas: [{ id: 'e1', ordem: 1, titulo: 'Júnior', descricao: 'Antiga' }]
      })
      const etapa = await service.editar('e1', dtoValido({ titulo: 'Júnior Atualizado' }), solicitanteRh)

      expect(etapa.titulo).toBe('Júnior Atualizado')
      expect(auditoriaFake.registrar).toHaveBeenCalledWith(expect.objectContaining({
        acao: 'etapa-carreira.editar',
        dadosAntes: expect.objectContaining({ titulo: 'Júnior' })
      }))
    })
  })

  describe('remover', () => {
    it('recusa etapa inexistente', async () => {
      const { service } = criarService()
      await expect(service.remover('inexistente', solicitanteRh)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('remove e audita', async () => {
      const { service, prismaFake, auditoriaFake } = criarService({
        etapas: [{ id: 'e1', ordem: 1, titulo: 'Júnior' }]
      })
      await service.remover('e1', solicitanteRh)

      expect(prismaFake.etapas).toHaveLength(0)
      expect(auditoriaFake.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'etapa-carreira.remover' }))
    })

    it('recusa remover etapa atribuída a algum funcionário (violação de FK)', async () => {
      const { service, prismaFake } = criarService({ etapas: [{ id: 'e1', ordem: 1, titulo: 'Júnior' }] })
      prismaFake.etapaCarreira.delete = async () => { throw erroRestricaoFk() }

      await expect(service.remover('e1', solicitanteRh)).rejects.toBeInstanceOf(ConflictException)
    })
  })
})
