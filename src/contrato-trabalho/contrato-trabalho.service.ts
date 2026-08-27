import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { AuditoriaService } from '../auditoria/auditoria.service'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ehGestaoDeRh } from '../common/utils/papel.util'
import { ehConflitoUnico } from '../common/utils/prisma-erro.util'
import { NotificacoesService } from '../notificacoes/notificacoes.service'
import { PrismaService } from '../prisma/prisma.service'
import { gerarContratoTrabalhoPdf } from './contrato-trabalho.pdf'
import { GerarContratoTrabalhoDto } from './dto/gerar-contrato-trabalho.dto'

@Injectable()
export class ContratoTrabalhoService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly notificacoesService: NotificacoesService,
    private readonly auditoriaService: AuditoriaService
  ) {}

  // Só RH/admin gera (RolesGuard no controller). Congela os campos do
  // PerfilRH no momento da geração — uma edição posterior do perfil não
  // altera versões já criadas (ver comentário do model ContratoTrabalho).
  async gerar (dto: GerarContratoTrabalhoDto, solicitante: UsuarioAutenticado) {
    const perfil = await this.prisma.perfilRH.findUnique({
      where: { usuarioId: dto.usuarioId },
      include: { gestor: { select: { nome: true, perfilRH: { select: { cargo: true } } } } }
    })
    if (!perfil) {
      throw new NotFoundException('Funcionário sem perfil de RH cadastrado.')
    }

    const ultima = await this.prisma.contratoTrabalho.findFirst({
      where: { usuarioId: dto.usuarioId },
      orderBy: { numeroVersao: 'desc' }
    })
    const numeroVersao = (ultima?.numeroVersao ?? 0) + 1

    let contrato
    try {
      contrato = await this.prisma.contratoTrabalho.create({
        data: {
          usuarioId: dto.usuarioId,
          numeroVersao,
          cargo: perfil.cargo,
          vagaOrigem: perfil.vagaOrigem,
          tipoContrato: perfil.tipoContrato,
          dataAdmissao: perfil.dataAdmissao,
          diasEscala: perfil.diasEscala,
          horasPorDia: perfil.horasPorDia,
          horaInicioEscala: perfil.horaInicioEscala,
          salarioBase: perfil.salarioBase,
          tipoValeTransporte: perfil.tipoValeTransporte,
          bonusDesempenho: perfil.bonusDesempenho,
          observacoesBeneficios: perfil.observacoesBeneficios,
          direitos: perfil.direitos,
          deveres: perfil.deveres,
          tarefas: perfil.tarefas,
          nomeGestorNoMomento: perfil.gestor?.nome || null,
          cargoGestorNoMomento: perfil.gestor?.perfilRH?.cargo || null,
          geradoPorId: solicitante.id
        }
      })
    } catch (erro) {
      if (ehConflitoUnico(erro)) {
        throw new ConflictException('Uma nova versão já está sendo gerada para este funcionário. Tente novamente.')
      }
      throw erro
    }

    await this.notificacoesService.criar({
      usuarioId: dto.usuarioId,
      tipo: 'contrato',
      titulo: `Nova versão do contrato de trabalho — v${numeroVersao}`,
      mensagem: 'Uma nova versão do seu contrato está disponível. Revise e assine para poder baixá-la.',
      contratoId: contrato.id
    })

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: 'contrato-trabalho.gerar',
      entidade: 'ContratoTrabalho',
      entidadeId: contrato.id,
      dadosDepois: { usuarioId: dto.usuarioId, numeroVersao, cargo: contrato.cargo, salarioBase: contrato.salarioBase.toString() }
    })

    return contrato
  }

  async listar (solicitante: UsuarioAutenticado, usuarioId?: string) {
    if (!ehGestaoDeRh(solicitante.role)) {
      return await this.prisma.contratoTrabalho.findMany({
        where: { usuarioId: solicitante.id },
        orderBy: { numeroVersao: 'desc' }
      })
    }
    return await this.prisma.contratoTrabalho.findMany({
      where: usuarioId ? { usuarioId } : {},
      include: { usuario: { select: { nome: true } } },
      orderBy: { numeroVersao: 'desc' }
    })
  }

  // Só o próprio dono assina — nem RH nem admin assinam pelo funcionário.
  async assinar (id: string, solicitante: UsuarioAutenticado) {
    const contrato = await this.prisma.contratoTrabalho.findUnique({ where: { id } })
    if (!contrato) {
      throw new NotFoundException('Versão de contrato não encontrada.')
    }
    if (contrato.usuarioId !== solicitante.id) {
      throw new ForbiddenException('Você só pode assinar o seu próprio contrato.')
    }
    if (contrato.status === 'assinado') {
      throw new ConflictException('Esta versão do contrato já foi assinada.')
    }

    const assinatura = await this.prisma.assinaturaEletronica.findUnique({ where: { usuarioId: solicitante.id } })
    if (!assinatura) {
      throw new BadRequestException('Cadastre sua assinatura eletrônica antes de assinar documentos.')
    }

    return await this.prisma.contratoTrabalho.update({
      where: { id },
      data: { status: 'assinado', assinadoEm: new Date() }
    })
  }

  // PDF só sai depois de assinado — mesmo requisito de espelho de ponto/
  // holerite. Monta o documento a partir do snapshot gravado, nunca relê o
  // PerfilRH atual (que pode ter mudado depois desta versão ter sido gerada).
  async gerarPdf (id: string, solicitante: UsuarioAutenticado): Promise<Buffer> {
    const contrato = await this.prisma.contratoTrabalho.findUnique({
      where: { id },
      include: {
        usuario: { select: { nome: true, assinaturaEletronica: true } },
        geradoPor: { select: { nome: true } }
      }
    })
    if (!contrato) {
      throw new NotFoundException('Versão de contrato não encontrada.')
    }
    if (!ehGestaoDeRh(solicitante.role) && solicitante.id !== contrato.usuarioId) {
      throw new ForbiddenException('Você só pode baixar o seu próprio contrato.')
    }
    if (contrato.status !== 'assinado' || !contrato.assinadoEm || !contrato.usuario.assinaturaEletronica) {
      throw new BadRequestException('Esta versão do contrato ainda não foi assinada.')
    }

    return await gerarContratoTrabalhoPdf({
      nomeFuncionario: contrato.usuario.nome,
      numeroVersao: contrato.numeroVersao,
      cargo: contrato.cargo,
      vagaOrigem: contrato.vagaOrigem,
      tipoContrato: contrato.tipoContrato,
      dataAdmissao: contrato.dataAdmissao,
      diasEscala: contrato.diasEscala,
      horasPorDia: contrato.horasPorDia,
      horaInicioEscala: contrato.horaInicioEscala,
      salarioBase: Number(contrato.salarioBase),
      tipoValeTransporte: contrato.tipoValeTransporte,
      bonusDesempenho: contrato.bonusDesempenho ? Number(contrato.bonusDesempenho) : null,
      observacoesBeneficios: contrato.observacoesBeneficios,
      nomeGestor: contrato.nomeGestorNoMomento,
      cargoGestor: contrato.cargoGestorNoMomento,
      direitos: contrato.direitos,
      deveres: contrato.deveres,
      tarefas: contrato.tarefas,
      nomeGeradoPor: contrato.geradoPor.nome,
      geradoEm: contrato.geradoEm,
      assinadoEm: contrato.assinadoEm,
      assinaturaDataUri: contrato.usuario.assinaturaEletronica.imagemDataUri
    })
  }
}
