import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const NOMES_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function dataDentroDoPeriodo (data: Date, periodo: string | undefined, agora: Date): boolean {
  if (isNaN(data.getTime())) return true

  switch (periodo) {
    case '7_dias': {
      const limite = new Date(agora)
      limite.setDate(agora.getDate() - 7)
      return data >= limite
    }
    case '30_dias': {
      const limite = new Date(agora)
      limite.setDate(agora.getDate() - 30)
      return data >= limite
    }
    case 'mes_atual':
      return data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear()
    // "todos" ou qualquer valor não reconhecido: sem filtro — mesma regra do
    // switch original em assets/js/controllers/metricas.js.
    default:
      return true
  }
}

@Injectable()
export class MetricasService {
  constructor (private readonly prisma: PrismaService) {}

  /**
   * Calcula tudo que a página de Métricas precisa (KPIs, gráficos,
   * comparativos) no servidor — o front-end só pinta o resultado, nunca
   * recebe a lista crua de tickets/mensalidades/mensalistas/vagas.
   *
   * Porta a lógica que antes vivia inteira em
   * assets/js/controllers/metricas.js (ver histórico do arquivo).
   */
  async calcular (periodo?: string) {
    const agora = new Date()

    const [tickets, mensalidades, mensalistas, vagas] = await Promise.all([
      this.prisma.ticket.findMany(),
      this.prisma.mensalidade.findMany(),
      this.prisma.mensalista.findMany({ select: { id: true, ativo: true } }),
      this.prisma.vaga.findMany({ select: { tipo: true, status: true } })
    ])

    const ticketsFiltrados = tickets.filter(t => {
      const dataRef = t.dataSaida || t.dataEntrada
      return dataDentroDoPeriodo(new Date(dataRef), periodo, agora)
    })
    // Mesma regra de paridade do front original: mensalidade de qualquer
    // status (pendente/paga/cancelada) entra na soma — não filtramos por
    // status aqui de propósito, pra não mudar o valor exibido hoje.
    const mensalidadesFiltradas = mensalidades.filter(mv =>
      dataDentroDoPeriodo(new Date(mv.dataFim), periodo, agora)
    )

    const ticketsFechados = ticketsFiltrados.filter(t => t.status === 'fechado')
    const ticketsAbertos = ticketsFiltrados.filter(t => t.status === 'aberto')

    const receitaTickets = ticketsFechados.reduce((acc, t) => acc + Number(t.valorTotal || 0), 0)
    const receitaMensalidades = mensalidadesFiltradas.reduce((acc, mv) => acc + Number(mv.valor || 0), 0)

    const mensalistasAtivos = mensalistas.filter(m => m.ativo === true).length

    return {
      periodo: periodo || 'mes_atual',
      kpis: {
        totalAtendimentos: ticketsFiltrados.length,
        totalMensalistas: mensalistas.length,
        mensalistasAtivos,
        mensalistasInativos: mensalistas.length - mensalistasAtivos,
        ticketsFechados: ticketsFechados.length,
        ticketsAbertos: ticketsAbertos.length,
        receitaTickets,
        receitaMensalidades,
        receitaTotal: receitaTickets + receitaMensalidades,
        tempoMedioPermanencia: this.calcularTempoMedioPermanencia(ticketsFechados),
        comparacaoReceitaMesAnterior: this.calcularComparacaoReceitaMesAnterior(tickets, mensalidades, agora)
      },
      graficos: {
        ocupacaoPorHorario: this.calcularOcupacaoPorHorario(ticketsFiltrados),
        receitaMensal: this.calcularReceitaMensal(ticketsFechados, mensalidadesFiltradas),
        meiosPagamento: this.calcularMeiosPagamento(ticketsFechados),
        categorias: this.calcularCategorias(vagas)
      }
    }
  }

  private calcularTempoMedioPermanencia (ticketsFechados: Array<{ dataEntrada: Date, dataSaida: Date | null }>): string {
    const validos = ticketsFechados.filter(t => t.dataSaida && t.dataSaida >= t.dataEntrada)
    if (validos.length === 0) return '0h 0m'

    const totalMs = validos.reduce((acc, t) => acc + (t.dataSaida!.getTime() - t.dataEntrada.getTime()), 0)
    const totalMinutos = Math.round(totalMs / validos.length / 60000)
    const horas = Math.floor(totalMinutos / 60)
    const minutos = totalMinutos % 60
    return `${horas}h ${minutos}m`
  }

  // Compara mês corrente vs. anterior sobre o histórico inteiro (não filtrado
  // pelo período selecionado na tela) — mesma regra do front original.
  private calcularComparacaoReceitaMesAnterior (
    todosOsTickets: Array<{ status: string, dataSaida: Date | null, valorTotal: unknown }>,
    todasAsMensalidades: Array<{ referencia: string, valor: unknown }>,
    agora: Date
  ) {
    const mesAtual = agora.getMonth()
    const anoAtual = agora.getFullYear()
    const dataMesAnterior = new Date(anoAtual, mesAtual - 1, 1)

    let receitaMesAtual = 0
    let receitaMesAnterior = 0

    todosOsTickets
      .filter(t => t.status === 'fechado' && t.dataSaida)
      .forEach(t => {
        const d = t.dataSaida as Date
        const valor = Number(t.valorTotal || 0)
        if (d.getMonth() === mesAtual && d.getFullYear() === anoAtual) {
          receitaMesAtual += valor
        } else if (d.getMonth() === dataMesAnterior.getMonth() && d.getFullYear() === dataMesAnterior.getFullYear()) {
          receitaMesAnterior += valor
        }
      })

    const referenciaAtual = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`
    const referenciaAnterior = `${dataMesAnterior.getFullYear()}-${String(dataMesAnterior.getMonth() + 1).padStart(2, '0')}`
    todasAsMensalidades.forEach(mv => {
      const valor = Number(mv.valor || 0)
      if (mv.referencia === referenciaAtual) receitaMesAtual += valor
      else if (mv.referencia === referenciaAnterior) receitaMesAnterior += valor
    })

    const variacaoPercentual = receitaMesAnterior === 0
      ? null
      : ((receitaMesAtual - receitaMesAnterior) / receitaMesAnterior) * 100

    return { receitaMesAtual, receitaMesAnterior, variacaoPercentual }
  }

  private calcularOcupacaoPorHorario (tickets: Array<{ dataEntrada: Date }>) {
    const contagemPorHora = new Array(24).fill(0)
    tickets.forEach(t => {
      contagemPorHora[t.dataEntrada.getHours()]++
    })
    return contagemPorHora.map((contagem, hora) => ({ hora: `${String(hora).padStart(2, '0')}h`, contagem }))
  }

  private calcularReceitaMensal (
    ticketsFechados: Array<{ dataSaida: Date | null, valorTotal: unknown }>,
    mensalidades: Array<{ referencia: string, valor: unknown }>
  ) {
    const totaisPorMes: Record<string, number> = {}

    ticketsFechados.forEach(t => {
      if (!t.dataSaida) return
      const chave = `${t.dataSaida.getFullYear()}-${String(t.dataSaida.getMonth() + 1).padStart(2, '0')}`
      totaisPorMes[chave] = (totaisPorMes[chave] || 0) + Number(t.valorTotal || 0)
    })
    // Mensalista não paga por ticket — o ciclo de mensalidade entra no mesmo
    // "balde" mensal (referencia já vem no formato "YYYY-MM").
    mensalidades.forEach(mv => {
      totaisPorMes[mv.referencia] = (totaisPorMes[mv.referencia] || 0) + Number(mv.valor || 0)
    })

    return Object.keys(totaisPorMes)
      .sort()
      .map(chave => {
        const [ano, mes] = chave.split('-')
        return { mes: `${NOMES_MES[Number(mes) - 1]}/${ano.slice(2)}`, valor: totaisPorMes[chave] }
      })
  }

  private calcularMeiosPagamento (ticketsFechados: Array<{ formaPagamento: string | null, mensalistaId: string | null, valorTotal: unknown }>) {
    const contagem = { pix: 0, cartaoCredito: 0, cartaoDebito: 0, dinheiro: 0, isento: 0 }
    const mapa: Record<string, keyof typeof contagem> = {
      pix: 'pix',
      cartao_credito: 'cartaoCredito',
      cartao_debito: 'cartaoDebito',
      dinheiro: 'dinheiro',
      isento: 'isento'
    }

    ticketsFechados.forEach(t => {
      let forma = (t.formaPagamento || '').toLowerCase()
      if (!forma && t.mensalistaId) forma = 'isento'
      if (!forma) forma = 'pix'

      const chave = mapa[forma] || 'pix'
      contagem[chave] += Number(t.valorTotal || 0)
    })

    return contagem
  }

  private calcularCategorias (vagas: Array<{ tipo: string, status: string }>) {
    const porTipo: Record<string, { ocupadas: number, total: number }> = {}
    vagas.forEach(v => {
      const tipo = (v.tipo || 'outros').toUpperCase()
      if (!porTipo[tipo]) porTipo[tipo] = { ocupadas: 0, total: 0 }
      porTipo[tipo].total++
      if (v.status === 'ocupada') porTipo[tipo].ocupadas++
    })

    return Object.keys(porTipo).map(tipo => ({ tipo, ...porTipo[tipo] }))
  }
}
