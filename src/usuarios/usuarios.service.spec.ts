import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { Prisma } from '../../generated/prisma'
import type { AuthService } from '../auth/auth.service'
import { UsuariosService } from './usuarios.service'

const RONDA_BCRYPT_TESTE = 4

function erroConflitoUnico (campo: string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: [campo] }
  })
}

function criarPrismaFake (seed: { usuarios?: any[] } = {}) {
  const usuarios = seed.usuarios ?? []
  let proximoId = usuarios.length + 1

  return {
    usuarios,
    usuario: {
      async findMany () { return usuarios },
      async findUnique ({ where: { id } }: any) { return usuarios.find(u => u.id === id) ?? null },
      async findFirst ({ where }: any) {
        return usuarios.find(u =>
          u.cpf === where.cpf && (!where.id?.not || u.id !== where.id.not)
        ) ?? null
      },
      async create ({ data }: any) {
        if (usuarios.some(u => u.cpf && u.cpf === data.cpf)) throw erroConflitoUnico('cpf')
        if (usuarios.some(u => u.email === data.email)) throw erroConflitoUnico('email')
        const usuario = { id: String(proximoId++), ativo: true, ...data }
        usuarios.push(usuario)
        return usuario
      },
      async update ({ where: { id }, data }: any) {
        const usuario = usuarios.find(u => u.id === id)
        if (data.cpf && usuarios.some(u => u.id !== id && u.cpf === data.cpf)) throw erroConflitoUnico('cpf')
        if (data.email && usuarios.some(u => u.id !== id && u.email === data.email)) throw erroConflitoUnico('email')
        Object.assign(usuario, data)
        return usuario
      }
    }
  }
}

function criarAuthFake (): AuthService {
  return { gerarToken: jest.fn(() => 'token-novo') } as unknown as AuthService
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  const prismaFake = criarPrismaFake(seed)
  const authFake = criarAuthFake()
  const service = new UsuariosService(prismaFake as any, authFake)
  return { service, prismaFake, authFake }
}

describe('UsuariosService', () => {
  describe('listar', () => {
    it('mascara o CPF e nunca devolve a senha', async () => {
      const { service } = criarService({
        usuarios: [{ id: 'u1', nome: 'Fulano', cpf: '11122233344', senha: 'hash-secreto', email: 'f@x.com' }]
      })
      const [usuario] = await service.listar()
      expect(usuario.cpf).not.toBe('11122233344')
      expect(usuario.cpf).toContain('**')
      expect(usuario).not.toHaveProperty('senha')
    })
  })

  describe('buscarPorId', () => {
    it('devolve o usuário sem a senha', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1', senha: 'hash' }] })
      const usuario: any = await service.buscarPorId('u1')
      expect(usuario).not.toHaveProperty('senha')
    })

    it('devolve null quando o id não existe', async () => {
      const { service } = criarService({ usuarios: [] })
      expect(await service.buscarPorId('inexistente')).toBeNull()
    })
  })

  describe('existeCpfDuplicado', () => {
    it('retorna true quando o CPF já está cadastrado', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1', cpf: '11122233344' }] })
      expect(await service.existeCpfDuplicado('11122233344')).toBe(true)
    })

    it('retorna false ao excluir o próprio id da checagem', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1', cpf: '11122233344' }] })
      expect(await service.existeCpfDuplicado('11122233344', 'u1')).toBe(false)
    })
  })

  describe('criarFuncionario', () => {
    it('cria com senha temporária e role funcionario por padrão', async () => {
      const { service, prismaFake } = criarService()
      const usuario: any = await service.criarFuncionario({
        nome: 'Novo', email: 'novo@teste.com', senha: 'SenhaForte1!'
      } as any)

      expect(usuario).not.toHaveProperty('senha')
      expect(prismaFake.usuarios[0].senhaTemporaria).toBe(true)
      expect(prismaFake.usuarios[0].role).toBe('funcionario')
      expect(await bcrypt.compare('SenhaForte1!', prismaFake.usuarios[0].senha)).toBe(true)
    })

    it('aceita role admin quando explicitamente pedido', async () => {
      const { service } = criarService()
      const usuario: any = await service.criarFuncionario({
        nome: 'Admin', email: 'admin@teste.com', senha: 'SenhaForte1!', role: 'admin'
      } as any)
      expect(usuario.role).toBe('admin')
    })

    it('recusa e-mail já cadastrado', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1', email: 'ja@teste.com' }] })
      await expect(service.criarFuncionario({
        nome: 'X', email: 'ja@teste.com', senha: 'SenhaForte1!'
      } as any)).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('atualizarPerfil', () => {
    it('impede editar o perfil de outra pessoa quando não é admin', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1', nome: 'Fulano' }] })
      const solicitante: any = { id: 'u2', role: 'funcionario' }
      await expect(service.atualizarPerfil('u1', { nome: 'Outro' } as any, solicitante))
        .rejects.toBeInstanceOf(ForbiddenException)
    })

    it('permite editar o próprio perfil', async () => {
      const { service, prismaFake } = criarService({ usuarios: [{ id: 'u1', nome: 'Fulano' }] })
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      await service.atualizarPerfil('u1', { nome: 'Fulano Editado' } as any, solicitante)
      expect(prismaFake.usuarios[0].nome).toBe('Fulano Editado')
    })

    it('admin pode editar o perfil de outra pessoa', async () => {
      const { service, prismaFake } = criarService({ usuarios: [{ id: 'u1', nome: 'Fulano' }] })
      const solicitante: any = { id: 'admin1', role: 'admin' }
      await service.atualizarPerfil('u1', { nome: 'Editado pelo Admin' } as any, solicitante)
      expect(prismaFake.usuarios[0].nome).toBe('Editado pelo Admin')
    })

    it('recusa troca de senha quando a senha atual está errada', async () => {
      const senhaHash = await bcrypt.hash('SenhaCerta1!', RONDA_BCRYPT_TESTE)
      const { service } = criarService({ usuarios: [{ id: 'u1', senha: senhaHash }] })
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      await expect(service.atualizarPerfil('u1', { senha: 'NovaSenha1!', senhaAtual: 'Errada1!' } as any, solicitante))
        .rejects.toBeInstanceOf(BadRequestException)
    })

    it('troca a senha quando a senha atual confere, e marca como definitiva (não temporária)', async () => {
      const senhaHash = await bcrypt.hash('SenhaCerta1!', RONDA_BCRYPT_TESTE)
      const { service, prismaFake } = criarService({ usuarios: [{ id: 'u1', senha: senhaHash }] })
      const solicitante: any = { id: 'u1', role: 'funcionario' }

      await service.atualizarPerfil('u1', { senha: 'NovaSenha1!', senhaAtual: 'SenhaCerta1!' } as any, solicitante)

      expect(await bcrypt.compare('NovaSenha1!', prismaFake.usuarios[0].senha)).toBe(true)
      expect(prismaFake.usuarios[0].senhaTemporaria).toBe(false)
    })

    it('admin resetando a senha de outra conta marca como temporária, sem exigir senha atual', async () => {
      const { service, prismaFake } = criarService({ usuarios: [{ id: 'u1', senha: 'hash-antigo' }] })
      const solicitante: any = { id: 'admin1', role: 'admin' }

      await service.atualizarPerfil('u1', { senha: 'SenhaTemporaria1!' } as any, solicitante)

      expect(prismaFake.usuarios[0].senhaTemporaria).toBe(true)
    })

    it('ignora tentativa de mudar role/ativo quando o solicitante não é admin', async () => {
      const { service, prismaFake } = criarService({ usuarios: [{ id: 'u1', role: 'funcionario', ativo: true }] })
      const solicitante: any = { id: 'u1', role: 'funcionario' }

      await service.atualizarPerfil('u1', { role: 'admin', ativo: false } as any, solicitante)

      expect(prismaFake.usuarios[0].role).toBe('funcionario')
      expect(prismaFake.usuarios[0].ativo).toBe(true)
    })

    it('admin pode mudar role e ativo de qualquer conta', async () => {
      const { service, prismaFake } = criarService({ usuarios: [{ id: 'u1', role: 'funcionario', ativo: true }] })
      const solicitante: any = { id: 'admin1', role: 'admin' }

      await service.atualizarPerfil('u1', { role: 'admin', ativo: false } as any, solicitante)

      expect(prismaFake.usuarios[0].role).toBe('admin')
      expect(prismaFake.usuarios[0].ativo).toBe(false)
    })

    it('reemite o token só quando o próprio dono edita o perfil', async () => {
      const { service, authFake } = criarService({ usuarios: [{ id: 'u1', nome: 'Fulano' }, { id: 'admin1', nome: 'Admin' }] })

      const respostaAdmin: any = await service.atualizarPerfil('u1', { nome: 'X' } as any, { id: 'admin1', role: 'admin' } as any)
      expect(respostaAdmin.token).toBeUndefined()

      const respostaProprio: any = await service.atualizarPerfil('u1', { nome: 'Y' } as any, { id: 'u1', role: 'funcionario' } as any)
      expect(respostaProprio.token).toBe('token-novo')
      expect(authFake.gerarToken).toHaveBeenCalledTimes(1)
    })

    it('mapeia conflito de CPF/e-mail duplicado pra ConflictException com a mensagem certa', async () => {
      const { service } = criarService({
        usuarios: [{ id: 'u1', cpf: '111', email: 'a@x.com' }, { id: 'u2', cpf: '222', email: 'b@x.com' }]
      })
      const solicitante: any = { id: 'u2', role: 'funcionario' }
      await expect(service.atualizarPerfil('u2', { cpf: '111' } as any, solicitante))
        .rejects.toBeInstanceOf(ConflictException)
    })
  })
})
