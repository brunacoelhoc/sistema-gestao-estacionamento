import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma'
import { PrismaService } from '../prisma/prisma.service'

export interface DesempenhoFuncionario {
  usuarioId: string
  nome: string
  totalAtendimentos: number
}

@Injectable()
export class DesempenhoService {
  constructor (private readonly prisma: PrismaService) {}

  // "Atendimento" = ticket que o funcionário fechou (cobrou/liberou o
  // veículo) — ver Ticket.atendidoPorId. Sem filtro de referência, conta o
  // histórico inteiro.
  async relatorio (referencia?: string): Promise<DesempenhoFuncionario[]> {
    const where: Prisma.TicketWhereInput = { status: 'fechado', atendidoPorId: { not: null } }
    if (referencia) {
      const [ano, mes] = referencia.split('-').map(Number)
      where.dataSaida = { gte: new Date(ano, mes - 1, 1), lt: new Date(ano, mes, 1) }
    }

    const agrupado = await this.prisma.ticket.groupBy({
      by: ['atendidoPorId'],
      where,
      _count: { _all: true }
    })

    const idsComAtendimento = agrupado.map(g => g.atendidoPorId as string)
    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: idsComAtendimento } },
      select: { id: true, nome: true }
    })
    const nomePorId = new Map(usuarios.map(u => [u.id, u.nome]))

    return agrupado
      .map(g => ({
        usuarioId: g.atendidoPorId as string,
        nome: nomePorId.get(g.atendidoPorId as string) || '—',
        totalAtendimentos: g._count._all
      }))
      .sort((a, b) => b.totalAtendimentos - a.totalAtendimentos)
  }
}
