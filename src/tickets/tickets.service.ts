import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma'
import { CobrancaService } from '../cobranca/cobranca.service'
import { EmailService } from '../email/email.service'
import { MensalidadeCicloService } from '../mensalidade-ciclo/mensalidade-ciclo.service'
import { PrismaService } from '../prisma/prisma.service'
import { gerarComprovanteTicketPdf } from './comprovante-ticket.pdf'
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
    private readonly mensalidadeCicloService: MensalidadeCicloService,
    private readonly emailService: EmailService
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
   * Sem `page`, mantém o contrato antigo (array completo, com status=aberto
   * é o que a tela de Dashboard usa pra tabela de tickets ativos — o
   * histórico completo pra KPIs agora vem de DashboardService/MetricasService,
   * calculado no servidor). Com `page`, aplica os mesmos filtros (status,
   * termo) e devolve só a fatia pedida.
   *
   * Inclui vaga/mensalista (só os campos usados pra exibição) pra quem
   * precisa montar uma linha de tabela sem baixar as listas completas de
   * vagas/mensalistas só pra fazer esse join no cliente.
   */
  async listar (filtros: FiltrosListarTickets, paginacao?: PaginacaoTickets) {
    const where = this.montarWhere(filtros)
    const include = {
      vaga: { select: { codigo: true, tipo: true } },
      // valorMensalidade é usado pela prévia de cobrança do ciclo mostrada
      // antes de fechar o ticket de um mensalista (ver preverCicloMensalista
      // no front) — o valor cobrado de fato é sempre recalculado no backend.
      mensalista: { select: { nome: true, valorMensalidade: true } }
    }

    if (!paginacao) {
      return this.prisma.ticket.findMany({ where, orderBy: { dataEntrada: 'desc' }, include })
    }

    const [dados, total] = await Promise.all([
      this.prisma.ticket.findMany({ where, orderBy: { dataEntrada: 'desc' }, skip: paginacao.skip, take: paginacao.take, include }),
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
      if (!vaga || vaga.status !== 'livre') {
        throw new ConflictException('A vaga selecionada não está livre ou é inválida.')
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

      // Buscada aqui (não só no update do fim) porque o tipo da vaga
      // (comum/coberta) entra no cálculo da tarifa avulsa, abaixo.
      const vaga = await tx.vaga.findUnique({ where: { id: ticket.vagaId } })

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

        valorTotal = this.cobrancaService.calcularTarifaAvulsa(diffMinutos, valorHora, vaga?.tipo === 'coberta')
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

  /**
   * Comprovante enviado por e-mail: só para tickets de mensalista com e-mail
   * cadastrado (avulso não tem onde receber). O PDF é gerado aqui, a partir
   * do registro do ticket já persistido — o cliente nunca envia o anexo, só
   * o gatilho, pra este endpoint não virar um jeito de mandar um binário
   * arbitrário em nome da empresa para o e-mail de um mensalista cadastrado.
   */
  async enviarComprovanteEmail (id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        vaga: { select: { codigo: true } },
        mensalista: { select: { nome: true, email: true } }
      }
    })

    if (!ticket) {
      throw new NotFoundException('Ticket não encontrado.')
    }
    if (ticket.status !== 'fechado' || !ticket.dataSaida) {
      throw new BadRequestException('O comprovante só pode ser enviado para um ticket já encerrado.')
    }
    if (!ticket.mensalista?.email) {
      throw new BadRequestException('Este mensalista não tem e-mail cadastrado.')
    }

    const anexoPdf = await gerarComprovanteTicketPdf({
      ticketId: ticket.id,
      placa: ticket.placa,
      vagaCodigo: ticket.vaga.codigo,
      nomeMensalista: ticket.mensalista.nome,
      dataEntrada: ticket.dataEntrada,
      dataSaida: ticket.dataSaida,
      formaPagamento: ticket.formaPagamento,
      valorTotal: Number(ticket.valorTotal || 0)
    })

    await this.emailService.enviarComprovanteTicket({
      to: ticket.mensalista.email,
      nome: ticket.mensalista.nome,
      ticketId: ticket.id,
      anexoPdf
    })

    return { enviado: true }
  }
}
