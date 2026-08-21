import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { Prisma, type Usuario } from '../../generated/prisma'
import { AuthService } from '../auth/auth.service'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto'
import { CriarUsuarioDto } from './dto/criar-usuario.dto'

function semSenha (usuario: Usuario) {
  const { senha, ...resto } = usuario
  return resto
}

function ehConflitoUnico (erro: unknown): erro is Prisma.PrismaClientKnownRequestError {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002'
}

@Injectable()
export class UsuariosService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly authService: AuthService
  ) {}

  // Só admin lista todos os usuários — evita expor a base inteira (inclusive
  // hash de senha) para qualquer funcionário logado. A checagem de admin é
  // feita pelo AdminGuard na rota.
  async listar () {
    const usuarios = await this.prisma.usuario.findMany()
    return usuarios.map(semSenha)
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
          role: dto.role === 'admin' ? 'admin' : 'funcionario',
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
      if (dto.role !== undefined) dados.role = dto.role === 'admin' ? 'admin' : 'funcionario'
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
