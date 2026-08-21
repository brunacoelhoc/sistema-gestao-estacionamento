/**
 * Lógica da Página de Métricas e Relatórios
 * Filtro por período, gráficos por meio de pagamento, tabelas acessíveis e
 * renderização com Chart.js.
 *
 * Os KPIs e os dados de cada gráfico já vêm calculados do back-end
 * (GET /metricas, admin-only — ver src/metricas/metricas.service.ts). Esta
 * tela nunca baixa a lista crua de tickets/mensalidades/mensalistas/vagas:
 * só o agregado, e só quem tem token de admin recebe alguma coisa (senão o
 * AdminGuard devolve 403).
 */

let chartOcupacaoHorario = null
let chartReceitaMensal = null
let chartCategorias = null
let chartMeiosPagamento = null

// Última resposta de GET /metricas, reaproveitada pelo modal de detalhes dos
// KPIs e pela exportação (XML/PDF/Excel) sem precisar buscar de novo.
let ultimaRespostaMetricas = null

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

  // Filtro por período: recarrega do servidor com o novo período, em vez de
  // reprocessar dados locais (não há mais dados crus no navegador).
  document
    .getElementById('filtro-periodo-metricas')
    ?.addEventListener('change', () => {
      carregarDadosMetricas()
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

/**
 * Reúne os dados atuais da tela (respeitando o filtro de período) num único
 * objeto, usado pelas três funções de exportação abaixo.
 */
function coletarDadosRelatorio () {
  const selectPeriodo = document.getElementById('filtro-periodo-metricas')
  const periodoTexto = selectPeriodo
    ? selectPeriodo.options[selectPeriodo.selectedIndex].text
    : 'Mês atual'

  const kpis = ultimaRespostaMetricas?.kpis
  const receitaMensal = ultimaRespostaMetricas?.graficos?.receitaMensal || []

  return {
    geradoEm: new Date(),
    periodo: periodoTexto,
    kpis: {
      totalAtendimentos: kpis?.totalAtendimentos || 0,
      totalMensalistas: kpis?.totalMensalistas || 0,
      receitaTotal: kpis?.receitaTotal || 0,
      tempoMedio: kpis?.tempoMedioPermanencia || '0h 0m'
    },
    receitaMensal
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
 * página de Métricas — os números já vêm prontos de GET /metricas.
 */
function abrirDetalhesMetricaKpi (chave) {
  if (typeof Swal === 'undefined' || !ultimaRespostaMetricas) return

  const kpis = ultimaRespostaMetricas.kpis

  let title = ''
  let html = ''

  switch (chave) {
    case 'receita': {
      title = 'Receita do Período'
      html = `<p class="text-muted mb-2">Soma dos tickets avulsos fechados com os ciclos de mensalidade cobrados dentro do período selecionado no filtro (mensalista não paga por ticket, paga o ciclo mensal).</p>
        <ul class="text-start">
          <li>${kpis.ticketsFechados} ticket(s) avulso(s): <strong>R$ ${kpis.receitaTickets
        .toFixed(2)
        .replace('.', ',')}</strong></li>
          <li>Ciclo(s) de mensalidade: <strong>R$ ${kpis.receitaMensalidades
        .toFixed(2)
        .replace('.', ',')}</strong></li>
        </ul>
        <p class="fs-5 mb-0">Total: <strong>R$ ${kpis.receitaTotal
        .toFixed(2)
        .replace('.', ',')}</strong>.</p>`
      break
    }
    case 'atendimentos':
      title = 'Total de Atendimentos'
      html = `<p class="text-muted mb-2">Quantidade de tickets (abertos ou fechados) registrados dentro do período selecionado.</p>
        <ul class="text-start">
          <li>Fechados: <strong>${kpis.ticketsFechados}</strong></li>
          <li>Em aberto: <strong>${kpis.ticketsAbertos}</strong></li>
        </ul>`
      break
    case 'tempo-medio':
      title = 'Tempo Médio de Permanência'
      html = `<p class="text-muted mb-2">Média do tempo entre entrada e saída de todos os tickets fechados do período, com os dois horários registrados.</p>
        <p class="fs-5 mb-0">Calculado sobre <strong>${kpis.ticketsFechados}</strong> ticket(s) fechado(s).</p>`
      break
    case 'mensalistas':
      title = 'Total de Mensalistas'
      html = `<p class="text-muted mb-2">Cadastro completo de mensalistas (não é afetado pelo filtro de período).</p>
        <ul class="text-start">
          <li>Ativos: <strong>${kpis.mensalistasAtivos}</strong></li>
          <li>Inativos: <strong>${kpis.mensalistasInativos}</strong></li>
        </ul>`
      break
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

// Busca os KPIs/gráficos já calculados do servidor para o período selecionado
async function carregarDadosMetricas () {
  const pageError = document.getElementById('page-error')
  const pageErrorText = document.getElementById('page-error-text')

  pageError?.classList.add('d-none')

  const selectPeriodo = document.getElementById('filtro-periodo-metricas')
  const periodo = selectPeriodo ? selectPeriodo.value : 'mes_atual'

  try {
    ultimaRespostaMetricas = await ApiService.getMetricas(periodo)
    renderizarMetricas(ultimaRespostaMetricas)
  } catch (error) {
    console.error('Erro ao carregar dados de métricas:', error)

    // Sessão expirada (401) já é tratada por AuthService.tratarSessaoExpirada
    // — logout + redirect pro login já disparados a essa altura.
    if (typeof AuthService !== 'undefined' && !AuthService.estaLogado()) {
      return
    }

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

// Texto do período atualmente selecionado no filtro (ex.: "Mês atual"),
// usado para deixar claro nos cards de KPI a que intervalo os números
// exibidos se referem.
function obterTextoPeriodoAtual () {
  const select = document.getElementById('filtro-periodo-metricas')
  return select ? select.options[select.selectedIndex].text : 'Mês atual'
}

// Pinta todos os componentes da tela a partir da resposta de GET /metricas
function renderizarMetricas (resposta) {
  atualizarKPIs(resposta.kpis)
  renderizarGraficoOcupacaoHorario(resposta.graficos.ocupacaoPorHorario)
  renderizarGraficoReceitaMensal(resposta.graficos.receitaMensal)
  renderizarGraficoMeiosPagamento(resposta.graficos.meiosPagamento)
  renderizarGraficoCategorias(resposta.graficos.categorias)
}

// Monta texto/ícone/cor de comparação com o mês anterior a partir dos
// números crus devolvidos pelo servidor — formatação é a única coisa que
// ainda vive no front (não decide nem calcula nada sensível).
function formatarComparacaoReceitaMesAnterior ({ receitaMesAtual, receitaMesAnterior, variacaoPercentual }) {
  if (variacaoPercentual === null) {
    return {
      texto: receitaMesAtual > 0
        ? 'Sem receita no mês anterior para comparar'
        : 'Sem dados suficientes para comparar',
      classe: 'text-light'
    }
  }

  const sinal = variacaoPercentual >= 0 ? '+' : ''
  const classe = variacaoPercentual >= 0 ? 'text-success' : 'text-danger'
  const icone = variacaoPercentual >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'

  return {
    texto: `<i class="fas ${icone} me-1" aria-hidden="true"></i>${sinal}${variacaoPercentual.toFixed(1)}% vs mês anterior`,
    classe
  }
}

// Atualiza os cards superiores de indicadores de desempenho (KPIs)
function atualizarKPIs (kpis) {
  const animar =
    typeof animarContadorGsap === 'function'
      ? animarContadorGsap
      : (el, valor, opcoes) => {
          if (el) el.textContent = opcoes?.formatar ? opcoes.formatar(valor) : valor
        }

  const periodoTexto = obterTextoPeriodoAtual()

  // Total de atendimentos
  animar(document.getElementById('metric-total-atendimentos'), kpis.totalAtendimentos)
  const elPeriodoAtendimentos = document.getElementById('metric-atendimentos-periodo-label')
  if (elPeriodoAtendimentos) { elPeriodoAtendimentos.textContent = `Período: ${periodoTexto}` }

  // Total de mensalistas cadastrados
  animar(document.getElementById('metric-total-mensalistas'), kpis.totalMensalistas)

  // Receita do Período (tickets avulsos fechados + ciclos de mensalidade)
  animar(document.getElementById('metric-receita-total'), kpis.receitaTotal, {
    formatar: v => `R$ ${v.toFixed(2).replace('.', ',')}`
  })

  const elComparacao = document.getElementById('metric-receita-comparacao')
  if (elComparacao) {
    const comparacao = formatarComparacaoReceitaMesAnterior(kpis.comparacaoReceitaMesAnterior)
    elComparacao.innerHTML = comparacao.texto
    elComparacao.className = `text-xs ${comparacao.classe}`
  }

  // Tempo médio de permanência
  const elTempoMedio = document.getElementById('metric-tempo-medio')
  if (elTempoMedio) {
    elTempoMedio.innerText = kpis.tempoMedioPermanencia
  }
  const elPeriodoTempoMedio = document.getElementById('metric-tempo-medio-periodo-label')
  if (elPeriodoTempoMedio) { elPeriodoTempoMedio.textContent = `Calculado sobre: ${periodoTexto}` }
}

// Gráfico: Ocupação por Horário de Entrada
function renderizarGraficoOcupacaoHorario (ocupacaoPorHorario) {
  const canvas = document.getElementById('chart-ocupacao-horario')
  if (!canvas || typeof Chart === 'undefined') return
  const ctx = canvas.getContext('2d')

  const labels = ocupacaoPorHorario.map(item => item.hora)
  const contagens = ocupacaoPorHorario.map(item => item.contagem)

  if (chartOcupacaoHorario) chartOcupacaoHorario.destroy()

  chartOcupacaoHorario = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Entradas registradas',
          data: contagens,
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
    tbody.innerHTML = ocupacaoPorHorario
      .map(
        item =>
          `<tr><td>${ApiService.sanitizeText(item.hora)}</td><td>${item.contagem}</td></tr>`
      )
      .join('')
  }
}

// Gráfico: Receita por Período
function renderizarGraficoReceitaMensal (receitaMensal) {
  const canvas = document.getElementById('chart-receita-mensal')
  if (!canvas || typeof Chart === 'undefined') return
  const ctx = canvas.getContext('2d')

  const labels = receitaMensal.map(item => item.mes)
  const valores = receitaMensal.map(item => item.valor)

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
      receitaMensal.length > 0
        ? receitaMensal
          .map(
            item =>
                `<tr><td>${ApiService.sanitizeText(item.mes)}</td><td>R$ ${item.valor
                  .toFixed(2)
                  .replace('.', ',')}</td></tr>`
          )
          .join('')
        : '<tr><td colspan="2" class="text-center text-muted">Nenhum dado registrado</td></tr>'
  }
}

// NOVO GRÁFICO: Receita / Distribuição por Meio de Pagamento
function renderizarGraficoMeiosPagamento (meiosPagamento) {
  const canvas = document.getElementById('chart-meios-pagamento')
  if (!canvas || typeof Chart === 'undefined') return
  const ctx = canvas.getContext('2d')

  const labels = [
    'PIX',
    'Cartão Crédito',
    'Cartão Débito',
    'Dinheiro',
    'Isento'
  ]
  const valores = [
    meiosPagamento.pix,
    meiosPagamento.cartaoCredito,
    meiosPagamento.cartaoDebito,
    meiosPagamento.dinheiro,
    meiosPagamento.isento
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
function renderizarGraficoCategorias (categorias) {
  const canvas = document.getElementById('chart-categorias')
  if (!canvas || typeof Chart === 'undefined') return
  const ctx = canvas.getContext('2d')

  const labels = categorias.map(item => item.tipo)
  const dataOcupadas = categorias.map(item => item.ocupadas)
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
      categorias.length > 0
        ? categorias
          .map(
            item =>
                `<tr><td>${ApiService.sanitizeText(item.tipo)}</td><td>${item.ocupadas}</td><td>${item.total}</td></tr>`
          )
          .join('')
        : '<tr><td colspan="3" class="text-center text-muted">Nenhuma vaga cadastrada</td></tr>'
  }
}
