import { Injectable } from '@nestjs/common'
import type { Mensalista, Prisma } from '../../generated/prisma'

type TransactionClient = Prisma.TransactionClient

export const DURACAO_CICLO_DIAS = 30

/**
 * Regra de cobrança do mensalista: ele não paga por ticket — paga um ciclo
 * de 30 dias corridos, cobrado de uma vez só na primeira entrada em que não
 * há ciclo vigente (não no cadastro, nem no dia 1 de cada mês calendário). A
 * partir daí, todo ticket que cair dentro desses 30 dias sai isento; quando
 * o ciclo vence, a próxima entrada abre (e cobra) um novo, contando mais 30
 * dias a partir dela.
 *
 * Recebe `tx` explicitamente (em vez de injetar o PrismaService) porque
 * sempre roda dentro da mesma transação que TicketsService já abriu.
 */
@Injectable()
export class MensalidadeCicloService {
  referenciaDe (data: Date): string {
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, '0')
    return `${ano}-${mes}`
  }

  calcularFimCiclo (dataInicio: Date): Date {
    const fim = new Date(dataInicio)
    fim.setDate(fim.getDate() + DURACAO_CICLO_DIAS)
    return fim
  }

  // Ciclo mais recente do mensalista que ainda cobre a data informada (a
  // data de entrada do ticket sendo fechado, normalmente) — null se ele
  // nunca teve um ciclo, ou se o último já venceu antes dessa data.
  buscarCicloVigente (tx: TransactionClient, mensalistaId: string, dataReferencia: Date) {
    return tx.mensalidade.findFirst({
      where: { mensalistaId, dataFim: { gte: dataReferencia } },
      orderBy: { dataInicio: 'desc' }
    })
  }

  // Abre e já marca como paga (o pagamento acontece na hora, junto do
  // fechamento do ticket que disparou a abertura — não existe um estado
  // "pendente" intermediário).
  abrirNovoCiclo (tx: TransactionClient, mensalista: Mensalista, dataInicio: Date, formaPagamento: string | null) {
    const dataFim = this.calcularFimCiclo(dataInicio)

    return tx.mensalidade.create({
      data: {
        mensalistaId: mensalista.id,
        referencia: this.referenciaDe(dataInicio),
        dataInicio,
        dataFim,
        diasCobrados: DURACAO_CICLO_DIAS,
        diasNoMes: DURACAO_CICLO_DIAS,
        valor: Number(mensalista.valorMensalidade || 0),
        status: 'paga',
        formaPagamento
      }
    })
  }
}
