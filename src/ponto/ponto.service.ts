import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ehGestaoDeRh } from '../common/utils/papel.util'
import { PrismaService } from '../prisma/prisma.service'
import { dataSemHora } from './ponto-datas.util'

@Injectable()
export class PontoService {
  constructor (private readonly prisma: PrismaService) {}

  // Chamado quando o funcionário abre a tela de ponto (entrada) ou aperta o
  // botão "bater ponto" (saída) — o horário vem sempre do relógio do
  // servidor (new Date()), nunca do cliente, pra não dar pra fraudar.
  async registrarEntrada (usuarioId: string) {
    const perfil = await this.prisma.perfilRH.findUnique({ where: { usuarioId } })
    if (!perfil) {
      throw new NotFoundException('Você ainda não tem um perfil de RH cadastrado. Fale com o RH.')
    }

    const agora = new Date()
    const data = dataSemHora(agora)
    const diaDaSemana = agora.getDay()

    const existente = await this.prisma.registroPonto.findUnique({ where: { usuarioId_data: { usuarioId, data } } })
    if (existente) {
      throw new ConflictException('Você já registrou entrada hoje.')
    }

    const ehDiaDeEscala = perfil.diasEscala.includes(diaDaSemana)
    if (!ehDiaDeEscala) {
      // Fora da escala só com autorização prévia aprovada (ver
      // SolicitacaoTrabalhoExtra) — sem isso, o funcionário simplesmente não
      // consegue bater ponto num dia que não é dele.
      const autorizacao = await this.prisma.solicitacaoTrabalhoExtra.findUnique({
        where: { usuarioId_data: { usuarioId, data } }
      })
      if (!autorizacao || autorizacao.status !== 'aprovada') {
        throw new ForbiddenException(
          'Hoje não é um dia da sua escala. Trabalhar fora da escala exige uma solicitação aprovada previamente.'
        )
      }
    }

    return await this.prisma.registroPonto.create({ data: { usuarioId, data, horaEntrada: agora } })
  }

  async registrarSaida (usuarioId: string) {
    const agora = new Date()
    const data = dataSemHora(agora)

    const existente = await this.prisma.registroPonto.findUnique({ where: { usuarioId_data: { usuarioId, data } } })
    if (!existente) {
      throw new ConflictException('Registre a entrada antes de registrar a saída.')
    }
    if (existente.horaSaida) {
      throw new ConflictException('Você já registrou saída hoje.')
    }

    return await this.prisma.registroPonto.update({ where: { id: existente.id }, data: { horaSaida: agora } })
  }

  // Só rh/admin veem o ponto de terceiros; qualquer outro papel (funcionário,
  // gestor) só o próprio — mesmo padrão de "guard grosso na rota + checagem
  // fina no service" do resto do módulo de RH.
  async listar (usuarioId: string, solicitante: UsuarioAutenticado, referencia?: string) {
    if (!ehGestaoDeRh(solicitante.role) && solicitante.id !== usuarioId) {
      throw new ForbiddenException('Você só pode ver o seu próprio ponto.')
    }

    const where: { usuarioId: string, data?: { gte: Date, lt: Date } } = { usuarioId }
    if (referencia) {
      const [ano, mes] = referencia.split('-').map(Number)
      where.data = { gte: new Date(ano, mes - 1, 1), lt: new Date(ano, mes, 1) }
    }

    return await this.prisma.registroPonto.findMany({ where, orderBy: { data: 'asc' } })
  }
}
