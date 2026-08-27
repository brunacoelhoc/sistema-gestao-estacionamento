import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { Prisma, type Usuario } from '../../generated/prisma'
import { AuthService } from '../auth/auth.service'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { mascararCpf } from '../common/utils/mascarar-cpf.util'
import { ehConflitoUnico } from '../common/utils/prisma-erro.util'
import { PrismaService } from '../prisma/prisma.service'
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto'
import { CriarUsuarioDto } from './dto/criar-usuario.dto'

const PAPEIS_VALIDOS = ['admin', 'rh', 'gestor', 'funcionario']

// Normaliza qualquer valor fora de PAPEIS_VALIDOS para 'funcionario' (nunca
// concede um papel elevado por engano) — os DTOs já validam com @IsIn, isto
// é só a segunda camada de defesa dentro do service.
function normalizarRole (role: string | undefined): 'admin' | 'rh' | 'gestor' | 'funcionario' {
  return PAPEIS_VALIDOS.includes(role || '') ? (role as 'admin' | 'rh' | 'gestor' | 'funcionario') : 'funcionario'
}

function semSenha (usuario: Usuario) {
  const { senha, ...resto } = usuario
  // temSenha permite ao front saber se a conta já tem senha local
  // cadastrada (mesmo vinda do Google) sem nunca expor o hash em si.
  return { ...resto, temSenha: Boolean(senha) }
}

@Injectable()
export class UsuariosService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly authService: AuthService
  ) {}

  // Só admin lista todos os usuários — evita expor a base inteira (inclusive
  // hash de senha) para qualquer funcionário logado. A checagem de admin é
  // feita pelo AdminGuard na rota. O CPF sai mascarado da listagem — o valor
  // completo só é devolvido por buscarPorId, ao abrir um registro específico.
  //
  // Ordenação por nome feita aqui em JS (localeCompare com locale pt-BR),
  // não com orderBy do Postgres — mesmo motivo do VagasService.listarTodas:
  // a collation padrão do banco não trata acentuação/maiúsculas do jeito
  // que uma pessoa brasileira esperaria (ex.: "Ana" viria depois de
  // "Álvaro" só por causa do acento).
  async listar () {
    const usuarios = await this.prisma.usuario.findMany()
    return usuarios
      .map(u => ({ ...semSenha(u), cpf: mascararCpf(u.cpf) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
  }

  async buscarPorId (id: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } })
    return usuario ? semSenha(usuario) : null
  }

  async existeCpfDuplicado (cpf: string, excluirId?: string) {
    const encontrado = await this.prisma.usuario.findFirst({
      where: { cpf, ...(excluirId ? { id: { not: excluirId } } : {}) }
    })
    return Boolean(encontrado)
  }

  // Cadastro de funcionário feito pelo admin (painel "Funcionários").
  async criarFuncionario (dto: CriarUsuarioDto) {
    try {
      const usuario = await this.prisma.usuario.create({
        data: {
          nome: dto.nome,
          cpf: dto.cpf || null,
          email: dto.email,
          senha: await bcrypt.hash(dto.senha, 12),
          telefone: dto.telefone || null,
          endereco: dto.endereco || null,
          dataNascimento: dto.dataNascimento ? new Date(dto.dataNascimento) : null,
          role: normalizarRole(dto.role),
          ativo: true,
          aceitouTermos: true,
          provedor: 'local',
          senhaTemporaria: true
        }
      })
      return semSenha(usuario)
    } catch (erro) {
      if (ehConflitoUnico(erro)) {
        throw new ConflictException('Já existe um usuário cadastrado com este CPF ou e-mail.')
      }
      throw erro
    }
  }

  // Usado tanto pelo modal "Meu Perfil" (dono da conta) quanto pelo admin.
  async atualizarPerfil (id: string, dto: AtualizarUsuarioDto, solicitante: UsuarioAutenticado) {
    const souEuMesmo = solicitante.id === id
    if (!souEuMesmo && solicitante.role !== 'admin') {
      throw new ForbiddenException('Você só pode editar o seu próprio perfil.')
    }

    const dados: Prisma.UsuarioUpdateInput = {}
    if (dto.nome !== undefined) dados.nome = dto.nome
    if (dto.cpf !== undefined) dados.cpf = dto.cpf
    if (dto.email !== undefined) dados.email = dto.email
    if (dto.telefone !== undefined) dados.telefone = dto.telefone
    if (dto.endereco !== undefined) dados.endereco = dto.endereco
    if (dto.dataNascimento !== undefined) {
      dados.dataNascimento = dto.dataNascimento ? new Date(dto.dataNascimento) : null
    }
    if (dto.avatar !== undefined) dados.avatar = dto.avatar

    if (dto.senha) {
      // Quando o dono da conta troca a própria senha pelo "Meu Perfil" e
      // manda a senha atual, confirmamos com bcrypt antes de trocar — evita
      // que alguém com a sessão aberta troque a senha sem saber a atual. A
      // troca obrigatória (temporária/expirada) não manda senhaAtual, então
      // pula essa checagem — o usuário já provou identidade ao logar.
      if (dto.senhaAtual) {
        const usuarioAtual = await this.prisma.usuario.findUnique({ where: { id } })
        const confere = usuarioAtual?.senha && (await bcrypt.compare(dto.senhaAtual, usuarioAtual.senha))
        if (!confere) {
          throw new BadRequestException('Senha atual incorreta.')
        }
      }
      dados.senha = await bcrypt.hash(dto.senha, 12)
      // O próprio dono trocando a senha (perfil ou troca obrigatória) já
      // conta como definitiva; senha redefinida pelo admin para outra conta
      // fica marcada como temporária, obrigando a troca no próximo login.
      dados.senhaTemporaria = !souEuMesmo
      dados.senhaAlteradaEm = souEuMesmo ? new Date() : null
    }

    // Só admin pode alterar papel/status de qualquer conta (inclusive a própria).
    if (solicitante.role === 'admin') {
      if (dto.role !== undefined) dados.role = normalizarRole(dto.role)
      if (dto.ativo !== undefined) dados.ativo = Boolean(dto.ativo)
    }

    try {
      const usuario = await this.prisma.usuario.update({ where: { id }, data: dados })

      // Quando o próprio dono da conta preenche o CPF (ex.: onboarding de
      // login via Google), o token JWT já emitido continua com o claim
      // antigo (cpfPendente: true) até expirar. Reemitir aqui evita deixar a
      // sessão "presa" fora das rotas protegidas por ProfileCompleteGuard
      // até um novo login.
      const resposta: ReturnType<typeof semSenha> & { token?: string } = semSenha(usuario)
      if (souEuMesmo) resposta.token = this.authService.gerarToken(usuario)

      return resposta
    } catch (erro) {
      if (ehConflitoUnico(erro)) {
        const alvo = (erro.meta?.target as string[] | undefined) || []
        const campo = alvo.includes('cpf') ? 'CPF' : 'e-mail'
        throw new ConflictException(`Este ${campo} já está em uso por outra conta.`)
      }
      throw erro
    }
  }
}
