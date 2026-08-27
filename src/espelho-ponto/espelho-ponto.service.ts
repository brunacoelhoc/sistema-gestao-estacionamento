import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { AuditoriaService } from '../auditoria/auditoria.service'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ehGestaoDeRh } from '../common/utils/papel.util'
import { ehConflitoUnico } from '../common/utils/prisma-erro.util'
import { NotificacoesService } from '../notificacoes/notificacoes.service'
import { PontoCalculoService } from '../ponto/ponto-calculo.service'
import { PrismaService } from '../prisma/prisma.service'
import { GerarEspelhoPontoDto } from './dto/gerar-espelho-ponto.dto'
import { gerarEspelhoPontoPdf } from './espelho-ponto.pdf'

@Injectable()
export class EspelhoPontoService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly pontoCalculoService: PontoCalculoService,
    private readonly notificacoesService: NotificacoesService,
    private readonly auditoriaService: AuditoriaService
  ) {}

  // Só RH/admin gera (RolesGuard no controller). O resumo vem do mesmo
  // PontoCalculoService usado pela tela de ponto — o espelho é um snapshot
  // congelado dele no momento da geração, não recalcula depois.
  async gerar (dto: GerarEspelhoPontoDto, solicitante: UsuarioAutenticado) {
    const perfil = await this.prisma.perfilRH.findUnique({ where: { usuarioId: dto.usuarioId } })
    if (!perfil) {
      throw new NotFoundException('Funcionário sem perfil de RH cadastrado.')
    }

    const [ano, mes] = dto.referencia.split('-').map(Number)
    const primeiroDiaDoProximoMes = new Date(ano, mes, 1)
    if (primeiroDiaDoProximoMes > new Date()) {
      throw new BadRequestException('Só é possível gerar o espelho de um mês já encerrado.')
    }

    const resumo = await this.pontoCalculoService.resumoMes(dto.usuarioId, dto.referencia, solicitante)

    let folha
    try {
      folha = await this.prisma.folhaPontoMensal.create({
        data: {
          usuarioId: dto.usuarioId,
          referencia: dto.referencia,
          horasNormais: resumo.totais.horasNormais,
          horasExtras: resumo.totais.horasExtras,
          horasForaEscala: resumo.totais.horasForaEscala,
          faltas: resumo.totais.faltas,
          geradoPorId: solicitante.id
        }
      })
    } catch (erro) {
      if (ehConflitoUnico(erro)) {
        throw new ConflictException('Já existe um espelho de ponto gerado para este funcionário nesta referência.')
      }
      throw erro
    }

    await this.notificacoesService.criar({
      usuarioId: dto.usuarioId,
      tipo: 'folha_ponto',
      titulo: `Espelho de ponto — ${dto.referencia}`,
      mensagem: 'Seu espelho de ponto do mês está disponível. Revise e assine para poder baixá-lo.',
      folhaPontoId: folha.id
    })

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: 'espelho-ponto.gerar',
      entidade: 'FolhaPontoMensal',
      entidadeId: folha.id,
      dadosDepois: { usuarioId: dto.usuarioId, referencia: dto.referencia, totais: resumo.totais }
    })

    return folha
  }

  async listar (solicitante: UsuarioAutenticado, usuarioId?: string) {
    if (!ehGestaoDeRh(solicitante.role)) {
      return await this.prisma.folhaPontoMensal.findMany({
        where: { usuarioId: solicitante.id },
        orderBy: { referencia: 'desc' }
      })
    }
    return await this.prisma.folhaPontoMensal.findMany({
      where: usuarioId ? { usuarioId } : {},
      include: { usuario: { select: { nome: true } } },
      orderBy: { referencia: 'desc' }
    })
  }

  // Só o próprio dono assina — nem RH nem admin assinam pelo funcionário.
  async assinar (id: string, solicitante: UsuarioAutenticado) {
    const folha = await this.prisma.folhaPontoMensal.findUnique({ where: { id } })
    if (!folha) {
      throw new NotFoundException('Espelho de ponto não encontrado.')
    }
    if (folha.usuarioId !== solicitante.id) {
      throw new ForbiddenException('Você só pode assinar o seu próprio espelho de ponto.')
    }
    if (folha.status === 'assinado') {
      throw new ConflictException('Este espelho de ponto já foi assinado.')
    }

    const assinatura = await this.prisma.assinaturaEletronica.findUnique({ where: { usuarioId: solicitante.id } })
    if (!assinatura) {
      throw new BadRequestException('Cadastre sua assinatura eletrônica antes de assinar documentos.')
    }

    return await this.prisma.folhaPontoMensal.update({
      where: { id },
      data: { status: 'assinado', assinadoEm: new Date() }
    })
  }

  // PDF só sai depois de assinado (ver requisito) — funcionário baixa o
  // próprio, rh/admin podem baixar de qualquer um pra fins de conferência.
  async gerarPdf (id: string, solicitante: UsuarioAutenticado): Promise<Buffer> {
    const folha = await this.prisma.folhaPontoMensal.findUnique({
      where: { id },
      include: {
        usuario: { include: { perfilRH: true, assinaturaEletronica: true } },
        geradoPor: { select: { nome: true } }
      }
    })
    if (!folha) {
      throw new NotFoundException('Espelho de ponto não encontrado.')
    }
    if (!ehGestaoDeRh(solicitante.role) && solicitante.id !== folha.usuarioId) {
      throw new ForbiddenException('Você só pode baixar o seu próprio espelho de ponto.')
    }
    if (folha.status !== 'assinado' || !folha.assinadoEm || !folha.usuario.assinaturaEletronica) {
      throw new BadRequestException('Este espelho de ponto ainda não foi assinado.')
    }

    return await gerarEspelhoPontoPdf({
      nomeFuncionario: folha.usuario.nome,
      cargo: folha.usuario.perfilRH?.cargo || '-',
      referencia: folha.referencia,
      horasNormais: Number(folha.horasNormais),
      horasExtras: Number(folha.horasExtras),
      horasForaEscala: Number(folha.horasForaEscala),
      faltas: folha.faltas,
      nomeGeradoPor: folha.geradoPor.nome,
      assinadoEm: folha.assinadoEm,
      assinaturaDataUri: folha.usuario.assinaturaEletronica.imagemDataUri
    })
  }
}
