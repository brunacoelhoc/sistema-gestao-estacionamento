import { ForbiddenException, NotFoundException } from '@nestjs/common'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import { PdiService } from './pdi.service'

function criarPrismaFake (seed: { usuarios?: any[], itens?: any[] } = {}) {
  const usuarios = seed.usuarios ?? []
  const itens = seed.itens ?? []
  let contador = itens.length

  return {
    itens,
    usuario: {
      async findUnique ({ where: { id } }: any) { return usuarios.find(u => u.id === id) ?? null }
    },
    itemPdi: {
      async findMany ({ where: { usuarioId } }: any) {
        return itens.filter(i => i.usuarioId === usuarioId).sort((a, b) => a.ordem - b.ordem).map(i => ({ ...i }))
      },
      async findFirst ({ where, orderBy }: any) {
        let filtrados = itens.filter(i => i.usuarioId === where.usuarioId)
        if (where.ordem?.lt !== undefined) filtrados = filtrados.filter(i => i.ordem < where.ordem.lt)
        if (where.ordem?.gt !== undefined) filtrados = filtrados.filter(i => i.ordem > where.ordem.gt)
        filtrados.sort((a, b) => orderBy.ordem === 'asc' ? a.ordem - b.ordem : b.ordem - a.ordem)
        return filtrados[0] ? { ...filtrados[0] } : null
      },
      async findUnique ({ where: { id } }: any) {
        const encontrado = itens.find(i => i.id === id)
        return encontrado ? { ...encontrado } : null
      },
      async create ({ data }: any) {
        contador++
        const novo = { id: `item-${contador}`, status: 'pendente', concluidoEm: null, ...data }
        itens.push(novo)
        return { ...novo }
      },
      async update ({ where: { id }, data }: any) {
        const existente = itens.find(i => i.id === id)
        Object.assign(existente, data)
        return { ...existente }
      },
      async delete ({ where: { id } }: any) {
        const indice = itens.findIndex(i => i.id === id)
        itens.splice(indice, 1)
      }
    },
    async $transaction (callback: any) {
      return await callback(this)
    }
  }
}

function criarAuditoriaFake (): AuditoriaService {
  return { registrar: jest.fn() } as unknown as AuditoriaService
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  const prismaFake = criarPrismaFake(seed)
  const auditoriaFake = criarAuditoriaFake()
  const service = new PdiService(prismaFake as any, auditoriaFake)
  return { service, prismaFake, auditoriaFake }
}

const solicitanteRh: any = { id: 'rh1', role: 'rh' }

describe('PdiService', () => {
  describe('listarPorUsuario', () => {
    it('funcionário pode ver o próprio PDI', async () => {
      const { service } = criarService({
        usuarios: [{ id: 'u1' }],
        itens: [{ id: 'i1', usuarioId: 'u1', ordem: 1, titulo: 'Curso X' }]
      })
      const itens = await service.listarPorUsuario('u1', { id: 'u1', role: 'funcionario' } as any)
      expect(itens).toHaveLength(1)
    })

    it('funcionário não pode ver PDI de outra pessoa', async () => {
      const { service } = criarService()
      await expect(service.listarPorUsuario('u1', { id: 'u2', role: 'funcionario' } as any))
        .rejects.toBeInstanceOf(ForbiddenException)
    })

    it('gestor não pode ver PDI de terceiro', async () => {
      const { service } = criarService()
      await expect(service.listarPorUsuario('u1', { id: 'gestor1', role: 'gestor' } as any))
        .rejects.toBeInstanceOf(ForbiddenException)
    })
  })

  describe('criar', () => {
    it('recusa quando o funcionário não existe', async () => {
      const { service } = criarService()
      await expect(service.criar('inexistente', { titulo: 'X' } as any, solicitanteRh))
        .rejects.toBeInstanceOf(NotFoundException)
    })

    it('cria o primeiro item com ordem 1 e audita', async () => {
      const { service, auditoriaFake } = criarService({ usuarios: [{ id: 'u1' }] })
      const item = await service.criar('u1', { titulo: 'Curso de liderança' } as any, solicitanteRh)

      expect(item.ordem).toBe(1)
      expect(item.status).toBe('pendente')
      expect(auditoriaFake.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'pdi.criar' }))
    })

    it('encadeia a ordem ao final da lista existente', async () => {
      const { service } = criarService({
        usuarios: [{ id: 'u1' }],
        itens: [{ id: 'i1', usuarioId: 'u1', ordem: 1, titulo: 'A', status: 'pendente' }]
      })
      const item = await service.criar('u1', { titulo: 'B' } as any, solicitanteRh)
      expect(item.ordem).toBe(2)
    })
  })

  describe('concluir / reabrir', () => {
    it('marca como concluído e preenche concluidoEm', async () => {
      const { service } = criarService({
        itens: [{ id: 'i1', usuarioId: 'u1', ordem: 1, titulo: 'A', status: 'pendente', concluidoEm: null }]
      })
      const item = await service.concluir('i1', solicitanteRh)
      expect(item.status).toBe('concluido')
      expect(item.concluidoEm).toBeInstanceOf(Date)
    })

    it('reabrir limpa concluidoEm', async () => {
      const { service } = criarService({
        itens: [{ id: 'i1', usuarioId: 'u1', ordem: 1, titulo: 'A', status: 'concluido', concluidoEm: new Date() }]
      })
      const item = await service.reabrir('i1', solicitanteRh)
      expect(item.status).toBe('pendente')
      expect(item.concluidoEm).toBeNull()
    })

    it('é idempotente ao concluir um item já concluído', async () => {
      const { service, auditoriaFake } = criarService({
        itens: [{ id: 'i1', usuarioId: 'u1', ordem: 1, titulo: 'A', status: 'concluido', concluidoEm: new Date('2026-01-01') }]
      })
      await service.concluir('i1', solicitanteRh)
      expect(auditoriaFake.registrar).not.toHaveBeenCalled()
    })
  })

  describe('mover', () => {
    it('troca a ordem com o vizinho de cima', async () => {
      const { service } = criarService({
        itens: [
          { id: 'i1', usuarioId: 'u1', ordem: 1, titulo: 'A', status: 'pendente' },
          { id: 'i2', usuarioId: 'u1', ordem: 2, titulo: 'B', status: 'pendente' }
        ]
      })
      const item = await service.mover('i2', 'cima', solicitanteRh)
      expect(item?.ordem).toBe(1)

      const itens = await service.listarPorUsuario('u1', solicitanteRh)
      expect(itens.find(i => i.id === 'i1')?.ordem).toBe(2)
    })

    it('não faz nada ao mover o primeiro item pra cima', async () => {
      const { service } = criarService({
        itens: [{ id: 'i1', usuarioId: 'u1', ordem: 1, titulo: 'A', status: 'pendente' }]
      })
      const item = await service.mover('i1', 'cima', solicitanteRh)
      expect(item?.ordem).toBe(1)
    })
  })

  describe('remover', () => {
    it('remove e audita com dadosAntes', async () => {
      const { service, prismaFake, auditoriaFake } = criarService({
        itens: [{ id: 'i1', usuarioId: 'u1', ordem: 1, titulo: 'A', status: 'pendente' }]
      })
      await service.remover('i1', solicitanteRh)

      expect(prismaFake.itens).toHaveLength(0)
      expect(auditoriaFake.registrar).toHaveBeenCalledWith(expect.objectContaining({
        acao: 'pdi.remover', dadosAntes: expect.objectContaining({ id: 'i1' })
      }))
    })
  })
})
