import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { AuditoriaService } from '../auditoria/auditoria.service'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ehConflitoUnico, ehViolacaoRestricaoFk } from '../common/utils/prisma-erro.util'
import { PrismaService } from '../prisma/prisma.service'
import { DefinirEtapaCarreiraDto } from './dto/definir-etapa-carreira.dto'

@Injectable()
export class EtapasCarreiraService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService
  ) {}

  // Catálogo global — qualquer usuário autenticado pode listar (o
  // funcionário precisa ver a trilha inteira pra saber "onde pode chegar",
  // não só o próprio degrau).
  async listar () {
    return await this.prisma.etapaCarreira.findMany({ orderBy: { ordem: 'asc' } })
  }

  async criar (dto: DefinirEtapaCarreiraDto, solicitante: UsuarioAutenticado) {
    try {
      const etapa = await this.prisma.etapaCarreira.create({
        data: {
          ordem: dto.ordem,
          titulo: dto.titulo,
          faixaSalarial: dto.faixaSalarial || null,
          descricao: dto.descricao
        }
      })

      await this.auditoriaService.registrar({
        usuarioId: solicitante.id,
        papel: solicitante.role,
        acao: 'etapa-carreira.criar',
        entidade: 'EtapaCarreira',
        entidadeId: etapa.id,
        dadosDepois: etapa
      })

      return etapa
    } catch (erro) {
      if (ehConflitoUnico(erro)) {
        throw new ConflictException('Já existe uma etapa cadastrada com essa ordem.')
      }
      throw erro
    }
  }

  async editar (id: string, dto: DefinirEtapaCarreiraDto, solicitante: UsuarioAutenticado) {
    const anterior = await this.prisma.etapaCarreira.findUnique({ where: { id } })
    if (!anterior) {
      throw new NotFoundException('Etapa de carreira não encontrada.')
    }

    try {
      const etapa = await this.prisma.etapaCarreira.update({
        where: { id },
        data: {
          ordem: dto.ordem,
          titulo: dto.titulo,
          faixaSalarial: dto.faixaSalarial || null,
          descricao: dto.descricao
        }
      })

      await this.auditoriaService.registrar({
        usuarioId: solicitante.id,
        papel: solicitante.role,
        acao: 'etapa-carreira.editar',
        entidade: 'EtapaCarreira',
        entidadeId: etapa.id,
        dadosAntes: anterior,
        dadosDepois: etapa
      })

      return etapa
    } catch (erro) {
      if (ehConflitoUnico(erro)) {
        throw new ConflictException('Já existe uma etapa cadastrada com essa ordem.')
      }
      throw erro
    }
  }

  async remover (id: string, solicitante: UsuarioAutenticado) {
    const anterior = await this.prisma.etapaCarreira.findUnique({ where: { id } })
    if (!anterior) {
      throw new NotFoundException('Etapa de carreira não encontrada.')
    }

    try {
      await this.prisma.etapaCarreira.delete({ where: { id } })
    } catch (erro) {
      // Violação de FK — algum PerfilRH.etapaCarreiraAtualId aponta pra esta
      // etapa (RESTRICT). Precisa mover o(s) funcionário(s) pra outra etapa
      // antes de remover esta do catálogo.
      if (ehViolacaoRestricaoFk(erro)) {
        throw new ConflictException('Esta etapa está atribuída a um ou mais funcionários e não pode ser removida.')
      }
      throw erro
    }

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: 'etapa-carreira.remover',
      entidade: 'EtapaCarreira',
      entidadeId: id,
      dadosAntes: anterior
    })
  }
}
