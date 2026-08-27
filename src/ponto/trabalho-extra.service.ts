import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { AuditoriaService } from '../auditoria/auditoria.service'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ehGestaoDeRh } from '../common/utils/papel.util'
import { ehConflitoUnico } from '../common/utils/prisma-erro.util'
import { PrismaService } from '../prisma/prisma.service'
import { DecidirTrabalhoExtraDto } from './dto/decidir-trabalho-extra.dto'
import { SolicitarTrabalhoExtraDto } from './dto/solicitar-trabalho-extra.dto'
import { dataSemHora, parseDataLocal } from './ponto-datas.util'

@Injectable()
export class TrabalhoExtraService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService
  ) {}

  // O próprio funcionário pede autorização prévia pra trabalhar num dia
  // fora da sua escala — só depois de aprovada por rh/admin é que
  // PontoService.registrarEntrada aceita o ponto naquele dia.
  async solicitar (usuarioId: string, dto: SolicitarTrabalhoExtraDto) {
    const perfil = await this.prisma.perfilRH.findUnique({ where: { usuarioId } })
    if (!perfil) {
      throw new NotFoundException('Você ainda não tem um perfil de RH cadastrado. Fale com o RH.')
    }

    const data = parseDataLocal(dto.data)
    if (perfil.diasEscala.includes(data.getDay())) {
      throw new BadRequestException('Este já é um dia da sua escala normal — não precisa de autorização.')
    }
    if (data < dataSemHora(new Date())) {
      throw new BadRequestException('Não é possível solicitar para uma data passada.')
    }

    try {
      return await this.prisma.solicitacaoTrabalhoExtra.create({
        data: { usuarioId, data, motivo: dto.motivo }
      })
    } catch (erro) {
      if (ehConflitoUnico(erro)) {
        throw new ConflictException('Você já tem uma solicitação para esta data.')
      }
      throw erro
    }
  }

  // Funcionário só vê as próprias solicitações; rh/admin veem de todo mundo
  // (ou filtram por usuarioId). Inclui o nome do funcionário — só rh/admin
  // precisam disso (tela de aprovação), mas incluir sempre é inofensivo.
  async listar (solicitante: UsuarioAutenticado, usuarioId?: string) {
    if (!ehGestaoDeRh(solicitante.role)) {
      return await this.prisma.solicitacaoTrabalhoExtra.findMany({
        where: { usuarioId: solicitante.id },
        orderBy: { data: 'desc' }
      })
    }
    return await this.prisma.solicitacaoTrabalhoExtra.findMany({
      where: usuarioId ? { usuarioId } : {},
      include: { usuario: { select: { nome: true } } },
      orderBy: { data: 'desc' }
    })
  }

  async decidir (id: string, dto: DecidirTrabalhoExtraDto, solicitante: UsuarioAutenticado) {
    const solicitacao = await this.prisma.solicitacaoTrabalhoExtra.findUnique({ where: { id } })
    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada.')
    }
    if (solicitacao.status !== 'pendente') {
      throw new ConflictException('Esta solicitação já foi decidida.')
    }

    const atualizada = await this.prisma.solicitacaoTrabalhoExtra.update({
      where: { id },
      data: { status: dto.status, aprovadoPorId: solicitante.id, aprovadoEm: new Date() }
    })

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: dto.status === 'aprovada' ? 'trabalho-extra.aprovar' : 'trabalho-extra.rejeitar',
      entidade: 'SolicitacaoTrabalhoExtra',
      entidadeId: id,
      dadosAntes: { status: solicitacao.status },
      dadosDepois: { status: atualizada.status }
    })

    return atualizada
  }
}
