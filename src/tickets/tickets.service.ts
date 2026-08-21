import { ConflictException, Injectable } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma'
import { CobrancaService } from '../cobranca/cobranca.service'
import { MensalidadeCicloService } from '../mensalidade-ciclo/mensalidade-ciclo.service'
import { PrismaService } from '../prisma/prisma.service'
import { AbrirTicketDto } from './dto/abrir-ticket.dto'
import { FecharTicketDto } from './dto/fechar-ticket.dto'

export interface FiltrosListarTickets {
  status?: string
  termo?: string
}

export interface PaginacaoTickets {
  skip: number
  take: number
}

@Injectable()
export class TicketsService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly cobrancaService: CobrancaService,
    private readonly mensalidadeCicloService: MensalidadeCicloService
  ) {}

  private montarWhere ({ status, termo }: FiltrosListarTickets): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {}
    if (status && status.toLowerCase() !== 'todos') {
      where.status = status.toLowerCase() as Prisma.TicketWhereInput['status']
    }
    if (termo) {
      const termoBusca = termo.trim()
      where.OR = [
        { placa: { contains: termoBusca, mode: 'insensitive' } },
        { vaga: { codigo: { contains: termoBusca, mode: 'insensitive' } } }
      ]
    }
    return where
  }

  /**
   * Sem `page`, mantém o contrato antigo (array completo) — usado pelo
   * Dashboard e por Métricas, que precisam do histórico inteiro para
   * calcular KPIs. Com `page`, aplica os mesmos filtros (status, termo) e
   * devolve só a fatia pedida.
   */
  async listar (filtros: FiltrosListarTickets, paginacao?: PaginacaoTickets) {
    const where = this.montarWhere(filtros)

    if (!paginacao) {
      return this.prisma.ticket.findMany({ where, orderBy: { dataEntrada: 'desc' } })
    }

    const [dados, total] = await Promise.all([
      this.prisma.ticket.findMany({ where, orderBy: { dataEntrada: 'desc' }, skip: paginacao.skip, take: paginacao.take }),
      this.prisma.ticket.count({ where })
    ])

    return {
      dados,
      total,
      pagina: Math.floor(paginacao.skip / paginacao.take) + 1,
      totalPaginas: Math.max(1, Math.ceil(total / paginacao.take))
    }
  }

  // Abertura de ticket: valida a vaga e já marca como ocupada na mesma
  // transação, evitando o cenário de duas chamadas HTTP separadas do front
  // em que uma falha no meio do caminho deixaria ticket e vaga
  // inconsistentes entre si.
  abrir (dto: AbrirTicketDto) {
    return this.prisma.$transaction(async tx => {
      const vaga = await tx.vaga.findUnique({ where: { id: dto.vagaId } })
      if (!vaga || vaga.status === 'ocupada') {
        throw new ConflictException('A vaga selecionada já está ocupada ou é inválida.')
      }

      const placaNormalizada = dto.placa.toUpperCase().trim()

      // A tabela de Tickets não carrega mais a lista inteira no front, então
      // esta checagem — que antes rodava no cliente sobre o array completo —
      // precisa ser feita aqui para continuar valendo.
      const ticketAbertoExistente = await tx.ticket.findFirst({ where: { placa: placaNormalizada, status: 'aberto' } })
      if (ticketAbertoExistente) {
        throw new ConflictException(`A placa ${placaNormalizada} já possui um ticket aberto.`)
      }

      let mensalistaFinalId = dto.mensalistaId || null
      if (!mensalistaFinalId) {
        const mensalista = await tx.mensalista.findFirst({ where: { placa: placaNormalizada, ativo: true } })
        if (mensalista) mensalistaFinalId = mensalista.id
      }

      const novoTicket = await tx.ticket.create({
        data: {
          placa: placaNormalizada,
          vagaId: dto.vagaId,
          tarifaId: dto.tarifaId || null,
          mensalistaId: mensalistaFinalId,
          status: 'aberto'
        }
      })

      await tx.vaga.update({ where: { id: dto.vagaId }, data: { status: 'ocupada' } })

      return novoTicket
    })
  }

  /**
   * Fechamento de ticket e cálculo de tarifa — único ponto de cálculo do
   * valor cobrado, rodando no servidor.
   *
   * Mensalista ativo não paga por hora: ele paga um ciclo de 30 dias
   * corridos, cobrado de uma vez na primeira entrada em que não há ciclo
   * vigente (ver MensalidadeCicloService). Se já existe um ciclo cobrindo a
   * data de entrada deste ticket, ele fecha isento; senão, este ticket é
   * quem cobra o ciclo inteiro e o abre a partir da data de entrada.
   */
  fechar (id: string, dto: FecharTicketDto) {
    return this.prisma.$transaction(async tx => {
      const ticket = await tx.ticket.findUnique({ where: { id } })
      if (!ticket || ticket.status !== 'aberto') {
        throw new ConflictException('Ticket inválido ou já finalizado.')
      }

      const dataSaida = new Date()
      const diffMinutos = Math.max(
        1,
        Math.floor((dataSaida.getTime() - ticket.dataEntrada.getTime()) / (1000 * 60))
      )

      let valorTotal: number
      let formaPagamentoFinal = dto.formaPagamento || null
      let mensalistaCiclo: { cobradoAgora: boolean, dataInicio: Date, dataFim: Date } | null = null

      const mensalista = ticket.mensalistaId
        ? await tx.mensalista.findUnique({ where: { id: ticket.mensalistaId } })
        : null

      if (mensalista?.ativo) {
        const cicloVigente = await this.mensalidadeCicloService.buscarCicloVigente(tx, mensalista.id, ticket.dataEntrada)

        if (cicloVigente) {
          valorTotal = 0
          formaPagamentoFinal = 'isento'
          mensalistaCiclo = { cobradoAgora: false, dataInicio: cicloVigente.dataInicio, dataFim: cicloVigente.dataFim }
        } else {
          const novoCiclo = await this.mensalidadeCicloService.abrirNovoCiclo(
            tx, mensalista, ticket.dataEntrada, dto.formaPagamento || 'dinheiro'
          )
          valorTotal = Number(mensalista.valorMensalidade || 0)
          formaPagamentoFinal = dto.formaPagamento || 'dinheiro'
          mensalistaCiclo = { cobradoAgora: true, dataInicio: novoCiclo.dataInicio, dataFim: novoCiclo.dataFim }
        }
      } else {
        const tarifa = ticket.tarifaId
          ? await tx.tarifa.findUnique({ where: { id: ticket.tarifaId } })
          : await tx.tarifa.findFirst()
        const valorHora = tarifa ? Number(tarifa.valorHora) : undefined

        valorTotal = this.cobrancaService.calcularTarifaAvulsa(diffMinutos, valorHora)
      }

      const ticketAtualizado = await tx.ticket.update({
        where: { id },
        data: { dataSaida, valorTotal, formaPagamento: formaPagamentoFinal, status: 'fechado' }
      })

      await tx.vaga.update({ where: { id: ticket.vagaId }, data: { status: 'livre' } })

      return { ...ticketAtualizado, mensalistaCiclo }
    })
  }

  async remover (id: string) {
    await this.prisma.ticket.delete({ where: { id } })
  }
}
