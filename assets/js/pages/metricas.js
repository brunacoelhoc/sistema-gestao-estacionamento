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
})

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
    const [vagas, tickets, mensalistas] = await Promise.all([
      ApiService.getVagas ? ApiService.getVagas() : Promise.resolve([]),
      ApiService.getTickets ? ApiService.getTickets() : Promise.resolve([]),
      ApiService.getMensalistas
        ? ApiService.getMensalistas()
        : Promise.resolve([])
    ])

    globalVagas = vagas || []
    globalTickets = tickets || []
    globalMensalistas = mensalistas || []

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

  atualizarKPIs(globalVagas, ticketsFiltrados, globalMensalistas)
  renderizarGraficoOcupacaoHorario(ticketsFiltrados)
  renderizarGraficoReceitaMensal(ticketsFiltrados)
  renderizarGraficoMeiosPagamento(ticketsFiltrados)
  renderizarGraficoCategorias(globalVagas)
}

// Atualiza os cards superiores de indicadores de desempenho (KPIs)
function atualizarKPIs (vagas, tickets, mensalistas) {
  const ticketsFechados = tickets.filter(
    t => (t.status || '').toLowerCase() === 'fechado'
  )

  // Total de atendimentos
  const elTotalAtendimentos = document.getElementById(
    'metric-total-atendimentos'
  )
  if (elTotalAtendimentos) elTotalAtendimentos.innerText = tickets.length

  // Total de mensalistas cadastrados
  const elTotalMensalistas = document.getElementById('metric-total-mensalistas')
  if (elTotalMensalistas) elTotalMensalistas.innerText = mensalistas.length

  // Receita do Período
  const receitaTotal = ticketsFechados.reduce(
    (acc, t) => acc + (Number(t.valorTotal ?? t.valorCobrado) || 0),
    0
  )

  const elReceitaTotal = document.getElementById('metric-receita-total')
  if (elReceitaTotal) {
    elReceitaTotal.innerText = `R$ ${receitaTotal.toFixed(2).replace('.', ',')}`
  }

  // Tempo médio de permanência
  const elTempoMedio = document.getElementById('metric-tempo-medio')
  if (elTempoMedio) {
    elTempoMedio.innerText = calcularTempoMedioPermanencia(ticketsFechados)
  }
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
function renderizarGraficoReceitaMensal (tickets) {
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
