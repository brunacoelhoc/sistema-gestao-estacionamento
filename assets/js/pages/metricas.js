/**
 * Lógica da Página de Métricas e Relatórios
 * Cálculo de KPIs e renderização de gráficos acessíveis com Chart.js.
 */

let chartCategorias = null
let chartFaturamento = null

document.addEventListener('DOMContentLoaded', async () => {
  await carregarEProcessarMetricas()
})

// Carrega os dados da API e processa os estatísticas
async function carregarEProcessarMetricas () {
  try {
    const [vagas, tickets, mensalistas] = await Promise.all([
      ApiService.getVagas(),
      ApiService.getTickets(),
      ApiService.getMensalistas()
    ])

    atualizarKPIs(vagas, tickets, mensalistas)
    renderizarGraficoCategorias(vagas)
    renderizarGraficoFaturamento(tickets)
  } catch (error) {
    console.error('Erro ao carregar dados de métricas:', error)
    Swal.fire({
      icon: 'error',
      title: 'Erro ao carregar métricas',
      text: 'Não foi possível buscar as informações analíticas do servidor.'
    })
  }
}

// Atualiza os cards superiores de indicadores de desempenho
function atualizarKPIs (vagas, tickets, mensalistas) {
  // Total de atendimentos concluídos ou em aberto
  const totalAtendimentos = tickets.length
  document.getElementById('metric-total-atendimentos').innerText =
    totalAtendimentos

  // Total de mensalistas cadastrados
  const totalMensalistas = mensalistas.length
  document.getElementById('metric-total-mensalistas').innerText =
    totalMensalistas

  // Cálculo da Receita Estimada com base nos tickets encerrados
  const receita = tickets
    .filter(t => t.status === 'Encerrado' && t.valorPago)
    .reduce((acc, t) => acc + Number(t.valorPago), 0)

  // Soma mensalidades estimadas (exemplo: R$ 250,00 por mensalista ativo)
  const mensalistasAtivos = mensalistas.filter(m => m.status === 'Ativo').length
  const receitaMensalistas = mensalistasAtivos * 250

  const receitaTotal = receita + receitaMensalistas
  document.getElementById('metric-receita-total').innerText = `R$ ${receitaTotal
    .toFixed(2)
    .replace('.', ',')}`

  // Tempo médio simples estimativo (exemplo em horas)
  document.getElementById('metric-tempo-medio').innerText = '1h 45m'
}

// Gráfico de Ocupação por Categoria (Doughnut / Rosca)
function renderizarGraficoCategorias (vagas) {
  const ctx = document.getElementById('chart-categorias')?.getContext('2d')
  if (!ctx) return

  // Agrupa a contagem por tipo/categoria de vaga
  const categorias = {}
  vagas.forEach(v => {
    categorias[v.tipo] = (categorias[v.tipo] || 0) + 1
  })

  const labels = Object.keys(categorias)
  const data = Object.values(categorias)

  if (chartCategorias) {
    chartCategorias.destroy()
  }

  chartCategorias = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length > 0 ? labels : ['Sem dados'],
      datasets: [
        {
          label: 'Quantidade de Vagas',
          data: data.length > 0 ? data : [1],
          backgroundColor: [
            '#0d6efd',
            '#198754',
            '#ffc107',
            '#0dcaf0',
            '#6c757d'
          ],
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 13 }
          }
        }
      }
    }
  })
}

// Gráfico de Faturamento Semanal (Barras)
function renderizarGraficoFaturamento (tickets) {
  const ctx = document.getElementById('chart-faturamento')?.getContext('2d')
  if (!ctx) return

  const diasSemana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
  // Valores mockados/calculados para a semana de demonstração
  const valoresFaturamento = [320, 450, 510, 390, 680, 850, 420]

  if (chartFaturamento) {
    chartFaturamento.destroy()
  }

  chartFaturamento = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: diasSemana,
      datasets: [
        {
          label: 'Faturamento (R$)',
          data: valoresFaturamento,
          backgroundColor: '#198754',
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
            callback: value => `R$ ${value}`
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  })
}
