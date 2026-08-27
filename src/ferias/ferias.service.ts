import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { AuditoriaService } from '../auditoria/auditoria.service'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ehGestaoDeRh } from '../common/utils/papel.util'
import { PrismaService } from '../prisma/prisma.service'
import { DecidirFeriasDto } from './dto/decidir-ferias.dto'
import { SolicitarFeriasDto } from './dto/solicitar-ferias.dto'
import { dataSemHora, diferencaEmDias, normalizarDataDoBanco, parseDataLocal } from './ferias-datas.util'

const ANTECEDENCIA_MINIMA_DIAS = 90
const LIMITE_DIAS_POR_ANO = 60

@Injectable()
export class FeriasService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService
  ) {}

  async solicitar (usuarioId: string, dto: SolicitarFeriasDto) {
    const perfil = await this.prisma.perfilRH.findUnique({ where: { usuarioId } })
    if (!perfil) {
      throw new NotFoundException('Você ainda não tem um perfil de RH cadastrado. Fale com o RH.')
    }

    const dataInicio = parseDataLocal(dto.dataInicio)
    const dataFim = parseDataLocal(dto.dataFim)
    const dias = await this.validarRegras(usuarioId, dataInicio, dataFim)

    return await this.prisma.solicitacaoFerias.create({ data: { usuarioId, dataInicio, dataFim, dias } })
  }

  // Compartilhado por solicitar() e editar(): antecedência mínima, limite de
  // 60 dias/ano e sobreposição contra pendente+aprovada do mesmo ano.
  // `ignorarId` exclui a própria solicitação da soma/checagem de
  // sobreposição — necessário ao editar, senão ela sempre "bateria" com
  // ela mesma.
  private async validarRegras (
    usuarioId: string,
    dataInicio: Date,
    dataFim: Date,
    ignorarId?: string
  ): Promise<number> {
    if (dataFim < dataInicio) {
      throw new BadRequestException('A data de fim não pode ser anterior à data de início.')
    }
    const dias = diferencaEmDias(dataFim, dataInicio) + 1

    const hoje = dataSemHora(new Date())
    if (diferencaEmDias(dataInicio, hoje) < ANTECEDENCIA_MINIMA_DIAS) {
      throw new BadRequestException(
        `Férias precisam ser solicitadas com pelo menos ${ANTECEDENCIA_MINIMA_DIAS} dias de antecedência.`
      )
    }

    // Soma contra pendente+aprovada (não só aprovada): se todas as
    // pendentes do ano fossem aprovadas, não pode passar de 60 dias — evita
    // aprovar/rejeitar só por causa de estouro de limite depois do fato.
    const ano = dataInicio.getFullYear()
    const solicitacoesDoAno = (await this.prisma.solicitacaoFerias.findMany({
      where: { usuarioId, status: { in: ['pendente', 'aprovada'] } }
    })).filter(s => s.id !== ignorarId && normalizarDataDoBanco(s.dataInicio).getFullYear() === ano)

    const diasJaUsados = solicitacoesDoAno.reduce((soma, s) => soma + s.dias, 0)
    if (diasJaUsados + dias > LIMITE_DIAS_POR_ANO) {
      throw new BadRequestException(
        `Você já tem ${diasJaUsados} dia(s) de férias solicitados/aprovados em ${ano}. Esta solicitação de ${dias} dia(s) ultrapassaria o limite de ${LIMITE_DIAS_POR_ANO} dias por ano.`
      )
    }

    const sobrepoe = solicitacoesDoAno.some(s => {
      const inicioExistente = normalizarDataDoBanco(s.dataInicio)
      const fimExistente = normalizarDataDoBanco(s.dataFim)
      return dataInicio <= fimExistente && dataFim >= inicioExistente
    })
    if (sobrepoe) {
      throw new ConflictException('Já existe uma solicitação sua (pendente ou aprovada) que se sobrepõe a este período.')
    }

    return dias
  }

  // Admin/RH corrigindo as datas de uma solicitação ainda pendente (ex.:
  // ajuste combinado com o funcionário) — diferente de decidir(), que só
  // aprova/rejeita. Reaplica as mesmas regras de solicitar() contra a nova
  // data, excluindo a própria solicitação da soma/sobreposição.
  async editar (id: string, dto: SolicitarFeriasDto, solicitante: UsuarioAutenticado) {
    const solicitacao = await this.prisma.solicitacaoFerias.findUnique({ where: { id } })
    if (!solicitacao) {
      throw new NotFoundException('Solicitação de férias não encontrada.')
    }
    if (solicitacao.status !== 'pendente') {
      throw new ConflictException('Só é possível editar uma solicitação ainda pendente.')
    }

    const dataInicio = parseDataLocal(dto.dataInicio)
    const dataFim = parseDataLocal(dto.dataFim)
    const dias = await this.validarRegras(solicitacao.usuarioId, dataInicio, dataFim, id)

    const atualizada = await this.prisma.solicitacaoFerias.update({
      where: { id },
      data: { dataInicio, dataFim, dias }
    })

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: 'ferias.editar',
      entidade: 'SolicitacaoFerias',
      entidadeId: id,
      dadosAntes: { dataInicio: solicitacao.dataInicio, dataFim: solicitacao.dataFim, dias: solicitacao.dias },
      dadosDepois: { dataInicio: atualizada.dataInicio, dataFim: atualizada.dataFim, dias: atualizada.dias }
    })

    return atualizada
  }

  async listar (solicitante: UsuarioAutenticado, usuarioId?: string) {
    if (!ehGestaoDeRh(solicitante.role)) {
      if (usuarioId && usuarioId !== solicitante.id) {
        throw new ForbiddenException('Você só pode ver as próprias solicitações de férias.')
      }
      return await this.prisma.solicitacaoFerias.findMany({
        where: { usuarioId: solicitante.id },
        orderBy: { dataInicio: 'desc' }
      })
    }
    return await this.prisma.solicitacaoFerias.findMany({
      where: usuarioId ? { usuarioId } : {},
      include: { usuario: { select: { nome: true } } },
      orderBy: { dataInicio: 'desc' }
    })
  }

  async decidir (id: string, dto: DecidirFeriasDto, solicitante: UsuarioAutenticado) {
    const solicitacao = await this.prisma.solicitacaoFerias.findUnique({ where: { id } })
    if (!solicitacao) {
      throw new NotFoundException('Solicitação de férias não encontrada.')
    }
    if (solicitacao.status !== 'pendente') {
      throw new ConflictException('Esta solicitação já foi decidida.')
    }

    const atualizada = await this.prisma.solicitacaoFerias.update({
      where: { id },
      data: { status: dto.status, decididoPorId: solicitante.id, decididoEm: new Date() }
    })

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: dto.status === 'aprovada' ? 'ferias.aprovar' : 'ferias.rejeitar',
      entidade: 'SolicitacaoFerias',
      entidadeId: id,
      dadosAntes: { status: solicitacao.status },
      dadosDepois: { status: atualizada.status }
    })

    return atualizada
  }
}
