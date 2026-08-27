import { ForbiddenException, NotFoundException } from '@nestjs/common'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import { RhPerfilService } from './rh-perfil.service'

function criarPrismaFake (seed: { usuarios?: any[], perfis?: any[] } = {}) {
  const usuarios = seed.usuarios ?? []
  const perfis = seed.perfis ?? []

  return {
    perfis,
    usuario: {
      async findUnique ({ where: { id } }: any) { return usuarios.find(u => u.id === id) ?? null }
    },
    perfilRH: {
      // Devolve uma cópia rasa, como o Prisma real (cada findUnique traz um
      // objeto novo) — sem isso, o "anterior" capturado antes do upsert
      // ficaria apontando pro mesmo objeto que o upsert muta em seguida.
      async findUnique ({ where: { usuarioId } }: any) {
        const encontrado = perfis.find(p => p.usuarioId === usuarioId)
        return encontrado ? { ...encontrado } : null
      },
      async upsert ({ where: { usuarioId }, create, update }: any) {
        const existente = perfis.find(p => p.usuarioId === usuarioId)
        if (existente) {
          Object.assign(existente, update)
          return existente
        }
        const novo = { id: `perfil-${perfis.length + 1}`, ...create }
        perfis.push(novo)
        return novo
      },
      async findMany () {
        return [...perfis].sort((a, b) => (a.criadoEm ?? 0) - (b.criadoEm ?? 0))
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
  const service = new RhPerfilService(prismaFake as any, auditoriaFake)
  return { service, prismaFake, auditoriaFake }
}

const DIAS_ESCALA = [1, 2, 3, 4]

function dtoValido (extra: Partial<Record<string, unknown>> = {}) {
  return {
    cargo: 'Operador de Sistema',
    salarioBase: 2500,
    dataAdmissao: '2026-01-10',
    diasEscala: DIAS_ESCALA,
    horasPorDia: 6,
    bancoNome: 'Banco Fictício',
    agencia: '0001',
    contaBancaria: '12345-6',
    ...extra
  } as any
}

describe('RhPerfilService', () => {
  describe('buscarPorUsuarioId', () => {
    it('funcionário pode ver o próprio perfil', async () => {
      const { service } = criarService({
        usuarios: [{ id: 'u1' }],
        perfis: [{ usuarioId: 'u1', cargo: 'Operador de Sistema' }]
      })
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      const perfil = await service.buscarPorUsuarioId('u1', solicitante)
      expect(perfil?.cargo).toBe('Operador de Sistema')
    })

    it('funcionário não pode ver perfil de outra pessoa', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1' }, { id: 'u2' }] })
      const solicitante: any = { id: 'u2', role: 'funcionario' }
      await expect(service.buscarPorUsuarioId('u1', solicitante)).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('gestor não pode ver perfil de RH (contém salário) de outra pessoa', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1' }, { id: 'gestor1' }] })
      const solicitante: any = { id: 'gestor1', role: 'gestor' }
      await expect(service.buscarPorUsuarioId('u1', solicitante)).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('rh pode ver perfil de qualquer funcionário', async () => {
      const { service } = criarService({
        usuarios: [{ id: 'u1' }],
        perfis: [{ usuarioId: 'u1', cargo: 'Operador de Sistema' }]
      })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      const perfil = await service.buscarPorUsuarioId('u1', solicitante)
      expect(perfil?.cargo).toBe('Operador de Sistema')
    })

    it('devolve null quando o funcionário ainda não tem perfil de RH', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1' }] })
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      expect(await service.buscarPorUsuarioId('u1', solicitante)).toBeNull()
    })
  })

  describe('listarCargos', () => {
    it('devolve um cargo por linha, com a vagaOrigem do registro mais antigo', async () => {
      const { service } = criarService({
        perfis: [
          { usuarioId: 'u1', cargo: 'Operador de Sistema', vagaOrigem: 'Vaga original — Turno Noturno', criadoEm: 1 },
          { usuarioId: 'u2', cargo: 'Operador de Sistema', vagaOrigem: 'Vaga digitada errado', criadoEm: 2 },
          { usuarioId: 'u3', cargo: 'Supervisor', vagaOrigem: null, criadoEm: 3 }
        ]
      })

      const cargos = await service.listarCargos()

      expect(cargos).toEqual([
        { cargo: 'Operador de Sistema', vagaOrigem: 'Vaga original — Turno Noturno' },
        { cargo: 'Supervisor', vagaOrigem: null }
      ])
    })

    it('devolve lista vazia quando não há nenhum perfil cadastrado', async () => {
      const { service } = criarService()
      expect(await service.listarCargos()).toEqual([])
    })
  })

  describe('definir', () => {
    it('recusa quando o usuário não existe', async () => {
      const { service } = criarService({ usuarios: [] })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.definir('inexistente', dtoValido(), solicitante)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('cria o perfil na primeira definição e audita como criação', async () => {
      const { service, prismaFake, auditoriaFake } = criarService({ usuarios: [{ id: 'u1' }] })
      const solicitante: any = { id: 'rh1', role: 'rh' }

      const perfil = await service.definir('u1', dtoValido(), solicitante)

      expect(perfil.cargo).toBe('Operador de Sistema')
      expect(perfil.tipoContrato).toBe('clt')
      expect(prismaFake.perfis).toHaveLength(1)
      expect(auditoriaFake.registrar).toHaveBeenCalledWith(expect.objectContaining({
        usuarioId: 'rh1', papel: 'rh', acao: 'perfil-rh.criar', entidade: 'PerfilRH'
      }))
    })

    it('edita o perfil existente e audita como edição, com dadosAntes preenchido', async () => {
      const { service, auditoriaFake } = criarService({
        usuarios: [{ id: 'u1' }],
        perfis: [{ usuarioId: 'u1', cargo: 'Antigo', salarioBase: { toString: () => '2000' } }]
      })
      const solicitante: any = { id: 'admin1', role: 'admin' }

      const perfil = await service.definir('u1', dtoValido({ cargo: 'Novo Cargo' }), solicitante)

      expect(perfil.cargo).toBe('Novo Cargo')
      expect(auditoriaFake.registrar).toHaveBeenCalledWith(expect.objectContaining({
        acao: 'perfil-rh.editar',
        dadosAntes: expect.objectContaining({ cargo: 'Antigo' })
      }))
    })

    it('aceita modalidade PJ e grava vagaOrigem', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1' }] })
      const solicitante: any = { id: 'rh1', role: 'rh' }

      const perfil = await service.definir('u1', dtoValido({ tipoContrato: 'pj', vagaOrigem: 'Auxiliar — Turno Noturno' }), solicitante)

      expect(perfil.tipoContrato).toBe('pj')
      expect(perfil.vagaOrigem).toBe('Auxiliar — Turno Noturno')
    })

    it('recusa quando o gestor informado não existe', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1' }] })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.definir('u1', dtoValido({ gestorId: 'inexistente' }), solicitante))
        .rejects.toBeInstanceOf(NotFoundException)
    })

    it('recusa quando o funcionário tenta ser o próprio gestor', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1' }] })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.definir('u1', dtoValido({ gestorId: 'u1' }), solicitante))
        .rejects.toBeInstanceOf(ForbiddenException)
    })

    it('grava gestorId quando o gestor informado existe', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1' }, { id: 'gestor1' }] })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      const perfil = await service.definir('u1', dtoValido({ gestorId: 'gestor1' }), solicitante)
      expect(perfil.gestorId).toBe('gestor1')
    })
  })
})
