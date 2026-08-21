/**
 * Lógica da Página de Gestão de Faturamento
 * Visão global das cobranças mensais (Mensalidade) de todos os mensalistas,
 * com filtros, KPIs e ações de baixa (marcar como paga) e cancelamento.
 */

let mensalidadesCache = []

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

  document.getElementById('btn-retry-page')?.addEventListener('click', () => {
    carregarFaturamento()
  })
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
    mensalidadesCache = await ApiService.getMensalidades()
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

// Aplica busca por nome/placa + filtros de status e referência
function aplicarFiltrosFaturamento () {
  const termo = (document.getElementById('input-busca-faturamento')?.value || '')
    .toLowerCase()
    .trim()
  const statusFiltro =
    document.getElementById('filtro-status-faturamento')?.value || 'TODOS'
  const referenciaFiltro =
    document.getElementById('filtro-referencia-faturamento')?.value || 'TODOS'

  let filtradas = mensalidadesCache

  if (statusFiltro !== 'TODOS') {
    filtradas = filtradas.filter(mv => mv.status === statusFiltro)
  }

  if (referenciaFiltro !== 'TODOS') {
    filtradas = filtradas.filter(mv => mv.referencia === referenciaFiltro)
  }

  if (termo) {
    filtradas = filtradas.filter(
      mv =>
        (mv.mensalista?.nome || '').toLowerCase().includes(termo) ||
        (mv.mensalista?.placa || '').toLowerCase().includes(termo)
    )
  }

  renderizarTabelaFaturamento(filtradas)
}

// Cálculo dos 3 KPIs a partir da lista completa (não filtrada), para que os
// cartões sempre reflitam o panorama geral, independente da busca ativa.
function atualizarKpisFaturamento () {
  const ref = referenciaAtual()

  const totalPendente = mensalidadesCache
    .filter(mv => mv.status === 'pendente')
    .reduce((soma, mv) => soma + Number(mv.valor || 0), 0)

  const recebidoNoMes = mensalidadesCache
    .filter(mv => mv.status === 'paga' && mv.referencia === ref)
    .reduce((soma, mv) => soma + Number(mv.valor || 0), 0)

  const inadimplentes = new Set(
    mensalidadesCache
      .filter(mv => mv.status === 'pendente' && mv.referencia < ref)
      .map(mv => mv.mensalistaId)
  ).size

  const elPendente = document.getElementById('kpi-total-pendente')
  const elRecebido = document.getElementById('kpi-recebido-mes')
  const elInadimplentes = document.getElementById('kpi-inadimplentes')

  if (elPendente) elPendente.textContent = `R$ ${totalPendente.toFixed(2).replace('.', ',')}`
  if (elRecebido) elRecebido.textContent = `R$ ${recebidoNoMes.toFixed(2).replace('.', ',')}`
  if (elInadimplentes) elInadimplentes.textContent = String(inadimplentes)
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
