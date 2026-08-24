import { Injectable } from '@nestjs/common'
import type { TipoVaga } from '../../generated/prisma'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class DashboardService {
  constructor (private readonly prisma: PrismaService) {}

  /**
   * KPIs do painel principal (contagem de vagas por status, faturamento de
   * tickets fechados, ticket médio, tempo médio de permanência), calculados
   * aqui — o front não precisa mais baixar o histórico inteiro de tickets
   * só pra somar esses números (mesmo racional de MetricasService.calcular).
   */
  async calcularKpis (tipo?: string) {
    const tipoFiltro = tipo && tipo.toLowerCase() !== 'todos' ? (tipo.toLowerCase() as TipoVaga) : null

    const [vagas, tickets] = await Promise.all([
      this.prisma.vaga.findMany({ select: { tipo: true, status: true } }),
      this.prisma.ticket.findMany({
        where: tipoFiltro ? { vaga: { tipo: tipoFiltro } } : undefined,
        select: { status: true, valorTotal: true, dataEntrada: true, dataSaida: true }
      })
    ])

    // "vagas" continua sem filtro pra alimentar o total geral (usado no
    // contador do hero) — a filtragem por tipo só se aplica aos cartões de
    // KPI abaixo, mesma regra do front original.
    const vagasFiltradas = tipoFiltro ? vagas.filter(v => v.tipo === tipoFiltro) : vagas

    const contarPorTipo = (statusAlvo: string): Record<string, number> => {
      const contagem: Record<string, number> = {}
      vagasFiltradas
        .filter(v => v.status === statusAlvo)
        .forEach(v => { contagem[v.tipo] = (contagem[v.tipo] || 0) + 1 })
      return contagem
    }

    const vagasLivres = vagasFiltradas.filter(v => v.status === 'livre').length
    const vagasOcupadas = vagasFiltradas.filter(v => v.status === 'ocupada').length
    const vagasManutencao = vagasFiltradas.filter(v => v.status === 'manutencao').length
    const totalVagasFiltradas = vagasFiltradas.length
    const taxaOcupacao = totalVagasFiltradas > 0 ? (vagasOcupadas / totalVagasFiltradas) * 100 : 0

    const ticketsAbertos = tickets.filter(t => t.status === 'aberto')
    const ticketsFechados = tickets.filter(t => t.status === 'fechado')
    const faturamentoTotal = ticketsFechados.reduce((acc, t) => acc + Number(t.valorTotal || 0), 0)
    const ticketMedio = ticketsFechados.length > 0 ? faturamentoTotal / ticketsFechados.length : 0

    const comTempo = ticketsFechados.filter(t => t.dataSaida && t.dataSaida >= t.dataEntrada)
    const tempoMedioMinutos = comTempo.length > 0
      ? Math.round(
        comTempo.reduce((acc, t) => acc + (t.dataSaida!.getTime() - t.dataEntrada.getTime()), 0) / comTempo.length / 60000
      )
      : null

    // Data do ticket fechado mais antigo — usada só pelo front para exibir o
    // período coberto pelos KPIs acumulados (faturamento/ticket médio/tempo
    // médio), que somam o histórico inteiro em vez de uma janela fixa.
    const dataInicioHistorico = ticketsFechados.length > 0
      ? ticketsFechados.reduce(
        (min, t) => (t.dataEntrada < min ? t.dataEntrada : min),
        ticketsFechados[0].dataEntrada
      )
      : null

    return {
      geradoEm: new Date(),
      dataInicioHistorico,
      totalVagas: vagas.length,
      totalVagasFiltradas,
      vagasLivres,
      vagasOcupadas,
      vagasManutencao,
      taxaOcupacao,
      porTipoLivres: contarPorTipo('livre'),
      porTipoOcupadas: contarPorTipo('ocupada'),
      porTipoManutencao: contarPorTipo('manutencao'),
      ticketsAbertosQtd: ticketsAbertos.length,
      ticketsFechadosQtd: ticketsFechados.length,
      faturamentoTotal,
      ticketMedio,
      tempoMedioMinutos,
      tempoMedioAmostraQtd: comTempo.length
    }
  }

  /**
   * Ranking de vagas por quantidade de tickets já registrados (histórico
   * inteiro) — contagem via groupBy no banco, sem baixar a lista crua de
   * tickets no cliente só pra contar uso por vaga.
   */
  async calcularRankingVagas () {
    const [vagas, contagem] = await Promise.all([
      this.prisma.vaga.findMany({ select: { id: true, codigo: true, tipo: true } }),
      this.prisma.ticket.groupBy({ by: ['vagaId'], _count: { vagaId: true } })
    ])

    const usoPorVaga = new Map(contagem.map(c => [c.vagaId, c._count.vagaId]))

    return vagas
      .map(v => ({ id: v.id, codigo: v.codigo, tipo: v.tipo, totalUso: usoPorVaga.get(v.id) || 0 }))
      .sort((a, b) => b.totalUso - a.totalUso)
      .map((item, index) => ({ ...item, posicao: index + 1 }))
  }
}
