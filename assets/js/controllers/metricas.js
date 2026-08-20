/**
 * Lógica da Página de Métricas e Relatórios
 * Cálculo de KPIs, filtro por período, gráficos por meio de pagamento,
 * tabelas acessíveis e renderização com Chart.js.
 */

let chartOcupacaoHorario = null
let chartReceitaMensal = null
let chartCategorias = null
let chartMeiosPagamento = null

let globalVagas = []
let globalTickets = []
let globalMensalistas = []
let globalMensalidades = []

// Último conjunto de tickets/mensalidades já filtrado pelo período
// selecionado, usado pelo modal de detalhes dos cards de KPI (mantém
// consistência com o número exibido no card no momento do clique). Mensalista
// não paga por ticket (ver server/services/mensalidade.js), então a receita
// de verdade soma os tickets avulsos fechados COM os ciclos de mensalidade.
let kpiTicketsFiltradosAtual = []
let kpiMensalidadesFiltradasAtual = []

// Últimos dados do gráfico de receita mensal, reaproveitados no relatório
// exportável (XML/PDF/Excel) sem precisar recalcular.
let ultimoRelatorioReceitaMensal = { labels: [], valores: [] }

// Paleta de cores do projeto para os gráficos
const PALETA = {
  sucesso: '#a8e6cf',
  pendente: '#ffd3b6',
  alerta: '#ff8b94',
  info: '#d4f0f0',
  pix: '#20c997',
  credito: '#0d6efd',
  debito: '#0dcaf0',
  dinheiro: '#ffc107',
  isento: '#6c757d'
}

document.addEventListener('DOMContentLoaded', async () => {
  configurarTemaDarkDoChartJs()
  await carregarDadosMetricas()

  // Listener para Filtro por Período
  document
    .getElementById('filtro-periodo-metricas')
    ?.addEventListener('change', () => {
      processarEMostrarMetricas()
    })

  // Botão de tentar novamente do banner de erro
  document.getElementById('btn-retry-page')?.addEventListener('click', () => {
    carregarDadosMetricas()
  })

  // === MODAL DE DETALHES AO CLICAR NOS CARDS DE KPI ===
  document.querySelectorAll('[data-metric-kpi]').forEach(card => {
    card.addEventListener('click', () =>
      abrirDetalhesMetricaKpi(card.dataset.metricKpi)
    )
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        abrirDetalhesMetricaKpi(card.dataset.metricKpi)
      }
    })
  })

  // === EXPORTAÇÃO DO RELATÓRIO (XML / PDF / Excel) ===
  document
    .getElementById('btn-exportar-xml')
    ?.addEventListener('click', exportarRelatorioXML)
  document
    .getElementById('btn-exportar-pdf')
    ?.addEventListener('click', exportarRelatorioPDF)
  document
    .getElementById('btn-exportar-excel')
    ?.addEventListener('click', exportarRelatorioExcel)
})

// Soma o valor dos ciclos de mensalidade (Mensalidade) — é o que
// efetivamente cobra do mensalista, já que ele não paga por ticket.
function somaMensalidades (mensalidades) {
  return mensalidades.reduce((acc, mv) => acc + (Number(mv.valor) || 0), 0)
}

/**
 * Reúne os dados atuais da tela (respeitando o filtro de período) num único
 * objeto, usado pelas três funções de exportação abaixo.
 */
function coletarDadosRelatorio () {
  const selectPeriodo = document.getElementById('filtro-periodo-metricas')
  const periodoTexto = selectPeriodo
    ? selectPeriodo.options[selectPeriodo.selectedIndex].text
    : 'Mês atual'

  const tickets = kpiTicketsFiltradosAtual
  const ticketsFechados = tickets.filter(
    t => (t.status || '').toLowerCase() === 'fechado'
  )
  const receitaTotal =
    ticketsFechados.reduce(
      (acc, t) => acc + (Number(t.valorTotal ?? t.valorCobrado) || 0),
      0
    ) + somaMensalidades(kpiMensalidadesFiltradasAtual)

  return {
    geradoEm: new Date(),
    periodo: periodoTexto,
    kpis: {
      totalAtendimentos: tickets.length,
      totalMensalistas: globalMensalistas.length,
      receitaTotal,
      tempoMedio: calcularTempoMedioPermanencia(ticketsFechados)
    },
    receitaMensal: ultimoRelatorioReceitaMensal.labels.map((label, i) => ({
      mes: label,
      valor: ultimoRelatorioReceitaMensal.valores[i] || 0
    }))
  }
}

// Cria um link temporário para baixar um arquivo gerado no navegador.
function baixarArquivo (conteudo, nomeArquivo, tipoMime) {
  const blob = new Blob([conteudo], { type: tipoMime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function exportarRelatorioXML () {
  const dados = coletarDadosRelatorio()

  const linhasReceita =
    dados.receitaMensal
      .map(
        item =>
          `    <mes nome="${item.mes}">${item.valor.toFixed(2)}</mes>`
      )
      .join('\n') || '    <!-- Nenhum dado de receita no período -->'

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<relatorioMetricas>
  <geradoEm>${dados.geradoEm.toISOString()}</geradoEm>
  <periodo>${dados.periodo}</periodo>
  <indicadores>
    <totalAtendimentos>${dados.kpis.totalAtendimentos}</totalAtendimentos>
    <totalMensalistas>${dados.kpis.totalMensalistas}</totalMensalistas>
    <receitaTotal>${dados.kpis.receitaTotal.toFixed(2)}</receitaTotal>
    <tempoMedioPermanencia>${dados.kpis.tempoMedio}</tempoMedioPermanencia>
  </indicadores>
  <receitaMensal>
${linhasReceita}
  </receitaMensal>
</relatorioMetricas>
`

  baixarArquivo(xml, 'relatorio-parkgestao.xml', 'application/xml')
}

function exportarRelatorioPDF () {
  if (typeof window.jspdf === 'undefined') {
    Swal.fire({
      icon: 'error',
      title: 'Não foi possível gerar o PDF',
      text: 'A biblioteca de exportação não carregou. Verifique sua conexão e tente novamente.'
    })
    return
  }

  const dados = coletarDadosRelatorio()
  const { jsPDF } = window.jspdf
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.text('ParkGestão — Relatório de Métricas', 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Período: ${dados.periodo}`, 14, 25)
  doc.text(`Gerado em: ${dados.geradoEm.toLocaleString('pt-BR')}`, 14, 30)

  doc.autoTable({
    startY: 36,
    head: [['Indicador', 'Valor']],
    body: [
      ['Total de Atendimentos', String(dados.kpis.totalAtendimentos)],
      ['Total de Mensalistas', String(dados.kpis.totalMensalistas)],
      [
        'Receita Total',
        `R$ ${dados.kpis.receitaTotal.toFixed(2).replace('.', ',')}`
      ],
      ['Tempo Médio de Permanência', dados.kpis.tempoMedio]
    ],
    theme: 'striped',
    headStyles: { fillColor: [13, 110, 253] }
  })

  const proximaY = doc.lastAutoTable.finalY + 10
  doc.setFontSize(12)
  doc.setTextColor(0)
  doc.text('Receita por Mês', 14, proximaY)

  doc.autoTable({
    startY: proximaY + 4,
    head: [['Mês', 'Receita (R$)']],
    body:
      dados.receitaMensal.length > 0
        ? dados.receitaMensal.map(item => [
            item.mes,
            item.valor.toFixed(2).replace('.', ',')
          ])
        : [['-', 'Nenhum dado no período']],
    theme: 'striped',
    headStyles: { fillColor: [25, 135, 84] }
  })

  doc.save('relatorio-parkgestao.pdf')
}

function exportarRelatorioExcel () {
  if (typeof XLSX === 'undefined') {
    Swal.fire({
      icon: 'error',
      title: 'Não foi possível gerar o Excel',
      text: 'A biblioteca de exportação não carregou. Verifique sua conexão e tente novamente.'
    })
    return
  }

  const dados = coletarDadosRelatorio()

  const abaIndicadores = XLSX.utils.json_to_sheet([
    { Indicador: 'Período', Valor: dados.periodo },
    { Indicador: 'Total de Atendimentos', Valor: dados.kpis.totalAtendimentos },
    { Indicador: 'Total de Mensalistas', Valor: dados.kpis.totalMensalistas },
    {
      Indicador: 'Receita Total (R$)',
      Valor: Number(dados.kpis.receitaTotal.toFixed(2))
    },
    { Indicador: 'Tempo Médio de Permanência', Valor: dados.kpis.tempoMedio }
  ])

  const abaReceita = XLSX.utils.json_to_sheet(
    dados.receitaMensal.length > 0
      ? dados.receitaMensal.map(item => ({
          Mês: item.mes,
          'Receita (R$)': Number(item.valor.toFixed(2))
        }))
      : [{ Mês: '-', 'Receita (R$)': 'Nenhum dado no período' }]
  )

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, abaIndicadores, 'Indicadores')
  XLSX.utils.book_append_sheet(workbook, abaReceita, 'Receita Mensal')

  XLSX.writeFile(workbook, 'relatorio-parkgestao.xlsx')
}

/**
 * Abre um modal com o detalhamento dos dados por trás de um card de KPI da
 * página de Métricas, respeitando o período selecionado no filtro.
 */
function abrirDetalhesMetricaKpi (chave) {
  if (typeof Swal === 'undefined') return

  const tickets = kpiTicketsFiltradosAtual
  const ticketsFechados = tickets.filter(
    t => (t.status || '').toLowerCase() === 'fechado'
  )
  const ticketsAbertos = tickets.filter(
    t => (t.status || '').toLowerCase() === 'aberto'
  )

  let title = ''
  let html = ''

  switch (chave) {
    case 'receita': {
      const receitaTickets = ticketsFechados.reduce(
        (acc, t) => acc + (Number(t.valorTotal ?? t.valorCobrado) || 0),
        0
      )
      const receitaMensalidades = somaMensalidades(kpiMensalidadesFiltradasAtual)
      const receitaTotal = receitaTickets + receitaMensalidades
      title = 'Receita do Período'
      html = `<p class="text-muted mb-2">Soma dos tickets avulsos fechados com os ciclos de mensalidade cobrados dentro do período selecionado no filtro (mensalista não paga por ticket, paga o ciclo mensal).</p>
        <ul class="text-start">
          <li>${ticketsFechados.length} ticket(s) avulso(s): <strong>R$ ${receitaTickets
        .toFixed(2)
        .replace('.', ',')}</strong></li>
          <li>${kpiMensalidadesFiltradasAtual.length} ciclo(s) de mensalidade: <strong>R$ ${receitaMensalidades
        .toFixed(2)
        .replace('.', ',')}</strong></li>
        </ul>
        <p class="fs-5 mb-0">Total: <strong>R$ ${receitaTotal
        .toFixed(2)
        .replace('.', ',')}</strong>.</p>`
      break
    }
    case 'atendimentos':
      title = 'Total de Atendimentos'
      html = `<p class="text-muted mb-2">Quantidade de tickets (abertos ou fechados) registrados dentro do período selecionado.</p>
        <ul class="text-start">
          <li>Fechados: <strong>${ticketsFechados.length}</strong></li>
          <li>Em aberto: <strong>${ticketsAbertos.length}</strong></li>
        </ul>`
      break
    case 'tempo-medio': {
      const comTempo = ticketsFechados.filter(t => {
        const ent = t.horaEntrada || t.dataEntrada
        const sai = t.horaSaida || t.dataSaida
        return ent && sai
      })
      title = 'Tempo Médio de Permanência'
      html = `<p class="text-muted mb-2">Média do tempo entre entrada e saída de todos os tickets fechados do período, com os dois horários registrados.</p>
        <p class="fs-5 mb-0">Calculado sobre <strong>${comTempo.length}</strong> ticket(s) fechado(s).</p>`
      break
    }
    case 'mensalistas': {
      const ativos = globalMensalistas.filter(m => m.ativo === true).length
      const inativos = globalMensalistas.length - ativos
      title = 'Total de Mensalistas'
      html = `<p class="text-muted mb-2">Cadastro completo de mensalistas (não é afetado pelo filtro de período).</p>
        <ul class="text-start">
          <li>Ativos: <strong>${ativos}</strong></li>
          <li>Inativos: <strong>${inativos}</strong></li>
        </ul>`
      break
    }
    default:
      return
  }

  Swal.fire({
    title,
    html,
    icon: 'info',
    confirmButtonText: 'Fechar'
  })
}

// Ajusta as cores padrão do Chart.js para leitura confortável sobre o tema escuro
function configurarTemaDarkDoChartJs () {
  if (typeof Chart === 'undefined') return
  Chart.defaults.color = 'rgba(255, 255, 255, 0.75)'
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.08)'
}

// Carrega os dados brutos da API
async function carregarDadosMetricas () {
  const pageError = document.getElementById('page-error')
  const pageErrorText = document.getElementById('page-error-text')

  pageError?.classList.add('d-none')

  try {
    const [vagas, tickets, mensalistas, mensalidades] = await Promise.all([
      ApiService.getVagas ? ApiService.getVagas() : Promise.resolve([]),
      ApiService.getTickets ? ApiService.getTickets() : Promise.resolve([]),
      ApiService.getMensalistas
        ? ApiService.getMensalistas()
        : Promise.resolve([]),
      ApiService.getMensalidades
        ? ApiService.getMensalidades()
        : Promise.resolve([])
    ])

    globalVagas = vagas || []
    globalTickets = tickets || []
    globalMensalistas = mensalistas || []
    globalMensalidades = mensalidades || []

    processarEMostrarMetricas()
  } catch (error) {
    console.error('Erro ao carregar dados de métricas:', error)

    if (pageError && pageErrorText) {
      pageErrorText.textContent =
        'Não foi possível carregar as métricas. Verifique sua conexão e tente novamente.'
      pageError.classList.remove('d-none')
    }

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Erro ao carregar métricas',
        text: 'Não foi possível buscar as informações analíticas do servidor.'
      })
    }
  }
}

// Filtra os tickets com base no período selecionado no dropdown
function filtrarTicketsPorPeriodo (tickets) {
  const selectPeriodo = document.getElementById('filtro-periodo-metricas')
  const periodo = selectPeriodo ? selectPeriodo.value : 'mes_atual'

  const agora = new Date()

  return tickets.filter(t => {
    const dataRefStr =
      t.horaSaida || t.dataSaida || t.horaEntrada || t.dataEntrada
    if (!dataRefStr) return true
    const d = new Date(dataRefStr)
    if (isNaN(d)) return true

    switch (periodo) {
      case '7_dias': {
        const limite7 = new Date()
        limite7.setDate(agora.getDate() - 7)
        return d >= limite7
      }
      case '30_dias': {
        const limite30 = new Date()
        limite30.setDate(agora.getDate() - 30)
        return d >= limite30
      }
      case 'mes_atual':
        return (
          d.getMonth() === agora.getMonth() &&
          d.getFullYear() === agora.getFullYear()
        )
      case 'todos':
      default:
        return true
    }
  })
}

// Processa e re-renderiza todos os componentes gráficos
function processarEMostrarMetricas () {
  const ticketsFiltrados = filtrarTicketsPorPeriodo(globalTickets)
  const mensalidadesFiltradas = filtrarMensalidadesPorPeriodo(globalMensalidades)

  atualizarKPIs(globalVagas, ticketsFiltrados, globalMensalistas, mensalidadesFiltradas)
  renderizarGraficoOcupacaoHorario(ticketsFiltrados)
  renderizarGraficoReceitaMensal(ticketsFiltrados, mensalidadesFiltradas)
  renderizarGraficoMeiosPagamento(ticketsFiltrados)
  renderizarGraficoCategorias(globalVagas)
}

// Mesma lógica de período de filtrarTicketsPorPeriodo, mas usando dataFim do
// ciclo (quando a mensalidade foi/será cobrada) como data de referência.
function filtrarMensalidadesPorPeriodo (mensalidades) {
  const selectPeriodo = document.getElementById('filtro-periodo-metricas')
  const periodo = selectPeriodo ? selectPeriodo.value : 'mes_atual'

  const agora = new Date()

  return mensalidades.filter(mv => {
    const d = new Date(mv.dataFim)
    if (isNaN(d)) return true

    switch (periodo) {
      case '7_dias': {
        const limite7 = new Date()
        limite7.setDate(agora.getDate() - 7)
        return d >= limite7
      }
      case '30_dias': {
        const limite30 = new Date()
        limite30.setDate(agora.getDate() - 30)
        return d >= limite30
      }
      case 'mes_atual':
        return (
          d.getMonth() === agora.getMonth() &&
          d.getFullYear() === agora.getFullYear()
        )
      case 'todos':
      default:
        return true
    }
  })
}

// Texto do período atualmente selecionado no filtro (ex.: "Mês atual"),
// usado para deixar claro nos cards de KPI a que intervalo os números
// exibidos se referem.
function obterTextoPeriodoAtual () {
  const select = document.getElementById('filtro-periodo-metricas')
  return select ? select.options[select.selectedIndex].text : 'Mês atual'
}

// Compara a receita fechada do mês corrente com a do mês anterior (sempre
// pelo calendário, independente do filtro de período ativo na tela) para
// dar contexto imediato de tendência no card de Receita.
function calcularComparacaoReceitaMesAnterior (todosOsTickets) {
  const agora = new Date()
  const mesAtual = agora.getMonth()
  const anoAtual = agora.getFullYear()
  const dataMesAnterior = new Date(anoAtual, mesAtual - 1, 1)

  let receitaMesAtual = 0
  let receitaMesAnterior = 0

  todosOsTickets
    .filter(t => (t.status || '').toLowerCase() === 'fechado')
    .forEach(t => {
      const sai = t.horaSaida || t.dataSaida
      if (!sai) return
      const d = new Date(sai)
      if (isNaN(d)) return
      const valor = Number(t.valorTotal ?? t.valorCobrado) || 0

      if (d.getMonth() === mesAtual && d.getFullYear() === anoAtual) {
        receitaMesAtual += valor
      } else if (
        d.getMonth() === dataMesAnterior.getMonth() &&
        d.getFullYear() === dataMesAnterior.getFullYear()
      ) {
        receitaMesAnterior += valor
      }
    })

  const referenciaAtual = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`
  const referenciaAnterior = `${dataMesAnterior.getFullYear()}-${String(
    dataMesAnterior.getMonth() + 1
  ).padStart(2, '0')}`
  globalMensalidades.forEach(mv => {
    const valor = Number(mv.valor) || 0
    if (mv.referencia === referenciaAtual) receitaMesAtual += valor
    else if (mv.referencia === referenciaAnterior) receitaMesAnterior += valor
  })

  if (receitaMesAnterior === 0) {
    return receitaMesAtual > 0
      ? { texto: 'Sem receita no mês anterior para comparar', classe: 'text-light' }
      : { texto: 'Sem dados suficientes para comparar', classe: 'text-light' }
  }

  const variacao =
    ((receitaMesAtual - receitaMesAnterior) / receitaMesAnterior) * 100
  const sinal = variacao >= 0 ? '+' : ''
  const classe = variacao >= 0 ? 'text-success' : 'text-danger'
  const icone = variacao >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'

  return {
    texto: `<i class="fas ${icone} me-1" aria-hidden="true"></i>${sinal}${variacao.toFixed(
      1
    )}% vs mês anterior`,
    classe
  }
}

// Atualiza os cards superiores de indicadores de desempenho (KPIs)
function atualizarKPIs (vagas, tickets, mensalistas, mensalidades = []) {
  kpiTicketsFiltradosAtual = tickets
  kpiMensalidadesFiltradasAtual = mensalidades

  const ticketsFechados = tickets.filter(
    t => (t.status || '').toLowerCase() === 'fechado'
  )

  const animar =
    typeof animarContadorGsap === 'function'
      ? animarContadorGsap
      : (el, valor, opcoes) => {
          if (el) el.textContent = opcoes?.formatar ? opcoes.formatar(valor) : valor
        }

  const periodoTexto = obterTextoPeriodoAtual()

  // Total de atendimentos
  animar(
    document.getElementById('metric-total-atendimentos'),
    tickets.length
  )
  const elPeriodoAtendimentos = document.getElementById(
    'metric-atendimentos-periodo-label'
  )
  if (elPeriodoAtendimentos)
    elPeriodoAtendimentos.textContent = `Período: ${periodoTexto}`

  // Total de mensalistas cadastrados
  animar(
    document.getElementById('metric-total-mensalistas'),
    mensalistas.length
  )

  // Receita do Período (tickets avulsos fechados + ciclos de mensalidade)
  const receitaTotal =
    ticketsFechados.reduce(
      (acc, t) => acc + (Number(t.valorTotal ?? t.valorCobrado) || 0),
      0
    ) + somaMensalidades(mensalidades)

  animar(document.getElementById('metric-receita-total'), receitaTotal, {
    formatar: v => `R$ ${v.toFixed(2).replace('.', ',')}`
  })

  const elComparacao = document.getElementById('metric-receita-comparacao')
  if (elComparacao) {
    const comparacao = calcularComparacaoReceitaMesAnterior(globalTickets)
    elComparacao.innerHTML = comparacao.texto
    elComparacao.className = `text-xs ${comparacao.classe}`
  }

  // Tempo médio de permanência
  const elTempoMedio = document.getElementById('metric-tempo-medio')
  if (elTempoMedio) {
    elTempoMedio.innerText = calcularTempoMedioPermanencia(ticketsFechados)
  }
  const elPeriodoTempoMedio = document.getElementById(
    'metric-tempo-medio-periodo-label'
  )
  if (elPeriodoTempoMedio)
    elPeriodoTempoMedio.textContent = `Calculado sobre: ${periodoTexto}`
}

// Calcula o tempo médio de permanência dos veículos
function calcularTempoMedioPermanencia (ticketsFechados) {
  const validos = ticketsFechados.filter(t => {
    const ent = t.horaEntrada || t.dataEntrada
    const sai = t.horaSaida || t.dataSaida
    if (!ent || !sai) return false
    const dEntrada = new Date(ent)
    const dSaida = new Date(sai)
    return !isNaN(dEntrada) && !isNaN(dSaida) && dSaida >= dEntrada
  })

  if (validos.length === 0) return '0h 0m'

  const totalMs = validos.reduce((acc, t) => {
    const entrada = new Date(t.horaEntrada || t.dataEntrada)
    const saida = new Date(t.horaSaida || t.dataSaida)
    return acc + (saida - entrada)
  }, 0)

  const mediaMs = totalMs / validos.length
  const totalMinutos = Math.round(mediaMs / 60000)
  const horas = Math.floor(totalMinutos / 60)
  const minutos = totalMinutos % 60

  return `${horas}h ${minutos}m`
}

// Gráfico: Ocupação por Horário de Entrada
function renderizarGraficoOcupacaoHorario (tickets) {
  const canvas = document.getElementById('chart-ocupacao-horario')
  if (!canvas || typeof Chart === 'undefined') return
  const ctx = canvas.getContext('2d')

  const contagemPorHora = new Array(24).fill(0)
  tickets.forEach(t => {
    const ent = t.horaEntrada || t.dataEntrada
    if (!ent) return
    const d = new Date(ent)
    if (!isNaN(d)) {
      const hora = d.getHours()
      contagemPorHora[hora]++
    }
  })

  const labels = contagemPorHora.map(
    (_, hora) => `${String(hora).padStart(2, '0')}h`
  )

  if (chartOcupacaoHorario) chartOcupacaoHorario.destroy()

  chartOcupacaoHorario = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Entradas registradas',
          data: contagemPorHora,
          borderColor: PALETA.pendente,
          backgroundColor: 'rgba(255, 211, 182, 0.2)',
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      },
      plugins: { legend: { display: false } }
    }
  })

  const tbody = document.getElementById('tbody-ocupacao-horario')
  if (tbody) {
    tbody.innerHTML = labels
      .map(
        (label, i) =>
          `<tr><td>${ApiService.sanitizeText(label)}</td><td>${
            contagemPorHora[i]
          }</td></tr>`
      )
      .join('')
  }
}

// Gráfico: Receita por Período
function renderizarGraficoReceitaMensal (tickets, mensalidades = []) {
  const canvas = document.getElementById('chart-receita-mensal')
  if (!canvas || typeof Chart === 'undefined') return
  const ctx = canvas.getContext('2d')

  const ticketsFechados = tickets.filter(
    t => (t.status || '').toLowerCase() === 'fechado'
  )

  const totaisPorMes = {}
  ticketsFechados.forEach(t => {
    const sai = t.horaSaida || t.dataSaida
    if (!sai) return
    const d = new Date(sai)
    if (!isNaN(d)) {
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}`
      totaisPorMes[chave] =
        (totaisPorMes[chave] || 0) +
        (Number(t.valorTotal ?? t.valorCobrado) || 0)
    }
  })
  // Mensalista não paga por ticket — soma o ciclo de mensalidade no mesmo
  // "balde" mensal (referencia já vem no formato "YYYY-MM").
  mensalidades.forEach(mv => {
    totaisPorMes[mv.referencia] =
      (totaisPorMes[mv.referencia] || 0) + (Number(mv.valor) || 0)
  })

  const chavesOrdenadas = Object.keys(totaisPorMes).sort()
  const nomesMes = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez'
  ]

  const labels = chavesOrdenadas.map(chave => {
    const [ano, mes] = chave.split('-')
    return `${nomesMes[Number(mes) - 1]}/${ano.slice(2)}`
  })
  const valores = chavesOrdenadas.map(chave => totaisPorMes[chave])

  ultimoRelatorioReceitaMensal = { labels, valores }

  if (chartReceitaMensal) chartReceitaMensal.destroy()

  chartReceitaMensal = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length > 0 ? labels : ['Sem dados'],
      datasets: [
        {
          label: 'Receita (R$)',
          data: valores.length > 0 ? valores : [0],
          backgroundColor: PALETA.sucesso,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value =>
              `R$ ${Number(value).toFixed(2).replace('.', ',')}`
          }
        }
      },
      plugins: { legend: { display: false } }
    }
  })

  const tbody = document.getElementById('tbody-receita-mensal')
  if (tbody) {
    tbody.innerHTML =
      labels.length > 0
        ? labels
            .map(
              (label, i) =>
                `<tr><td>${ApiService.sanitizeText(label)}</td><td>R$ ${valores[
                  i
                ]
                  .toFixed(2)
                  .replace('.', ',')}</td></tr>`
            )
            .join('')
        : '<tr><td colspan="2" class="text-center text-muted">Nenhum dado registrado</td></tr>'
  }
}

// NOVO GRÁFICO: Receita / Distribuição por Meio de Pagamento
function renderizarGraficoMeiosPagamento (tickets) {
  const canvas = document.getElementById('chart-meios-pagamento')
  if (!canvas || typeof Chart === 'undefined') return
  const ctx = canvas.getContext('2d')

  const ticketsFechados = tickets.filter(
    t => (t.status || '').toLowerCase() === 'fechado'
  )

  const contagem = {
    pix: 0,
    cartao_credito: 0,
    cartao_debito: 0,
    dinheiro: 0,
    isento: 0
  }

  ticketsFechados.forEach(t => {
    let forma = (t.formaPagamento || '').toLowerCase()
    if (!forma && t.mensalistaId) forma = 'isento'
    if (!forma) forma = 'pix' // Padrão de fallback

    if (contagem[forma] !== undefined) {
      contagem[forma] += Number(t.valorTotal ?? t.valorCobrado) || 0
    } else {
      contagem.pix += Number(t.valorTotal ?? t.valorCobrado) || 0
    }
  })

  const labels = [
    'PIX',
    'Cartão Crédito',
    'Cartão Débito',
    'Dinheiro',
    'Isento'
  ]
  const valores = [
    contagem.pix,
    contagem.cartao_credito,
    contagem.cartao_debito,
    contagem.dinheiro,
    contagem.isento
  ]
  const cores = [
    PALETA.pix,
    PALETA.credito,
    PALETA.debito,
    PALETA.dinheiro,
    PALETA.isento
  ]

  if (chartMeiosPagamento) chartMeiosPagamento.destroy()

  chartMeiosPagamento = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: valores,
          backgroundColor: cores,
          borderWidth: 2,
          borderColor: '#1e1e1e'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: context => {
              const val = Number(context.raw || 0)
              return ` R$ ${val.toFixed(2).replace('.', ',')}`
            }
          }
        }
      }
    }
  })
}

// Gráfico: Distribuição por Categoria de Vaga
function renderizarGraficoCategorias (vagas) {
  const canvas = document.getElementById('chart-categorias')
  if (!canvas || typeof Chart === 'undefined') return
  const ctx = canvas.getContext('2d')

  const porTipo = {}
  vagas.forEach(v => {
    const tipo = (v.tipo || 'Outros').toUpperCase()
    if (!porTipo[tipo]) porTipo[tipo] = { ocupadas: 0, total: 0 }
    porTipo[tipo].total++
    if ((v.status || '').toLowerCase() === 'ocupada') porTipo[tipo].ocupadas++
  })

  const labels = Object.keys(porTipo)
  const dataOcupadas = labels.map(tipo => porTipo[tipo].ocupadas)
  const cores = [PALETA.alerta, PALETA.info, PALETA.pendente, PALETA.sucesso]

  if (chartCategorias) chartCategorias.destroy()

  chartCategorias = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length > 0 ? labels : ['Sem dados'],
      datasets: [
        {
          label: 'Vagas Ocupadas',
          data: dataOcupadas.length > 0 ? dataOcupadas : [0],
          backgroundColor: cores,
          borderWidth: 2,
          borderColor: '#1e1e1e'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 13 } }
        }
      }
    }
  })

  const tbody = document.getElementById('tbody-ocupacao-categoria')
  if (tbody) {
    tbody.innerHTML =
      labels.length > 0
        ? labels
            .map(
              tipo =>
                `<tr><td>${ApiService.sanitizeText(tipo)}</td><td>${
                  porTipo[tipo].ocupadas
                }</td><td>${porTipo[tipo].total}</td></tr>`
            )
            .join('')
        : '<tr><td colspan="3" class="text-center text-muted">Nenhuma vaga cadastrada</td></tr>'
  }
}
