import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import type { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import type { EmailService } from '../email/email.service'
import { AuthService } from './auth.service'

// Ronda baixa só pra deixar o teste rápido — o código de produção sempre usa
// 12 (ver AuthService.registrar/confirmarReset), essa constante é só pra
// montar o hash de senha já existente nos fixtures de teste.
const RONDA_BCRYPT_TESTE = 4

/**
 * Fake em memória do PrismaService: replica só usuario/resetSenhaCodigo, que
 * é tudo que AuthService usa. $transaction chama o callback com o mesmo
 * storage — suficiente pra testar a lógica, sem precisar de rollback real.
 */
function criarPrismaFake (seed: { usuarios?: any[] } = {}) {
  const usuarios = seed.usuarios ?? []
  const resetCodigos: any[] = []
  let proximoUsuarioId = usuarios.length + 1
  let proximoResetId = 1

  const modelos = {
    usuario: {
      async findUnique ({ where }: any) {
        if (where.cpf !== undefined) return usuarios.find(u => u.cpf === where.cpf) ?? null
        if (where.email !== undefined) return usuarios.find(u => u.email === where.email) ?? null
        if (where.id !== undefined) return usuarios.find(u => u.id === where.id) ?? null
        return null
      },
      async create ({ data }: any) {
        const usuario = { id: String(proximoUsuarioId++), ativo: true, ...data }
        usuarios.push(usuario)
        return usuario
      },
      async update ({ where: { id }, data }: any) {
        const usuario = usuarios.find(u => u.id === id)
        Object.assign(usuario, data)
        return usuario
      }
    },
    resetSenhaCodigo: {
      async deleteMany ({ where }: any) {
        for (let i = resetCodigos.length - 1; i >= 0; i--) {
          if (resetCodigos[i].usuarioId === where.usuarioId && resetCodigos[i].usado === where.usado) {
            resetCodigos.splice(i, 1)
          }
        }
      },
      async create ({ data }: any) {
        const registro = { id: String(proximoResetId++), usado: false, ...data }
        resetCodigos.push(registro)
        return registro
      },
      async findFirst ({ where }: any) {
        return resetCodigos
          .filter(r => r.usuarioId === where.usuarioId && r.usado === where.usado)
          .sort((a, b) => b.criadoEm - a.criadoEm)[0] ?? null
      },
      async update ({ where: { id }, data }: any) {
        const registro = resetCodigos.find(r => r.id === id)
        Object.assign(registro, data)
        return registro
      }
    }
  }

  return {
    ...modelos,
    usuarios,
    resetCodigos,
    async $transaction (fn: any) { return fn(modelos) }
  }
}

function criarJwtFake (): JwtService {
  return { sign: jest.fn((payload: any) => JSON.stringify(payload)) } as unknown as JwtService
}

function criarConfigFake (valores: Record<string, string> = {}): ConfigService {
  return { get: (chave: string) => valores[chave] } as unknown as ConfigService
}

function criarEmailFake (): EmailService {
  return {
    enviarEmailResetSenha: jest.fn().mockResolvedValue(undefined),
    enviarEmailLembreteCobranca: jest.fn().mockResolvedValue(undefined)
  } as unknown as EmailService
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0], configValores?: Record<string, string>) {
  const prismaFake = criarPrismaFake(seed)
  const emailFake = criarEmailFake()
  const service = new AuthService(prismaFake as any, criarJwtFake(), emailFake, criarConfigFake(configValores))
  return { service, prismaFake, emailFake }
}

describe('AuthService', () => {
  describe('login', () => {
    it('autentica com CPF e senha corretos e não devolve a senha no retorno', async () => {
      const senhaHash = await bcrypt.hash('SenhaForte1!', RONDA_BCRYPT_TESTE)
      const { service } = criarService({
        usuarios: [{ id: 'u1', cpf: '111.111.111-11', senha: senhaHash, ativo: true, role: 'funcionario', nome: 'Fulano' }]
      })

      const resultado = await service.login({ cpf: '111.111.111-11', senha: 'SenhaForte1!' } as any)

      expect(resultado.token).toBeTruthy()
      expect(resultado.usuario).not.toHaveProperty('senha')
    })

    it('rejeita CPF inexistente', async () => {
      const { service } = criarService({ usuarios: [] })
      await expect(service.login({ cpf: '000.000.000-00', senha: 'x' } as any))
        .rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('rejeita senha incorreta', async () => {
      const senhaHash = await bcrypt.hash('SenhaCerta1!', RONDA_BCRYPT_TESTE)
      const { service } = criarService({
        usuarios: [{ id: 'u1', cpf: '111.111.111-11', senha: senhaHash, ativo: true }]
      })
      await expect(service.login({ cpf: '111.111.111-11', senha: 'Errada1!' } as any))
        .rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('rejeita usuário inativo mesmo com a senha certa', async () => {
      const senhaHash = await bcrypt.hash('SenhaForte1!', RONDA_BCRYPT_TESTE)
      const { service } = criarService({
        usuarios: [{ id: 'u1', cpf: '111.111.111-11', senha: senhaHash, ativo: false }]
      })
      await expect(service.login({ cpf: '111.111.111-11', senha: 'SenhaForte1!' } as any))
        .rejects.toBeInstanceOf(ForbiddenException)
    })

    it('rejeita conta sem senha local (ex.: criada via Google)', async () => {
      const { service } = criarService({
        usuarios: [{ id: 'u1', cpf: '111.111.111-11', senha: null, ativo: true }]
      })
      await expect(service.login({ cpf: '111.111.111-11', senha: 'qualquer' } as any))
        .rejects.toBeInstanceOf(UnauthorizedException)
    })
  })

  describe('registrar', () => {
    it('cria a conta como funcionário e devolve token', async () => {
      const { service, prismaFake } = criarService()

      const resultado = await service.registrar({
        nome: 'Fulano',
        cpf: '111.111.111-11',
        email: 'fulano@teste.com',
        senha: 'SenhaForte1!',
        telefone: '11999999999',
        aceitouTermos: true
      } as any)

      expect(resultado.token).toBeTruthy()
      expect(resultado.usuario.role).toBe('funcionario')
      expect(prismaFake.usuarios).toHaveLength(1)
    })

    it('recusa CPF já cadastrado', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1', cpf: '111.111.111-11', email: 'outro@teste.com' }] })
      await expect(service.registrar({
        nome: 'X', cpf: '111.111.111-11', email: 'novo@teste.com', senha: 'SenhaForte1!', telefone: '119', aceitouTermos: true
      } as any)).rejects.toBeInstanceOf(ConflictException)
    })

    it('recusa e-mail já cadastrado', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1', cpf: '222.222.222-22', email: 'fulano@teste.com' }] })
      await expect(service.registrar({
        nome: 'X', cpf: '111.111.111-11', email: 'fulano@teste.com', senha: 'SenhaForte1!', telefone: '119', aceitouTermos: true
      } as any)).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('google', () => {
    it('recusa quando GOOGLE_CLIENT_ID não está configurado no servidor', async () => {
      const { service } = criarService({}, {})
      await expect(service.google({ credential: 'x' } as any)).rejects.toBeInstanceOf(ServiceUnavailableException)
    })
  })

  describe('solicitarReset / confirmarReset', () => {
    it('recusa reset pra e-mail não cadastrado', async () => {
      const { service } = criarService()
      await expect(service.solicitarReset({ email: 'ninguem@teste.com' } as any))
        .rejects.toBeInstanceOf(NotFoundException)
    })

    it('recusa reset pra conta do Google (sem senha local pra redefinir)', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1', email: 'g@teste.com', provedor: 'google' }] })
      await expect(service.solicitarReset({ email: 'g@teste.com' } as any))
        .rejects.toBeInstanceOf(BadRequestException)
    })

    it('fluxo completo: solicita, confirma com o código certo e efetivamente troca a senha', async () => {
      const { service, prismaFake, emailFake } = criarService({
        usuarios: [{ id: 'u1', email: 'fulano@teste.com', provedor: 'local', nome: 'Fulano' }]
      })

      await service.solicitarReset({ email: 'fulano@teste.com' } as any)
      expect(emailFake.enviarEmailResetSenha).toHaveBeenCalledTimes(1)

      const codigoEnviado = (emailFake.enviarEmailResetSenha as jest.Mock).mock.calls[0][0].codigo

      await service.confirmarReset({ email: 'fulano@teste.com', codigo: codigoEnviado, novaSenha: 'NovaSenhaForte1!' } as any)

      const usuarioAtualizado = prismaFake.usuarios.find((u: any) => u.id === 'u1')
      expect(await bcrypt.compare('NovaSenhaForte1!', usuarioAtualizado.senha)).toBe(true)
      expect(usuarioAtualizado.senhaTemporaria).toBe(false)
    })

    it('recusa código de reset errado', async () => {
      const { service } = criarService({ usuarios: [{ id: 'u1', email: 'fulano@teste.com', provedor: 'local' }] })

      await service.solicitarReset({ email: 'fulano@teste.com' } as any)

      await expect(service.confirmarReset({ email: 'fulano@teste.com', codigo: '000000', novaSenha: 'NovaSenhaForte1!' } as any))
        .rejects.toBeInstanceOf(BadRequestException)
    })

    it('recusa código de reset expirado', async () => {
      const { service, prismaFake, emailFake } = criarService({
        usuarios: [{ id: 'u1', email: 'fulano@teste.com', provedor: 'local' }]
      })

      await service.solicitarReset({ email: 'fulano@teste.com' } as any)
      const codigoEnviado = (emailFake.enviarEmailResetSenha as jest.Mock).mock.calls[0][0].codigo
      prismaFake.resetCodigos[0].expiraEm = new Date(Date.now() - 1000) // já expirado

      await expect(service.confirmarReset({ email: 'fulano@teste.com', codigo: codigoEnviado, novaSenha: 'NovaSenhaForte1!' } as any))
        .rejects.toBeInstanceOf(BadRequestException)
    })

    it('um código já usado não pode ser reaproveitado', async () => {
      const { service, emailFake } = criarService({
        usuarios: [{ id: 'u1', email: 'fulano@teste.com', provedor: 'local' }]
      })

      await service.solicitarReset({ email: 'fulano@teste.com' } as any)
      const codigoEnviado = (emailFake.enviarEmailResetSenha as jest.Mock).mock.calls[0][0].codigo

      await service.confirmarReset({ email: 'fulano@teste.com', codigo: codigoEnviado, novaSenha: 'NovaSenhaForte1!' } as any)

      await expect(service.confirmarReset({ email: 'fulano@teste.com', codigo: codigoEnviado, novaSenha: 'OutraSenha1!' } as any))
        .rejects.toBeInstanceOf(BadRequestException)
    })
  })
})
