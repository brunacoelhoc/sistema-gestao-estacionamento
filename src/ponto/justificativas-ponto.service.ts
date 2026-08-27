import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { AuditoriaService } from '../auditoria/auditoria.service'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ehGestaoDeRh } from '../common/utils/papel.util'
import { ehConflitoUnico } from '../common/utils/prisma-erro.util'
import { PrismaService } from '../prisma/prisma.service'
import { CriarJustificativaDto } from './dto/criar-justificativa.dto'
import { parseDataLocal } from './ponto-datas.util'

@Injectable()
export class JustificativasPontoService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService
  ) {}

  // Só RH/admin criam (RolesGuard no controller) — o próprio funcionário
  // nunca lança a própria justificativa.
  async criar (dto: CriarJustificativaDto, solicitante: UsuarioAutenticado) {
    const perfil = await this.prisma.perfilRH.findUnique({ where: { usuarioId: dto.usuarioId } })
    if (!perfil) {
      throw new NotFoundException('Funcionário sem perfil de RH cadastrado.')
    }

    const data = parseDataLocal(dto.data)

    try {
      const justificativa = await this.prisma.justificativaPonto.create({
        data: {
          usuarioId: dto.usuarioId,
          data,
          tipo: dto.tipo,
          descricao: dto.descricao || null,
          criadoPorId: solicitante.id
        }
      })

      await this.auditoriaService.registrar({
        usuarioId: solicitante.id,
        papel: solicitante.role,
        acao: 'justificativa-ponto.criar',
        entidade: 'JustificativaPonto',
        entidadeId: justificativa.id,
        dadosDepois: { usuarioId: dto.usuarioId, data: dto.data, tipo: dto.tipo }
      })

      return justificativa
    } catch (erro) {
      if (ehConflitoUnico(erro)) {
        throw new ConflictException('Já existe uma justificativa lançada para este funcionário nesta data.')
      }
      throw erro
    }
  }

  async listar (solicitante: UsuarioAutenticado, usuarioId?: string) {
    if (!ehGestaoDeRh(solicitante.role)) {
      if (usuarioId && usuarioId !== solicitante.id) {
        throw new ForbiddenException('Você só pode ver as próprias justificativas.')
      }
      return await this.prisma.justificativaPonto.findMany({
        where: { usuarioId: solicitante.id },
        orderBy: { data: 'desc' }
      })
    }
    return await this.prisma.justificativaPonto.findMany({
      where: usuarioId ? { usuarioId } : {},
      orderBy: { data: 'desc' }
    })
  }
}
