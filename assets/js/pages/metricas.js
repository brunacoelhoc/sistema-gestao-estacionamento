/**
 * Lógica da Página de Métricas e Relatórios
 * Cálculo de KPIs e renderização de gráficos acessíveis com Chart.js.
 */

let chartOcupacaoHorario = null
let chartReceitaMensal = null
let chartCategorias = null

// Paleta pastel do projeto (mantida em sincronia manual com
// assets/scss/_variables.scss — não há uma fonte única compartilhada entre
// Sass e JS neste projeto, então qualquer mudança de cor lá precisa ser
// replicada aqui também).
const PALETA = {
  sucesso: '#a8e6cf',
  pendente: '#ffd3b6',
  alerta: '#ff8b94',
  info: '#d4f0f0'
}

document.addEventListener('DOMContentLoaded', async () => {
  configurarTemaDarkDoChartJs()
  await carregarEProcessarMetricas()

  document.getElementById('btn-retry-page')?.addEventListener('click', () => {
    carregarEProcessarMetricas()
  })
})

// Ajusta as cores padrão do Chart.js para leitura confortável sobre o painel
// escuro ("Grafana Dark") — sem isso, texto/grade ficam quase invisíveis.
function configurarTemaDarkDoChartJs () {
  Chart.defaults.color = 'rgba(255, 255, 255, 0.75)'
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.08)'
}

// Carrega os dados da API e processa as estatísticas
async function carregarEProcessarMetricas () {
  const pageError = document.getElementById('page-error')
  const pageErrorText = document.getElementById('page-error-text')

  pageError?.classList.add('d-none')

  try {
    const [vagas, tickets, mensalistas] = await Promise.all([
      ApiService.getVagas(),
      ApiService.getTickets(),
      ApiService.getMensalistas()
    ])

    atualizarKPIs(vagas, tickets, mensalistas)
    renderizarGraficoOcupacaoHorario(tickets)
    renderizarGraficoReceitaMensal(tickets)
    renderizarGraficoCategorias(vagas)
  } catch (error) {
    console.error('Erro ao carregar dados de métricas:', error)

    if (pageError && pageErrorText) {
      pageErrorText.textContent =
        'Não foi possível carregar as métricas. Verifique sua conexão e tente novamente.'
      pageError.classList.remove('d-none')
    }

    Swal.fire({
      icon: 'error',
      title: 'Erro ao carregar métricas',
      text: 'Não foi possível buscar as informações analíticas do servidor.'
    })
  }
}

// Atualiza os cards superiores de indicadores de desempenho
function atualizarKPIs (vagas, tickets, mensalistas) {
  const ticketsFechados = tickets.filter(
    t => (t.status || '').toLowerCase() === 'fechado'
  )

  // Total de atendimentos (todos os tickets já emitidos, abertos ou fechados)
  document.getElementById('metric-total-atendimentos').innerText =
    tickets.length

  // Total de mensalistas cadastrados (ativos + inativos)
  document.getElementById('metric-total-mensalistas').innerText =
    mensalistas.length

  // Receita DO MÊS ATUAL — soma o valorTotal dos tickets fechados cuja
  // dataSaida caiu no mês/ano corrente.
  const agora = new Date()
  const receitaDoMes = ticketsFechados
    .filter(t => {
      if (!t.dataSaida) return false
      const d = new Date(t.dataSaida)
      return (
        d.getMonth() === agora.getMonth() &&
        d.getFullYear() === agora.getFullYear()
      )
    })
    .reduce((acc, t) => acc + (Number(t.valorTotal) || 0), 0)

  document.getElementById('metric-receita-total').innerText = `R$ ${receitaDoMes
    .toFixed(2)
    .replace('.', ',')}`

  // Tempo médio de permanência — diferença real entre dataSaida e
  // dataEntrada dos tickets fechados, em horas e minutos.
  document.getElementById('metric-tempo-medio').innerText =
    calcularTempoMedioPermanencia(ticketsFechados)
}

function calcularTempoMedioPermanencia (ticketsFechados) {
  const validos = ticketsFechados.filter(t => t.dataEntrada && t.dataSaida)
  if (validos.length === 0) return 'Nenhum dado disponível'

  const totalMs = validos.reduce((acc, t) => {
    const entrada = new Date(t.dataEntrada)
    const saida = new Date(t.dataSaida)
    return acc + Math.max(0, saida - entrada)
  }, 0)

  const mediaMs = totalMs / validos.length
  const totalMinutos = Math.round(mediaMs / 60000)
  const horas = Math.floor(totalMinutos / 60)
  const minutos = totalMinutos % 60

  return `${horas}h ${minutos}m`
}

// Gráfico: Ocupação por Horário
//
// DECISÃO DE MODELAGEM (documentar para a equipe): reconstruir quantas vagas
// estavam ocupadas SIMULTANEAMENTE em cada hora exigiria um modelo de
// intervalos (checar sobreposição de todos os tickets ativos naquele
// horário, em algum dia de referência). Isso é bem mais complexo e ambíguo
// sem uma data específica escolhida. Como proxy mais simples e diretamente
// calculável a partir dos dados, uso aqui "entradas por horário do dia"
// (quantos tickets começaram em cada hora, somando todo o histórico). Se a
// equipe quiser o modelo de ocupação simultânea de verdade, precisamos
// decidir um dia de referência (ex.: "hoje") e me avisar.
function renderizarGraficoOcupacaoHorario (tickets) {
  const ctx = document
    .getElementById('chart-ocupacao-horario')
    ?.getContext('2d')
  if (!ctx) return

  const contagemPorHora = new Array(24).fill(0)
  tickets.forEach(t => {
    if (!t.dataEntrada) return
    const hora = new Date(t.dataEntrada).getHours()
    contagemPorHora[hora]++
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

  // Alternativa textual acessível (WCAG 1.1.1)
  const tbody = document.getElementById('tbody-ocupacao-horario')
  if (tbody) {
    tbody.innerHTML = labels
      .map(
        (label, i) => `<tr><td>${label}</td><td>${contagemPorHora[i]}</td></tr>`
      )
      .join('')
  }
}

// Gráfico: Receita Mensal
function renderizarGraficoReceitaMensal (tickets) {
  const ctx = document.getElementById('chart-receita-mensal')?.getContext('2d')
  if (!ctx) return

  const ticketsFechados = tickets.filter(
    t => (t.status || '').toLowerCase() === 'fechado' && t.dataSaida
  )

  // Agrupa por ano-mês (chave "AAAA-MM") para ordenar corretamente
  const totaisPorMes = {}
  ticketsFechados.forEach(t => {
    const d = new Date(t.dataSaida)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}`
    totaisPorMes[chave] =
      (totaisPorMes[chave] || 0) + (Number(t.valorTotal) || 0)
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
          ticks: { callback: value => `R$ ${value}` }
        }
      },
      plugins: { legend: { display: false } }
    }
  })

  const tbody = document.getElementById('tbody-receita-mensal')
  if (tbody) {
    tbody.innerHTML = labels
      .map(
        (label, i) =>
          `<tr><td>${label}</td><td>R$ ${valores[i]
            .toFixed(2)
            .replace('.', ',')}</td></tr>`
      )
      .join('')
  }
}

// Gráfico: Ocupação por Categoria — mostra vagas OCUPADAS por tipo (não o
// inventário total), já que o título do card promete "ocupação".
function renderizarGraficoCategorias (vagas) {
  const ctx = document.getElementById('chart-categorias')?.getContext('2d')
  if (!ctx) return

  const porTipo = {}
  vagas.forEach(v => {
    const tipo = v.tipo || 'outro'
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
          label: 'Vagas ocupadas',
          data: dataOcupadas.length > 0 ? dataOcupadas : [1],
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
    tbody.innerHTML = labels
      .map(
        tipo =>
          `<tr><td>${tipo}</td><td>${porTipo[tipo].ocupadas}</td><td>${porTipo[tipo].total}</td></tr>`
      )
      .join('')
  }
}
