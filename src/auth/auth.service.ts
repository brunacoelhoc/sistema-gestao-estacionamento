import * as crypto from 'crypto'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import type { Usuario } from '../../generated/prisma'
import { EmailService } from '../email/email.service'
import { PrismaService } from '../prisma/prisma.service'
import { ConfirmarResetDto } from './dto/confirmar-reset.dto'
import { GoogleDto } from './dto/google.dto'
import { LoginDto } from './dto/login.dto'
import { RegistrarDto } from './dto/registrar.dto'
import { SolicitarResetDto } from './dto/solicitar-reset.dto'

const RESET_TTL_MINUTOS = 15

// Hash "fantasma" (senha aleatória descartada na hora, nunca associada a
// nenhuma conta) comparado no login quando o CPF não existe ou a conta não
// tem senha local — só pra manter o tempo de resposta igual ao caso "CPF
// existe, senha errada". Sem isso, bcrypt.compare só rodava nesse segundo
// caso, e dava pra descobrir se um CPF está cadastrado apenas medindo
// quanto tempo o login demora pra responder.
const HASH_FANTASMA = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12)

function semSenha (usuario: Usuario) {
  const { senha, ...resto } = usuario
  return resto
}

function gerarCodigoReset (): string {
  return String(crypto.randomInt(100000, 1000000))
}

// Nunca guardamos o código em texto puro — só o hash, igual senha.
function hashCodigoReset (codigo: string): string {
  return crypto.createHash('sha256').update(codigo).digest('hex')
}

@Injectable()
export class AuthService {
  // GOOGLE_CLIENT_ID precisa ser o mesmo Client ID configurado no front-end
  // (ver GOOGLE_CLIENT_ID em assets/js/modules/auth.js) — Client ID não é
  // segredo, é seguro deixá-lo público no navegador. Sem ele configurado no
  // .env, o login com Google fica desativado.
  private readonly googleClientId: string | null
  private readonly googleClient: OAuth2Client | null

  constructor (
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    configService: ConfigService
  ) {
    this.googleClientId = configService.get<string>('GOOGLE_CLIENT_ID') || null
    this.googleClient = this.googleClientId ? new OAuth2Client(this.googleClientId) : null
  }

  // cpfPendente vai no token para o ProfileCompleteGuard decidir sem
  // precisar consultar o banco a cada requisição. Contas criadas via Google
  // nascem sem CPF — cpfPendente fica true até o usuário completar o
  // cadastro (a rota que grava o CPF precisa gerar um token novo, senão o
  // token antigo continuaria "preso" com o valor de quando foi emitido).
  gerarToken (usuario: Pick<Usuario, 'id' | 'role' | 'nome' | 'cpf'>): string {
    return this.jwtService.sign({
      id: usuario.id,
      role: usuario.role,
      nome: usuario.nome,
      cpfPendente: !usuario.cpf
    })
  }

  // Login é por CPF, igual ao comportamento atual do front (AuthService.login).
  async login (dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { cpf: dto.cpf } })

    // bcrypt.compare roda sempre, mesmo sem usuário/senha — contra o hash
    // fantasma nesse caso — pra não vazar por timing se o CPF existe (ver
    // HASH_FANTASMA acima).
    const senhaConfere = await bcrypt.compare(dto.senha, usuario?.senha || HASH_FANTASMA)
    if (!usuario || !usuario.senha || !senhaConfere) {
      throw new UnauthorizedException('CPF ou senha inválidos.')
    }
    if (!usuario.ativo) {
      throw new ForbiddenException('Este usuário está inativo. Fale com um administrador do sistema.')
    }

    return { token: this.gerarToken(usuario), usuario: semSenha(usuario) }
  }

  async registrar (dto: RegistrarDto) {
    const [cpfExistente, emailExistente] = await Promise.all([
      this.prisma.usuario.findUnique({ where: { cpf: dto.cpf } }),
      this.prisma.usuario.findUnique({ where: { email: dto.email } })
    ])
    if (cpfExistente) throw new ConflictException('Já existe uma conta cadastrada com este CPF.')
    if (emailExistente) throw new ConflictException('Já existe uma conta cadastrada com este e-mail.')

    const usuario = await this.prisma.usuario.create({
      data: {
        nome: dto.nome,
        cpf: dto.cpf,
        email: dto.email,
        senha: await bcrypt.hash(dto.senha, 12),
        telefone: dto.telefone,
        role: 'funcionario',
        ativo: true,
        aceitouTermos: Boolean(dto.aceitouTermos),
        provedor: 'local',
        senhaAlteradaEm: new Date()
      }
    })

    return { token: this.gerarToken(usuario), usuario: semSenha(usuario) }
  }

  // Login/cadastro via Google. O front-end manda o ID token bruto
  // (credentialResponse.credential) e é ESTE método que verifica a
  // assinatura com a chave pública do Google — o front não decodifica mais o
  // token por conta própria, então não dá pra forjar nome/e-mail.
  async google (dto: GoogleDto) {
    if (!this.googleClient) {
      throw new ServiceUnavailableException(
        'Login com Google não está configurado neste servidor (GOOGLE_CLIENT_ID ausente).'
      )
    }

    let payload
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.credential,
        audience: this.googleClientId as string
      })
      payload = ticket.getPayload()
    } catch {
      throw new UnauthorizedException('Credencial do Google inválida ou expirada.')
    }

    const email = payload?.email
    const nome = payload?.name
    if (!email) {
      throw new BadRequestException('Não foi possível ler os dados da conta Google.')
    }

    let usuario = await this.prisma.usuario.findUnique({ where: { email } })
    if (!usuario) {
      usuario = await this.prisma.usuario.create({
        data: {
          nome: nome || email,
          email,
          role: 'funcionario',
          ativo: true,
          aceitouTermos: true,
          provedor: 'google'
        }
      })
    }

    if (!usuario.ativo) {
      throw new ForbiddenException('Este usuário está inativo. Fale com um administrador do sistema.')
    }

    return { token: this.gerarToken(usuario), usuario: semSenha(usuario) }
  }

  // Recuperação de senha: gera um código de 6 dígitos, guarda só o hash dele
  // (com expiração de RESET_TTL_MINUTOS) e envia o código por e-mail de
  // verdade via EmailService.
  async solicitarReset (dto: SolicitarResetDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email: dto.email } })
    if (!usuario) {
      throw new NotFoundException('Não encontramos uma conta com este e-mail.')
    }
    if (usuario.provedor === 'google') {
      throw new BadRequestException('Esta conta usa login do Google e não tem senha para redefinir.')
    }

    const codigo = gerarCodigoReset()
    const expiraEm = new Date(Date.now() + RESET_TTL_MINUTOS * 60 * 1000)

    await this.prisma.$transaction(async tx => {
      // Invalida códigos anteriores ainda não usados — só o mais recente vale.
      await tx.resetSenhaCodigo.deleteMany({ where: { usuarioId: usuario.id, usado: false } })
      await tx.resetSenhaCodigo.create({
        data: { usuarioId: usuario.id, codigoHash: hashCodigoReset(codigo), expiraEm }
      })
    })

    await this.emailService.enviarEmailResetSenha({ to: usuario.email, nome: usuario.nome, codigo })

    return { ok: true }
  }

  // Confere o código de verificação (hash + expiração + uso único) antes de
  // trocar a senha. Igual ao login, a mensagem de erro não distingue "código
  // errado" de "código expirado" pra não dar pista a quem estiver tentando
  // adivinhar.
  async confirmarReset (dto: ConfirmarResetDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email: dto.email } })
    if (!usuario) throw new NotFoundException('Usuário não encontrado.')

    const registro = await this.prisma.resetSenhaCodigo.findFirst({
      where: { usuarioId: usuario.id, usado: false },
      orderBy: { criadoEm: 'desc' }
    })

    const codigoValido =
      registro &&
      registro.expiraEm > new Date() &&
      registro.codigoHash === hashCodigoReset(dto.codigo)

    if (!codigoValido) {
      throw new BadRequestException('Código de verificação inválido ou expirado.')
    }

    const senhaHash = await bcrypt.hash(dto.novaSenha, 12)
    await this.prisma.$transaction(async tx => {
      await tx.resetSenhaCodigo.update({ where: { id: registro.id }, data: { usado: true } })
      await tx.usuario.update({
        where: { id: usuario.id },
        data: { senha: senhaHash, senhaTemporaria: false, senhaAlteradaEm: new Date() }
      })
    })

    return { ok: true }
  }
}
