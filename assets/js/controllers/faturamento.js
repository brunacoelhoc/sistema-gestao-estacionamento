/**
 * Lógica da Página de Gestão de Faturamento
 * Visão global das cobranças mensais (Mensalidade) de todos os mensalistas,
 * com filtros, KPIs e ações de baixa (marcar como paga) e cancelamento.
 */

let mensalidadesCache = []
let mensalistasCache = []
// Última lista filtrada renderizada na tabela — usada pelos cartões de
// resumo (forma de pagamento / churn) e pela exportação, para que ambos
// sempre reflitam exatamente o que está na tela.
let mensalidadesFiltradasAtual = []

document.addEventListener('DOMContentLoaded', async () => {
  await carregarFaturamento()

  document
    .getElementById('input-busca-faturamento')
    ?.addEventListener('input', aplicarFiltrosFaturamento)

  document
    .getElementById('filtro-status-faturamento')
    ?.addEventListener('change', aplicarFiltrosFaturamento)

  document
    .getElementById('filtro-referencia-faturamento')
    ?.addEventListener('change', aplicarFiltrosFaturamento)

  document
    .getElementById('filtro-periodo-de-faturamento')
    ?.addEventListener('change', aplicarFiltrosFaturamento)

  document
    .getElementById('filtro-periodo-ate-faturamento')
    ?.addEventListener('change', aplicarFiltrosFaturamento)

  document.getElementById('btn-retry-page')?.addEventListener('click', () => {
    carregarFaturamento()
  })

  document
    .getElementById('btn-exportar-faturamento-csv')
    ?.addEventListener('click', () => exportarFaturamento('csv'))
  document
    .getElementById('btn-exportar-faturamento-excel')
    ?.addEventListener('click', () => exportarFaturamento('excel'))
  document
    .getElementById('btn-exportar-faturamento-pdf')
    ?.addEventListener('click', exportarFaturamentoPDF)
})

// Referência do mês atual no formato "YYYY-MM", usada pelos KPIs.
function referenciaAtual () {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
}

const ROTULO_STATUS_FATURAMENTO = {
  pendente: 'Pendente',
  paga: 'Paga',
  cancelada: 'Cancelada'
}

// badge-status (assets/scss/_components.scss) não tem classes próprias para
// "paga"/"cancelada" — reaproveita status-pago (cor info) e status-cancelado.
const CLASSE_STATUS_FATURAMENTO = {
  pendente: 'status-pendente',
  paga: 'status-pago',
  cancelada: 'status-cancelado'
}

// Sem emoji — usado nas exportações (CSV/Excel/PDF), onde o relatório vai
// pra contabilidade e a fonte padrão do jsPDF não sabe desenhar emoji (sai
// como caractere quebrado no PDF gerado).
const ROTULO_FORMA_PAGAMENTO_TEXTO = {
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro'
}

const ROTULO_FORMA_PAGAMENTO = {
  pix: '📱 PIX',
  cartao_credito: '💳 Cartão de Crédito',
  cartao_debito: '💳 Cartão de Débito',
  dinheiro: '💵 Dinheiro'
}

// Busca a lista completa de mensalidades (todos os mensalistas) da API.
async function carregarFaturamento () {
  const pageError = document.getElementById('page-error')
  const pageErrorText = document.getElementById('page-error-text')
  const tbody = document.getElementById('tbody-faturamento')

  pageError?.classList.add('d-none')
  tbody?.setAttribute('aria-busy', 'true')

  try {
    const [mensalidades, mensalistas] = await Promise.all([
      ApiService.getMensalidades(),
      ApiService.getMensalistas()
    ])
    mensalidadesCache = mensalidades || []
    mensalistasCache = mensalistas || []
    popularFiltroReferencia()
    aplicarFiltrosFaturamento()
    atualizarKpisFaturamento()
  } catch (error) {
    console.error('Erro ao carregar faturamento:', error)

    // Sessão expirada (401) já é tratada por AuthService.tratarSessaoExpirada
    // — logout + redirect pro login já disparados a essa altura.
    if (typeof AuthService !== 'undefined' && !AuthService.estaLogado()) {
      return
    }

    if (pageError && pageErrorText) {
      pageErrorText.textContent =
        'Não foi possível carregar as cobranças. Verifique sua conexão e tente novamente.'
      pageError.classList.remove('d-none')
    }

    Swal.fire({
      icon: 'error',
      title: 'Erro de Conexão',
      text: 'Não foi possível carregar a lista de cobranças.'
    })
  } finally {
    tbody?.setAttribute('aria-busy', 'false')
  }
}

// Preenche o select de referência (mês) com os meses presentes na lista
// carregada, do mais recente para o mais antigo, sem duplicar opções.
function popularFiltroReferencia () {
  const select = document.getElementById('filtro-referencia-faturamento')
  if (!select) return

  const valorAtual = select.value
  const referencias = [...new Set(mensalidadesCache.map(mv => mv.referencia))].sort(
    (a, b) => (a < b ? 1 : -1)
  )

  select.innerHTML = '<option value="TODOS">Todos os meses</option>' +
    referencias
      .map(ref => `<option value="${ref}">${formatarReferenciaFaturamento(ref)}</option>`)
      .join('')

  if (referencias.includes(valorAtual)) select.value = valorAtual
}

// Aplica busca por nome/placa + filtros de status, referência e período
// customizado (De/Até, sobre a data de início do ciclo).
function aplicarFiltrosFaturamento () {
  const termo = (document.getElementById('input-busca-faturamento')?.value || '')
    .toLowerCase()
    .trim()
  const statusFiltro =
    document.getElementById('filtro-status-faturamento')?.value || 'TODOS'
  const referenciaFiltro =
    document.getElementById('filtro-referencia-faturamento')?.value || 'TODOS'
  const periodoDe = document.getElementById('filtro-periodo-de-faturamento')?.value || ''
  const periodoAte = document.getElementById('filtro-periodo-ate-faturamento')?.value || ''

  let filtradas = mensalidadesCache

  if (statusFiltro !== 'TODOS') {
    filtradas = filtradas.filter(mv => mv.status === statusFiltro)
  }

  if (referenciaFiltro !== 'TODOS') {
    filtradas = filtradas.filter(mv => mv.referencia === referenciaFiltro)
  }

  if (periodoDe) {
    const de = new Date(periodoDe)
    filtradas = filtradas.filter(mv => mv.dataInicio && new Date(mv.dataInicio) >= de)
  }

  if (periodoAte) {
    // Fim do dia selecionado, senão um ciclo iniciado nesse mesmo dia ficaria de fora.
    const ate = new Date(periodoAte)
    ate.setHours(23, 59, 59, 999)
    filtradas = filtradas.filter(mv => mv.dataInicio && new Date(mv.dataInicio) <= ate)
  }

  if (termo) {
    filtradas = filtradas.filter(
      mv =>
        (mv.mensalista?.nome || '').toLowerCase().includes(termo) ||
        (mv.mensalista?.placa || '').toLowerCase().includes(termo)
    )
  }

  mensalidadesFiltradasAtual = filtradas
  renderizarTabelaFaturamento(filtradas)
  atualizarResumoFormaPagamento(filtradas)
  atualizarResumoChurn(filtradas)
}

// Resumo de valores recebidos (status "paga") agrupados por forma de
// pagamento, sobre a lista já filtrada — reflete exatamente o que está
// sendo mostrado na tabela abaixo.
function atualizarResumoFormaPagamento (lista) {
  const container = document.getElementById('resumo-formas-pagamento')
  if (!container) return

  const totais = {}
  lista
    .filter(mv => mv.status === 'paga')
    .forEach(mv => {
      const forma = mv.formaPagamento || 'outro'
      totais[forma] = (totais[forma] || 0) + Number(mv.valor || 0)
    })

  const chaves = Object.keys(totais)
  if (chaves.length === 0) {
    container.innerHTML = '<span class="text-muted text-sm">Nenhuma cobrança paga no filtro atual.</span>'
    return
  }

  container.innerHTML = chaves
    .sort((a, b) => totais[b] - totais[a])
    .map(forma => `
      <div>
        <div class="text-muted text-xs">${ROTULO_FORMA_PAGAMENTO[forma] || forma}</div>
        <div class="h5 mb-0 fw-bold">R$ ${totais[forma].toFixed(2).replace('.', ',')}</div>
      </div>
    `)
    .join('')
}

// Impacto financeiro dos cancelamentos (churn) na lista já filtrada.
function atualizarResumoChurn (lista) {
  const canceladas = lista.filter(mv => mv.status === 'cancelada')
  const valorPerdido = canceladas.reduce((soma, mv) => soma + Number(mv.valor || 0), 0)

  const elQtd = document.getElementById('churn-quantidade')
  const elValor = document.getElementById('churn-valor')
  if (elQtd) elQtd.textContent = String(canceladas.length)
  if (elValor) elValor.textContent = `R$ ${valorPerdido.toFixed(2).replace('.', ',')}`
}

// Cálculo dos KPIs a partir da lista completa (não filtrada) + do cadastro
// de mensalistas, para que os cartões sempre reflitam o panorama geral,
// independente da busca/filtro ativos.
function atualizarKpisFaturamento () {
  const ref = referenciaAtual()
  const hoje = new Date()

  const mensalistasAtivos = mensalistasCache.filter(m => m.ativo)

  // Faturamento Previsto (MRR): soma do valor do plano de todo mensalista
  // ativo — é o que se espera arrecadar por ciclo se todos passarem pela
  // cancela dentro do período, não uma cobrança já lançada.
  const mrr = mensalistasAtivos.reduce((soma, m) => soma + Number(m.valorMensalidade || 0), 0)

  // Faturamento Realizado: ciclos efetivamente pagos cujo início caiu no
  // mês corrente — comparar com o MRR acima mostra quanto do previsto já
  // veio a caixa neste mês.
  const recebidoNoMes = mensalidadesCache
    .filter(mv => mv.status === 'paga' && mv.referencia === ref)
    .reduce((soma, mv) => soma + Number(mv.valor || 0), 0)

  const ticketMedio = mensalistasAtivos.length > 0 ? mrr / mensalistasAtivos.length : 0

  // "Sem Ciclo Ativo": mensalista ativo cujo último ciclo pago (se algum)
  // já venceu, ou que nunca chegou a pagar um primeiro ciclo — não é
  // "inadimplência" no sentido de atraso (a cobrança só acontece quando ele
  // aparece, ver server/services/mensalidade.js), mas sinaliza quem está
  // sem cobertura vigente agora.
  const semCicloAtivo = mensalistasAtivos.filter(m => {
    const ciclosDoMensalista = mensalidadesCache.filter(
      mv => mv.mensalistaId === m.id && mv.status === 'paga'
    )
    if (ciclosDoMensalista.length === 0) return true
    return !ciclosDoMensalista.some(mv => mv.dataFim && new Date(mv.dataFim) >= hoje)
  }).length

  const elPrevisto = document.getElementById('kpi-previsto-mrr')
  const elRecebido = document.getElementById('kpi-recebido-mes')
  const elTicketMedio = document.getElementById('kpi-ticket-medio')
  const elSemCiclo = document.getElementById('kpi-sem-ciclo')

  if (elPrevisto) elPrevisto.textContent = `R$ ${mrr.toFixed(2).replace('.', ',')}`
  if (elRecebido) elRecebido.textContent = `R$ ${recebidoNoMes.toFixed(2).replace('.', ',')}`
  if (elTicketMedio) elTicketMedio.textContent = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`
  if (elSemCiclo) {
    elSemCiclo.textContent = mensalistasAtivos.length > 0
      ? `${semCicloAtivo} (${((semCicloAtivo / mensalistasAtivos.length) * 100).toFixed(0)}%)`
      : '0'
  }
}

// Formata a referência do ciclo ("2026-08") como "08/2026"
function formatarReferenciaFaturamento (referencia) {
  const [ano, mes] = String(referencia || '').split('-')
  return ano && mes ? `${mes}/${ano}` : referencia || '-'
}

function formatarDataFaturamento (iso) {
  if (!iso) return '-'
  const data = new Date(iso)
  return isNaN(data) ? '-' : data.toLocaleDateString('pt-BR')
}

const paginadorFaturamento =
  typeof criarPaginador === 'function'
    ? criarPaginador({
      idSufixo: 'faturamento',
      tbodyId: 'tbody-faturamento',
      colspanVazio: 8,
      textoVazio:
          '<i class="fas fa-search me-2" aria-hidden="true"></i>Nenhuma cobrança encontrada.',
      renderLinha: renderLinhaFaturamento,
      aposRenderizar: ligarBotoesLinhaFaturamento
    })
    : null

function renderLinhaFaturamento (mv, tbody) {
  const tr = document.createElement('tr')

  const statusBadge = `<span class="badge-status ${CLASSE_STATUS_FATURAMENTO[mv.status] || ''}">${ROTULO_STATUS_FATURAMENTO[mv.status] || mv.status}</span>`

  const acoes = mv.status === 'pendente'
    ? `<button type="button" class="btn btn-sm btn-outline-success me-1 btn-marcar-paga-faturamento" data-id="${mv.id}" aria-label="Marcar cobrança como paga">
         <i class="fas fa-check" aria-hidden="true"></i> Marcar como paga
       </button>
       <button type="button" class="btn btn-sm btn-outline-danger btn-cancelar-faturamento" data-id="${mv.id}" aria-label="Cancelar cobrança">
         <i class="fas fa-ban" aria-hidden="true"></i> Cancelar
       </button>`
    : '-'

  tr.innerHTML = `
    <td class="fw-bold">${ApiService.sanitizeText(mv.mensalista?.nome || '-')}</td>
    <td><span class="badge bg-dark text-white">${ApiService.sanitizeText(mv.mensalista?.placa || '-')}</span></td>
    <td>${formatarReferenciaFaturamento(mv.referencia)}</td>
    <td>${formatarDataFaturamento(mv.dataInicio)} a ${formatarDataFaturamento(mv.dataFim)}</td>
    <td>R$ ${Number(mv.valor || 0).toFixed(2).replace('.', ',')}</td>
    <td>${statusBadge}</td>
    <td>${ROTULO_FORMA_PAGAMENTO[mv.formaPagamento] || '-'}</td>
    <td>${acoes}</td>
  `
  tbody.appendChild(tr)
}

function ligarBotoesLinhaFaturamento (tbody) {
  tbody.querySelectorAll('.btn-marcar-paga-faturamento').forEach(btn => {
    btn.addEventListener('click', () =>
      marcarCobrancaPaga(btn.getAttribute('data-id'))
    )
  })
  tbody.querySelectorAll('.btn-cancelar-faturamento').forEach(btn => {
    btn.addEventListener('click', () =>
      cancelarCobranca(btn.getAttribute('data-id'))
    )
  })
}

function renderizarTabelaFaturamento (lista) {
  if (paginadorFaturamento) {
    paginadorFaturamento.definirItens(lista || [])
    return
  }

  const tbody = document.getElementById('tbody-faturamento')
  if (!tbody) return
  tbody.innerHTML = ''
  ;(lista || []).forEach(mv => renderLinhaFaturamento(mv, tbody))
  ligarBotoesLinhaFaturamento(tbody)
}

// Monta as linhas "achatadas" a partir da lista já filtrada (mesma exibida
// na tabela), compartilhadas pelos três formatos de exportação.
function montarLinhasExportacaoFaturamento () {
  return mensalidadesFiltradasAtual.map(mv => ({
    mensalista: mv.mensalista?.nome || '-',
    placa: mv.mensalista?.placa || '-',
    referencia: formatarReferenciaFaturamento(mv.referencia),
    periodo: `${formatarDataFaturamento(mv.dataInicio)} a ${formatarDataFaturamento(mv.dataFim)}`,
    valor: Number(mv.valor || 0).toFixed(2).replace('.', ','),
    status: ROTULO_STATUS_FATURAMENTO[mv.status] || mv.status,
    formaPagamento: ROTULO_FORMA_PAGAMENTO_TEXTO[mv.formaPagamento] || '-'
  }))
}

const COLUNAS_EXPORTACAO_FATURAMENTO = [
  { chave: 'mensalista', rotulo: 'Mensalista' },
  { chave: 'placa', rotulo: 'Placa' },
  { chave: 'referencia', rotulo: 'Referência' },
  { chave: 'periodo', rotulo: 'Período' },
  { chave: 'valor', rotulo: 'Valor (R$)' },
  { chave: 'status', rotulo: 'Status' },
  { chave: 'formaPagamento', rotulo: 'Forma de Pagamento' }
]

function exportarFaturamento (formato) {
  const linhas = montarLinhasExportacaoFaturamento()

  if (formato === 'excel') {
    exportarParaExcel('faturamento-parkgestao.xlsx', 'Faturamento', COLUNAS_EXPORTACAO_FATURAMENTO, linhas)
  } else {
    exportarParaCSV('faturamento-parkgestao.csv', COLUNAS_EXPORTACAO_FATURAMENTO, linhas)
  }
}

// Relatório em PDF (sem plugin de tabela — jsPDF puro, como o comprovante de
// ticket) com o resumo dos KPIs no topo e a lista filtrada abaixo, paginando
// automaticamente quando o conteúdo passa da margem inferior.
function exportarFaturamentoPDF () {
  if (typeof window.jspdf === 'undefined') {
    Swal.fire({
      icon: 'error',
      title: 'Exportação indisponível',
      text: 'Não foi possível carregar a biblioteca de geração de PDF.'
    })
    return
  }

  const linhas = montarLinhasExportacaoFaturamento()
  if (linhas.length === 0) {
    if (typeof avisarExportacaoVazia === 'function') avisarExportacaoVazia()
    return
  }

  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const margemEsquerda = 10
  const larguraUtil = 277
  let y = 15

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('ParkGestão — Relatório de Faturamento', margemEsquerda, y)

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} — ${linhas.length} cobrança(s)`, margemEsquerda, y)

  y += 8
  const colunas = [
    { chave: 'mensalista', rotulo: 'Mensalista', largura: 55 },
    { chave: 'placa', rotulo: 'Placa', largura: 25 },
    { chave: 'referencia', rotulo: 'Ref.', largura: 20 },
    { chave: 'periodo', rotulo: 'Período', largura: 55 },
    { chave: 'valor', rotulo: 'Valor (R$)', largura: 30 },
    { chave: 'status', rotulo: 'Status', largura: 30 },
    { chave: 'formaPagamento', rotulo: 'Pagamento', largura: 40 }
  ]

  const desenharCabecalho = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    let x = margemEsquerda
    colunas.forEach(c => {
      doc.text(c.rotulo, x, y)
      x += c.largura
    })
    y += 2
    doc.line(margemEsquerda, y, margemEsquerda + larguraUtil, y)
    y += 5
  }

  desenharCabecalho()
  doc.setFont('helvetica', 'normal')

  linhas.forEach(linha => {
    if (y > 195) {
      doc.addPage()
      y = 15
      desenharCabecalho()
      doc.setFont('helvetica', 'normal')
    }

    let x = margemEsquerda
    colunas.forEach(c => {
      const texto = String(linha[c.chave] ?? '-')
      const truncado = texto.length > 32 ? texto.slice(0, 30) + '…' : texto
      doc.text(truncado, x, y)
      x += c.largura
    })
    y += 6
  })

  doc.save('faturamento-parkgestao.pdf')
}

// Pede a forma de pagamento e dá baixa na cobrança (status -> paga)
async function marcarCobrancaPaga (id) {
  const { isConfirmed, value: formaPagamento } = await Swal.fire({
    title: 'Dar baixa na cobrança',
    html: `
      <div class="mb-3 text-start">
        <label for="swal-forma-pagamento-faturamento" class="form-label fw-semibold">Forma de Pagamento:</label>
        <select id="swal-forma-pagamento-faturamento" class="form-select">
          <option value="pix" selected>📱 PIX</option>
          <option value="cartao_credito">💳 Cartão de Crédito</option>
          <option value="cartao_debito">💳 Cartão de Débito</option>
          <option value="dinheiro">💵 Dinheiro</option>
        </select>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Confirmar Pagamento',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#0e3a2f',
    preConfirm: () => document.getElementById('swal-forma-pagamento-faturamento').value
  })

  if (!isConfirmed) return

  try {
    await ApiService.updateMensalidade(id, { status: 'paga', formaPagamento })
    toastSucesso('Cobrança marcada como paga.')
    await carregarFaturamento()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao atualizar cobrança',
      text: error.message
    })
  }
}

// Cancela uma cobrança pendente (ex.: lançamento indevido)
async function cancelarCobranca (id) {
  const result = await Swal.fire({
    title: 'Cancelar cobrança?',
    text: 'A cobrança será marcada como cancelada e deixará de contar como pendente.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3d0c13',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Sim, cancelar',
    cancelButtonText: 'Voltar'
  })

  if (!result.isConfirmed) return

  try {
    await ApiService.updateMensalidade(id, { status: 'cancelada' })
    toastSucesso('Cobrança cancelada.')
    await carregarFaturamento()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao cancelar cobrança',
      text: error.message
    })
  }
}
