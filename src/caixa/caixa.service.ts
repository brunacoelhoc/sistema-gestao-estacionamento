import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma'
import { PrismaService } from '../prisma/prisma.service'
import { dataSemHora, rangeDoDiaDoBanco } from './caixa-datas.util'
import { AbrirCaixaDto } from './dto/abrir-caixa.dto'
import { FecharCaixaDto } from './dto/fechar-caixa.dto'

type TransactionClient = Prisma.TransactionClient

/**
 * Caixa físico do dia — ver o comentário do model CaixaDiario em
 * schema.prisma para a regra completa. Resumo: TicketsService.abrir recusa
 * registrar um ticket sem o caixa do dia já aberto (verificarAbertoParaTicket,
 * chamado dentro da mesma transação de abertura do ticket); o valor esperado
 * no fechamento é sempre recalculado a partir dos tickets pagos em dinheiro
 * do dia, nunca guardado incrementalmente, para não divergir se um ticket for
 * removido/alterado depois de aberto o caixa.
 */
@Injectable()
export class CaixaService {
  constructor (private readonly prisma: PrismaService) {}

  private async calcularRecebidoEmDinheiro (client: TransactionClient, dataDoBanco: Date) {
    const { inicio, fim } = rangeDoDiaDoBanco(dataDoBanco)

    const resultado = await client.ticket.aggregate({
      where: { status: 'fechado', formaPagamento: 'dinheiro', dataSaida: { gte: inicio, lt: fim } },
      _sum: { valorTotal: true }
    })

    return Number(resultado._sum.valorTotal || 0)
  }

  private async calcularValorEsperado (client: TransactionClient, caixa: { data: Date, valorAbertura: Prisma.Decimal | number }) {
    const recebidoHoje = await this.calcularRecebidoEmDinheiro(client, caixa.data)
    return Number(caixa.valorAbertura) + recebidoHoje
  }

  // Chamado por TicketsService.abrir, dentro da mesma transação — um ticket
  // (avulso ou de mensalista) só pode ser registrado com o caixa do dia já
  // aberto e contado.
  async verificarAbertoParaTicket (client: TransactionClient) {
    const hoje = dataSemHora(new Date())
    const caixa = await client.caixaDiario.findUnique({ where: { data: hoje } })
    if (!caixa || caixa.status !== 'aberto') {
      throw new ConflictException({
        erro: 'O caixa do dia ainda não foi aberto. Conte o valor em espécie e abra o caixa antes de registrar um ticket.',
        codigo: 'CAIXA_FECHADO'
      })
    }
  }

  // Estado do caixa "de hoje" para a tela de Tickets: se não existe registro
  // ainda, `aberto: false` dispara o modal de abertura obrigatória; se existe
  // e está aberto, `valorEsperadoFechamento` (recalculado ao vivo) alimenta o
  // lembrete de fechamento mostrado na tela.
  async obterStatusHoje () {
    const hoje = dataSemHora(new Date())
    const caixa = await this.prisma.caixaDiario.findUnique({
      where: { data: hoje },
      include: {
        abertoPor: { select: { nome: true } },
        fechadoPor: { select: { nome: true } }
      }
    })

    if (!caixa) {
      return { aberto: false, caixa: null, valorEsperadoFechamento: null }
    }

    const valorEsperadoFechamento = caixa.status === 'aberto'
      ? await this.calcularValorEsperado(this.prisma, caixa)
      : Number(caixa.valorEsperadoFechamento || 0)

    return { aberto: caixa.status === 'aberto', caixa, valorEsperadoFechamento }
  }

  async abrir (dto: AbrirCaixaDto, usuarioId: string) {
    const hoje = dataSemHora(new Date())

    const existente = await this.prisma.caixaDiario.findUnique({ where: { data: hoje } })
    if (existente) {
      throw new ConflictException('O caixa de hoje já foi aberto.')
    }

    return await this.prisma.caixaDiario.create({
      data: { data: hoje, valorAbertura: dto.valorAbertura, abertoPorId: usuarioId },
      include: { abertoPor: { select: { nome: true } } }
    })
  }

  async fechar (id: string, dto: FecharCaixaDto, usuarioId: string) {
    return await this.prisma.$transaction(async tx => {
      const caixa = await tx.caixaDiario.findUnique({ where: { id } })
      if (!caixa) {
        throw new NotFoundException('Caixa não encontrado.')
      }
      if (caixa.status !== 'aberto') {
        throw new ConflictException('Este caixa já foi fechado.')
      }

      const valorEsperadoFechamento = await this.calcularValorEsperado(tx, caixa)
      const diferenca = dto.valorFechamento - valorEsperadoFechamento

      return await tx.caixaDiario.update({
        where: { id },
        data: {
          valorFechamento: dto.valorFechamento,
          valorEsperadoFechamento,
          diferenca,
          observacoesFechamento: dto.observacoes || null,
          fechadoPorId: usuarioId,
          fechadoEm: new Date(),
          status: 'fechado'
        },
        include: {
          abertoPor: { select: { nome: true } },
          fechadoPor: { select: { nome: true } }
        }
      })
    })
  }
}
