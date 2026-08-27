import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { AuditoriaService } from '../auditoria/auditoria.service'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ehGestaoDeRh } from '../common/utils/papel.util'
import { ehConflitoUnico } from '../common/utils/prisma-erro.util'
import { NotificacoesService } from '../notificacoes/notificacoes.service'
import { PontoCalculoService } from '../ponto/ponto-calculo.service'
import { PrismaService } from '../prisma/prisma.service'
import { calcularHolerite } from './folha-pagamento-calculo.util'
import { GerarHoleriteDto } from './dto/gerar-holerite.dto'
import { gerarHoleritePdf } from './holerite.pdf'

@Injectable()
export class FolhaPagamentoService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly pontoCalculoService: PontoCalculoService,
    private readonly notificacoesService: NotificacoesService,
    private readonly auditoriaService: AuditoriaService
  ) {}

  // Só RH/admin gera (RolesGuard no controller). Reaproveita o mesmo resumo
  // calculado do ponto (PontoCalculoService) usado no espelho de ponto — o
  // holerite é um snapshot congelado do cálculo, não recalcula depois.
  async gerar (dto: GerarHoleriteDto, solicitante: UsuarioAutenticado) {
    const perfil = await this.prisma.perfilRH.findUnique({ where: { usuarioId: dto.usuarioId } })
    if (!perfil) {
      throw new NotFoundException('Funcionário sem perfil de RH cadastrado.')
    }

    const [ano, mes] = dto.referencia.split('-').map(Number)
    const primeiroDiaDoProximoMes = new Date(ano, mes, 1)
    if (primeiroDiaDoProximoMes > new Date()) {
      throw new BadRequestException('Só é possível gerar o holerite de um mês já encerrado.')
    }

    const resumo = await this.pontoCalculoService.resumoMes(dto.usuarioId, dto.referencia, solicitante)
    const diasEscalaNoMes = resumo.dias.filter(d => d.ehDiaDeEscala).length
    const diasTrabalhados = resumo.dias.filter(d => d.horaEntrada && d.horaSaida).length

    const calculo = calcularHolerite({
      salarioBase: Number(perfil.salarioBase),
      horasPorDia: perfil.horasPorDia,
      diasEscalaNoMes,
      faltas: resumo.totais.faltas,
      horasExtras: resumo.totais.horasExtras,
      horasForaEscala: resumo.totais.horasForaEscala,
      diasTrabalhados
    })

    let holerite
    try {
      holerite = await this.prisma.holerite.create({
        data: {
          usuarioId: dto.usuarioId,
          referencia: dto.referencia,
          salarioProporcional: calculo.salarioProporcional,
          valorHorasExtras: calculo.valorHorasExtras,
          valorHorasForaEscala: calculo.valorHorasForaEscala,
          valorVr: calculo.valorVr,
          valorVa: calculo.valorVa,
          inss: calculo.inss,
          irrf: calculo.irrf,
          salarioLiquido: calculo.salarioLiquido,
          geradoPorId: solicitante.id
        }
      })
    } catch (erro) {
      if (ehConflitoUnico(erro)) {
        throw new ConflictException('Já existe um holerite gerado para este funcionário nesta referência.')
      }
      throw erro
    }

    await this.notificacoesService.criar({
      usuarioId: dto.usuarioId,
      tipo: 'holerite',
      titulo: `Holerite — ${dto.referencia}`,
      mensagem: 'Seu holerite do mês está disponível. Revise e assine para poder baixá-lo.',
      holeriteId: holerite.id
    })

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: 'holerite.gerar',
      entidade: 'Holerite',
      entidadeId: holerite.id,
      dadosDepois: { usuarioId: dto.usuarioId, referencia: dto.referencia, salarioLiquido: calculo.salarioLiquido }
    })

    return holerite
  }

  // Histórico: funcionário só vê o próprio; rh/admin veem de todo mundo (ou
  // filtram por usuarioId).
  async listar (solicitante: UsuarioAutenticado, usuarioId?: string) {
    if (!ehGestaoDeRh(solicitante.role)) {
      return await this.prisma.holerite.findMany({
        where: { usuarioId: solicitante.id },
        include: { usuario: { select: { nome: true } } },
        orderBy: { referencia: 'desc' }
      })
    }
    return await this.prisma.holerite.findMany({
      where: usuarioId ? { usuarioId } : {},
      include: { usuario: { select: { nome: true } } },
      orderBy: { referencia: 'desc' }
    })
  }

  // Só o próprio dono assina.
  async assinar (id: string, solicitante: UsuarioAutenticado) {
    const holerite = await this.prisma.holerite.findUnique({ where: { id } })
    if (!holerite) {
      throw new NotFoundException('Holerite não encontrado.')
    }
    if (holerite.usuarioId !== solicitante.id) {
      throw new ForbiddenException('Você só pode assinar o seu próprio holerite.')
    }
    if (holerite.status !== 'gerado') {
      throw new ConflictException('Este holerite já foi assinado.')
    }

    const assinatura = await this.prisma.assinaturaEletronica.findUnique({ where: { usuarioId: solicitante.id } })
    if (!assinatura) {
      throw new BadRequestException('Cadastre sua assinatura eletrônica antes de assinar documentos.')
    }

    return await this.prisma.holerite.update({
      where: { id },
      data: { status: 'assinado', assinadoEm: new Date() }
    })
  }

  // Só RH/admin (RolesGuard no controller) — "pagamento" é sempre simulado,
  // mas exige assinatura prévia e não pode ser repetido (protege contra
  // pagar duas vezes por engano).
  async pagar (id: string, solicitante: UsuarioAutenticado) {
    const holerite = await this.prisma.holerite.findUnique({ where: { id } })
    if (!holerite) {
      throw new NotFoundException('Holerite não encontrado.')
    }
    if (holerite.status === 'gerado') {
      throw new BadRequestException('O holerite precisa estar assinado pelo funcionário antes de ser pago.')
    }
    if (holerite.status === 'pago') {
      throw new ConflictException('Este holerite já foi pago.')
    }

    const atualizado = await this.prisma.holerite.update({
      where: { id },
      data: { status: 'pago', pagoEm: new Date() }
    })

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: 'holerite.pagar',
      entidade: 'Holerite',
      entidadeId: id,
      dadosDepois: { salarioLiquido: Number(holerite.salarioLiquido) }
    })

    return atualizado
  }

  // PDF só sai depois de assinado.
  async gerarPdf (id: string, solicitante: UsuarioAutenticado): Promise<Buffer> {
    const holerite = await this.prisma.holerite.findUnique({
      where: { id },
      include: {
        usuario: { include: { perfilRH: true, assinaturaEletronica: true } },
        geradoPor: { select: { nome: true } }
      }
    })
    if (!holerite) {
      throw new NotFoundException('Holerite não encontrado.')
    }
    if (!ehGestaoDeRh(solicitante.role) && solicitante.id !== holerite.usuarioId) {
      throw new ForbiddenException('Você só pode baixar o seu próprio holerite.')
    }
    if (holerite.status === 'gerado' || !holerite.assinadoEm || !holerite.usuario.assinaturaEletronica) {
      throw new BadRequestException('Este holerite ainda não foi assinado.')
    }

    return await gerarHoleritePdf({
      nomeFuncionario: holerite.usuario.nome,
      cargo: holerite.usuario.perfilRH?.cargo || '-',
      referencia: holerite.referencia,
      salarioProporcional: Number(holerite.salarioProporcional),
      valorHorasExtras: Number(holerite.valorHorasExtras),
      valorHorasForaEscala: Number(holerite.valorHorasForaEscala),
      valorVr: Number(holerite.valorVr),
      valorVa: Number(holerite.valorVa),
      inss: Number(holerite.inss),
      irrf: Number(holerite.irrf),
      salarioLiquido: Number(holerite.salarioLiquido),
      nomeGeradoPor: holerite.geradoPor.nome,
      assinadoEm: holerite.assinadoEm,
      assinaturaDataUri: holerite.usuario.assinaturaEletronica.imagemDataUri
    })
  }
}
