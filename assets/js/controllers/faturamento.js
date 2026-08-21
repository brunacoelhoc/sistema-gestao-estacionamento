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

  document
    .getElementById('filtro-categoria-faturamento')
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

  // === MODAL DE DETALHES AO CLICAR NOS CARDS DE KPI (mesmo padrão do Dashboard) ===
  document.querySelectorAll('.card-kpi[data-kpi]').forEach(card => {
    card.addEventListener('click', () => abrirDetalhesKpiFaturamento(card.dataset.kpi))
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        abrirDetalhesKpiFaturamento(card.dataset.kpi)
      }
    })
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
    popularFiltroCategoria()
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

// Preenche o select de categoria de plano com as categorias presentes na
// lista carregada (via mv.mensalista.categoriaPlano), em ordem alfabética.
function popularFiltroCategoria () {
  const select = document.getElementById('filtro-categoria-faturamento')
  if (!select) return

  const valorAtual = select.value
  const categorias = [...new Set(
    mensalidadesCache.map(mv => mv.mensalista?.categoriaPlano).filter(Boolean)
  )].sort()

  select.innerHTML = '<option value="TODOS">Todas as categorias</option>' +
    categorias
      .map(cat => `<option value="${ApiService.sanitizeText(cat)}">${ApiService.sanitizeText(cat)}</option>`)
      .join('')

  if (categorias.includes(valorAtual)) select.value = valorAtual
}

// Aplica busca por nome/placa + filtros de status, referência, categoria de
// plano e período customizado (De/Até, sobre a data de início do ciclo).
function aplicarFiltrosFaturamento () {
  const termo = (document.getElementById('input-busca-faturamento')?.value || '')
    .toLowerCase()
    .trim()
  const statusFiltro =
    document.getElementById('filtro-status-faturamento')?.value || 'TODOS'
  const referenciaFiltro =
    document.getElementById('filtro-referencia-faturamento')?.value || 'TODOS'
  const categoriaFiltro =
    document.getElementById('filtro-categoria-faturamento')?.value || 'TODOS'
  const periodoDe = document.getElementById('filtro-periodo-de-faturamento')?.value || ''
  const periodoAte = document.getElementById('filtro-periodo-ate-faturamento')?.value || ''

  let filtradas = mensalidadesCache

  if (statusFiltro !== 'TODOS') {
    filtradas = filtradas.filter(mv => mv.status === statusFiltro)
  }

  if (referenciaFiltro !== 'TODOS') {
    filtradas = filtradas.filter(mv => mv.referencia === referenciaFiltro)
  }

  if (categoriaFiltro !== 'TODOS') {
    filtradas = filtradas.filter(mv => mv.mensalista?.categoriaPlano === categoriaFiltro)
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
  const tbodyDetalhes = document.getElementById('tbody-detalhes-forma-pagamento')
  if (!container) return

  const pagas = lista.filter(mv => mv.status === 'paga')
  const totais = {}
  const quantidades = {}
  pagas.forEach(mv => {
    const forma = mv.formaPagamento || 'outro'
    totais[forma] = (totais[forma] || 0) + Number(mv.valor || 0)
    quantidades[forma] = (quantidades[forma] || 0) + 1
  })

  const chaves = Object.keys(totais).sort((a, b) => totais[b] - totais[a])

  if (chaves.length === 0) {
    container.innerHTML = '<span class="text-muted text-sm">Nenhuma cobrança paga no filtro atual.</span>'
  } else {
    container.innerHTML = chaves
      .map(forma => `
        <div>
          <div class="text-muted text-xs">${ROTULO_FORMA_PAGAMENTO[forma] || forma}</div>
          <div class="h5 mb-0 fw-bold">R$ ${totais[forma].toFixed(2).replace('.', ',')}</div>
        </div>
      `)
      .join('')
  }

  if (tbodyDetalhes) {
    const totalGeral = Object.values(totais).reduce((soma, v) => soma + v, 0)
    tbodyDetalhes.innerHTML = chaves.length === 0
      ? '<tr><td colspan="4" class="text-muted text-center">Nenhum dado no filtro atual.</td></tr>'
      : chaves.map(forma => {
        const percentual = totalGeral > 0 ? ((totais[forma] / totalGeral) * 100).toFixed(1) : '0.0'
        return `
          <tr>
            <td>${ROTULO_FORMA_PAGAMENTO[forma] || forma}</td>
            <td>${quantidades[forma]}</td>
            <td>R$ ${totais[forma].toFixed(2).replace('.', ',')}</td>
            <td>${percentual}%</td>
          </tr>
        `
      }).join('')
  }
}

// Impacto financeiro dos cancelamentos (churn) na lista já filtrada.
function atualizarResumoChurn (lista) {
  const canceladas = lista.filter(mv => mv.status === 'cancelada')
  const valorPerdido = canceladas.reduce((soma, mv) => soma + Number(mv.valor || 0), 0)

  const elQtd = document.getElementById('churn-quantidade')
  const elValor = document.getElementById('churn-valor')
  if (elQtd) elQtd.textContent = String(canceladas.length)
  if (elValor) elValor.textContent = `R$ ${valorPerdido.toFixed(2).replace('.', ',')}`

  const tbodyDetalhes = document.getElementById('tbody-detalhes-churn')
  if (!tbodyDetalhes) return

  tbodyDetalhes.innerHTML = canceladas.length === 0
    ? '<tr><td colspan="4" class="text-muted text-center">Nenhum cancelamento no filtro atual.</td></tr>'
    : canceladas.map(mv => `
      <tr>
        <td>
          <div class="fw-semibold">${ApiService.sanitizeText(mv.mensalista?.nome || '-')}</div>
          <div class="text-muted text-xs">${ApiService.sanitizeText(mv.mensalista?.placa || '-')}</div>
        </td>
        <td>${formatarReferenciaFaturamento(mv.referencia)}</td>
        <td>R$ ${Number(mv.valor || 0).toFixed(2).replace('.', ',')}</td>
        <td>${ApiService.sanitizeText(mv.motivoCancelamento || '-')}</td>
      </tr>
    `).join('')
}

// Estado com o detalhamento por trás de cada KPI, preenchido em
// atualizarKpisFaturamento() e consumido pelo modal de detalhes
// (abrirDetalhesKpiFaturamento) — garante que o modal sempre explique
// exatamente os mesmos números exibidos nos cartões.
let kpiFaturamentoDetalhes = {
  mrr: 0,
  recebidoNoMes: 0,
  recebidoNoMesQtd: 0,
  ticketMedio: 0,
  mensalistasAtivosQtd: 0,
  semCicloAtivo: 0,
  semCicloLista: [],
  referencia: ''
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
  // aparece, ver src/mensalidade-ciclo/mensalidade-ciclo.service.ts), mas
  // sinaliza quem está sem cobertura vigente agora.
  const semCicloLista = mensalistasAtivos.filter(m => {
    const ciclosDoMensalista = mensalidadesCache.filter(
      mv => mv.mensalistaId === m.id && mv.status === 'paga'
    )
    if (ciclosDoMensalista.length === 0) return true
    return !ciclosDoMensalista.some(mv => mv.dataFim && new Date(mv.dataFim) >= hoje)
  })
  const semCicloAtivo = semCicloLista.length

  const mensalidadesPagasNoMes = mensalidadesCache.filter(
    mv => mv.status === 'paga' && mv.referencia === ref
  )

  kpiFaturamentoDetalhes = {
    mrr,
    recebidoNoMes,
    recebidoNoMesQtd: mensalidadesPagasNoMes.length,
    ticketMedio,
    mensalistasAtivosQtd: mensalistasAtivos.length,
    semCicloAtivo,
    semCicloLista,
    referencia: ref
  }

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

/**
 * Abre um modal explicando de onde vem o número de um card de KPI da tela
 * de Faturamento (mesmo padrão usado no Dashboard e em Métricas), usando o
 * detalhamento calculado em atualizarKpisFaturamento (kpiFaturamentoDetalhes)
 * para que o texto sempre bata com o valor exibido no cartão.
 */
function abrirDetalhesKpiFaturamento (chave) {
  if (typeof Swal === 'undefined') return

  const d = kpiFaturamentoDetalhes
  const refFormatada = formatarReferenciaFaturamento(d.referencia)

  let title = ''
  let html = ''

  switch (chave) {
    case 'previsto-mrr':
      title = 'Faturamento Previsto (MRR)'
      html = `<p class="text-muted mb-2">Soma do valor do plano de todo mensalista ativo — é o que se espera arrecadar por ciclo se todos passarem pela cancela, não uma cobrança já lançada.</p>
        <p class="fs-5 mb-0"><strong>${d.mensalistasAtivosQtd}</strong> mensalista(s) ativo(s) somam <strong>R$ ${d.mrr.toFixed(2).replace('.', ',')}</strong> em planos.</p>`
      break
    case 'recebido-mes':
      title = 'Recebido no Mês Atual'
      html = `<p class="text-muted mb-2">Soma das cobranças com status "Paga" cujo mês de referência é o mês corrente (${refFormatada}). Cobranças pagas em outros meses de referência não entram aqui.</p>
        <p class="fs-5 mb-0"><strong>${d.recebidoNoMesQtd}</strong> cobrança(s) paga(s) somam <strong>R$ ${d.recebidoNoMes.toFixed(2).replace('.', ',')}</strong>.</p>`
      break
    case 'ticket-medio':
      title = 'Ticket Médio (mensalista ativo)'
      html = `<p class="text-muted mb-2">Faturamento previsto (MRR) dividido pela quantidade de mensalistas ativos.</p>
        <p class="fs-5 mb-0">R$ ${d.mrr.toFixed(2).replace('.', ',')} ÷ ${d.mensalistasAtivosQtd} mensalista(s) = <strong>R$ ${d.ticketMedio.toFixed(2).replace('.', ',')}</strong></p>`
      break
    case 'sem-ciclo': {
      const itens = d.semCicloLista
        .map(m => `<li>${ApiService.sanitizeText(m.nome || '-')} <span class="text-muted">(${ApiService.sanitizeText(m.placa || '-')})</span></li>`)
        .join('')
      title = 'Sem Ciclo Ativo'
      html = `<p class="text-muted mb-2">Mensalista ativo cujo último ciclo pago já venceu, ou que nunca teve um ciclo pago — não significa atraso, pois a cobrança só é gerada quando o veículo aparece na cancela, mas sinaliza quem está sem cobertura vigente agora.</p>
        <p class="mb-2"><strong>${d.semCicloAtivo}</strong> de <strong>${d.mensalistasAtivosQtd}</strong> mensalista(s) ativo(s):</p>
        <ul class="text-start">${itens || '<li class="text-muted">Nenhum mensalista nesta condição.</li>'}</ul>`
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

  const motivoTooltip = mv.status === 'cancelada' && mv.motivoCancelamento
    ? ` title="Motivo: ${ApiService.sanitizeText(mv.motivoCancelamento)}"`
    : ''
  const statusBadge = `<span class="badge-status ${CLASSE_STATUS_FATURAMENTO[mv.status] || ''}"${motivoTooltip}>${ROTULO_STATUS_FATURAMENTO[mv.status] || mv.status}${
    mv.status === 'cancelada' && mv.motivoCancelamento ? ' <i class="fas fa-circle-info" aria-hidden="true"></i>' : ''
  }</span>`

  // Auditoria: só existe quando um operador mexeu no status pela tela de
  // Faturamento (marcar como paga / cancelar) — nula na cobrança automática
  // gerada no fechamento de ticket, então não aparece nada nesse caso.
  const auditoria = mv.alteradoPor?.nome && mv.alteradoEm
    ? `<div class="text-muted text-xs mt-1">${
        mv.status === 'cancelada' ? 'Cancelado' : 'Baixado'
      } por ${ApiService.sanitizeText(mv.alteradoPor.nome)} em ${formatarDataFaturamento(mv.alteradoEm)}</div>`
    : ''

  const acoesPendente = mv.status === 'pendente'
    ? `<button type="button" class="btn btn-sm btn-outline-success me-1 btn-marcar-paga-faturamento" data-id="${mv.id}" aria-label="Marcar cobrança como paga">
         <i class="fas fa-check" aria-hidden="true"></i> Marcar como paga
       </button>
       <button type="button" class="btn btn-sm btn-outline-danger me-1 btn-cancelar-faturamento" data-id="${mv.id}" aria-label="Cancelar cobrança">
         <i class="fas fa-ban" aria-hidden="true"></i> Cancelar
       </button>`
    : ''

  // Ações rápidas disponíveis pra qualquer linha, independente do status:
  // reemitir o recibo em PDF, ver o comprovante anexado (se algum) e mandar
  // lembrete por e-mail (só habilitado se o mensalista tem e-mail cadastrado).
  const btnReemitir = `<button type="button" class="btn btn-sm btn-outline-secondary me-1 btn-reemitir-faturamento" data-id="${mv.id}" title="Reemitir recibo (PDF)" aria-label="Reemitir recibo desta cobrança em PDF">
       <i class="fas fa-file-invoice" aria-hidden="true"></i>
     </button>`

  const btnAnexo = mv.comprovanteAnexo
    ? `<button type="button" class="btn btn-sm btn-outline-info me-1 btn-ver-anexo-faturamento" data-id="${mv.id}" title="Ver comprovante anexado" aria-label="Ver comprovante anexado desta cobrança">
         <i class="fas fa-paperclip" aria-hidden="true"></i>
       </button>`
    : ''

  const btnLembrete = mv.mensalista?.email
    ? `<button type="button" class="btn btn-sm btn-outline-primary btn-lembrete-faturamento" data-id="${mv.id}" title="Enviar lembrete por e-mail" aria-label="Enviar lembrete de cobrança por e-mail">
         <i class="fas fa-envelope" aria-hidden="true"></i>
       </button>`
    : `<button type="button" class="btn btn-sm btn-outline-secondary disabled" title="Mensalista sem e-mail cadastrado" aria-label="Lembrete por e-mail indisponível — mensalista sem e-mail cadastrado">
         <i class="fas fa-envelope" aria-hidden="true"></i>
       </button>`

  const acoes = `${acoesPendente}${btnReemitir}${btnAnexo}${btnLembrete}`

  tr.innerHTML = `
    <td>
      <div class="fw-bold">${ApiService.sanitizeText(mv.mensalista?.nome || '-')}</div>
      <div class="text-muted text-xs">${ApiService.sanitizeText(mv.mensalista?.categoriaPlano || '-')}</div>
    </td>
    <td><span class="badge bg-dark text-white">${ApiService.sanitizeText(mv.mensalista?.placa || '-')}</span></td>
    <td>${formatarReferenciaFaturamento(mv.referencia)}</td>
    <td>${formatarDataFaturamento(mv.dataInicio)} a ${formatarDataFaturamento(mv.dataFim)}</td>
    <td>R$ ${Number(mv.valor || 0).toFixed(2).replace('.', ',')}</td>
    <td>${statusBadge}${auditoria}</td>
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
  tbody.querySelectorAll('.btn-reemitir-faturamento').forEach(btn => {
    btn.addEventListener('click', () => reemitirCobranca(btn.getAttribute('data-id')))
  })
  tbody.querySelectorAll('.btn-ver-anexo-faturamento').forEach(btn => {
    btn.addEventListener('click', () => verAnexoCobranca(btn.getAttribute('data-id')))
  })
  tbody.querySelectorAll('.btn-lembrete-faturamento').forEach(btn => {
    btn.addEventListener('click', () => enviarLembreteCobranca(btn.getAttribute('data-id')))
  })
}

function verAnexoCobranca (id) {
  const mv = mensalidadesCache.find(item => String(item.id) === String(id))
  if (!mv?.comprovanteAnexo) return
  abrirAnexoComprovante(mv.comprovanteAnexo)
}

async function enviarLembreteCobranca (id) {
  const mv = mensalidadesCache.find(item => String(item.id) === String(id))
  const btn = document.querySelector(`.btn-lembrete-faturamento[data-id="${id}"]`)
  if (btn) btn.disabled = true

  try {
    await ApiService.enviarLembreteMensalidade(id)
    toastSucesso(`Lembrete enviado para ${mv?.mensalista?.email || 'o e-mail cadastrado'}.`)
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao enviar lembrete',
      text: error.message
    })
  } finally {
    if (btn) btn.disabled = false
  }
}

// Reemite um "aviso de cobrança" em PDF pra uma cobrança específica — mesmo
// estilo compacto do comprovante de ticket (ver assets/js/modules/comprovante.js),
// só que pro ciclo de mensalidade em vez de um ticket avulso.
function reemitirCobranca (id) {
  const mv = mensalidadesCache.find(item => String(item.id) === String(id))
  if (!mv) return

  if (typeof window.jspdf === 'undefined') {
    Swal.fire({
      icon: 'error',
      title: 'Exportação indisponível',
      text: 'Não foi possível carregar a biblioteca de geração de PDF.'
    })
    return
  }

  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ unit: 'mm', format: [80, 160] })
  const centro = 40
  let y = 10

  const linha = (rotulo, valor) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(rotulo, 5, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(valor ?? '-'), 75, y, { align: 'right' })
    y += 5
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('ParkGestão', centro, y, { align: 'center' })
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Aviso de Cobrança', centro, y, { align: 'center' })
  y += 4
  doc.line(5, y, 75, y)
  y += 6

  linha('Mensalista:', mv.mensalista?.nome)
  linha('Placa:', mv.mensalista?.placa)
  linha('Categoria:', mv.mensalista?.categoriaPlano)
  linha('Referência:', formatarReferenciaFaturamento(mv.referencia))
  linha('Início do Período:', formatarDataFaturamento(mv.dataInicio))
  linha('Válido até:', formatarDataFaturamento(mv.dataFim))
  linha('Status:', ROTULO_STATUS_FATURAMENTO[mv.status] || mv.status)
  linha('Pagamento:', ROTULO_FORMA_PAGAMENTO_TEXTO[mv.formaPagamento] || '-')

  y += 2
  doc.line(5, y, 75, y)
  y += 7
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL', 5, y)
  doc.text(`R$ ${Number(mv.valor || 0).toFixed(2).replace('.', ',')}`, 75, y, { align: 'right' })

  y += 9
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('ParkGestão — Gestão de Estacionamento', centro, y, { align: 'center' })
  y += 4
  doc.text(new Date().toLocaleString('pt-BR'), centro, y, { align: 'center' })

  doc.save(`cobranca-${mv.mensalista?.placa || mv.id}-${mv.referencia}.pdf`)
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
    categoriaPlano: mv.mensalista?.categoriaPlano || '-',
    referencia: formatarReferenciaFaturamento(mv.referencia),
    periodo: `${formatarDataFaturamento(mv.dataInicio)} a ${formatarDataFaturamento(mv.dataFim)}`,
    valor: Number(mv.valor || 0).toFixed(2).replace('.', ','),
    status: ROTULO_STATUS_FATURAMENTO[mv.status] || mv.status,
    formaPagamento: ROTULO_FORMA_PAGAMENTO_TEXTO[mv.formaPagamento] || '-',
    motivoCancelamento: mv.status === 'cancelada' ? (mv.motivoCancelamento || '-') : '',
    operador: mv.alteradoPor?.nome || '-',
    auditoria: mv.alteradoPor?.nome && mv.alteradoEm
      ? `${mv.status === 'cancelada' ? 'Cancelado' : 'Baixado'} por ${mv.alteradoPor.nome} em ${formatarDataFaturamento(mv.alteradoEm)}`
      : '-'
  }))
}

const COLUNAS_EXPORTACAO_FATURAMENTO = [
  { chave: 'mensalista', rotulo: 'Mensalista' },
  { chave: 'placa', rotulo: 'Placa' },
  { chave: 'categoriaPlano', rotulo: 'Categoria do Plano' },
  { chave: 'referencia', rotulo: 'Referência' },
  { chave: 'periodo', rotulo: 'Período' },
  { chave: 'valor', rotulo: 'Valor (R$)' },
  { chave: 'status', rotulo: 'Status' },
  { chave: 'formaPagamento', rotulo: 'Forma de Pagamento' },
  { chave: 'motivoCancelamento', rotulo: 'Motivo do Cancelamento' },
  { chave: 'auditoria', rotulo: 'Auditoria (baixa/cancelamento manual)' }
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
    { chave: 'mensalista', rotulo: 'Mensalista', largura: 36 },
    { chave: 'placa', rotulo: 'Placa', largura: 20 },
    { chave: 'categoriaPlano', rotulo: 'Categoria', largura: 24 },
    { chave: 'referencia', rotulo: 'Ref.', largura: 15 },
    { chave: 'periodo', rotulo: 'Período', largura: 36 },
    { chave: 'valor', rotulo: 'Valor (R$)', largura: 22 },
    { chave: 'status', rotulo: 'Status', largura: 22 },
    { chave: 'formaPagamento', rotulo: 'Pagamento', largura: 28 },
    { chave: 'operador', rotulo: 'Operador', largura: 25 },
    { chave: 'motivoCancelamento', rotulo: 'Motivo Cancel.', largura: 46 }
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
  const { isConfirmed, value: resultado } = await Swal.fire({
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
      <div class="text-start">
        <label for="swal-comprovante-anexo" class="form-label fw-semibold">Anexar Comprovante (opcional)</label>
        <input type="file" class="form-control" id="swal-comprovante-anexo" accept="image/png,image/jpeg,image/webp,application/pdf">
        <div class="form-text">Imagem (PNG/JPEG/WEBP) ou PDF, até 4MB.</div>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Confirmar Pagamento',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#0e3a2f',
    preConfirm: async () => {
      const formaPagamento = document.getElementById('swal-forma-pagamento-faturamento').value
      const arquivo = document.getElementById('swal-comprovante-anexo').files[0]

      if (!arquivo) return { formaPagamento }

      try {
        const comprovanteAnexo = await lerComprovanteComoDataURI(arquivo)
        return { formaPagamento, comprovanteAnexo, comprovanteNomeArquivo: arquivo.name }
      } catch (error) {
        Swal.showValidationMessage(error.message)
        return false
      }
    }
  })

  if (!isConfirmed) return

  try {
    await ApiService.updateMensalidade(id, { status: 'paga', ...resultado })
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
  const { isConfirmed, value: motivoCancelamento } = await Swal.fire({
    title: 'Cancelar cobrança?',
    html: `
      <p class="text-muted">A cobrança será marcada como cancelada e deixará de contar como pendente.</p>
      <div class="text-start mb-2">
        <label for="swal-motivo-cancelamento" class="form-label fw-semibold">Motivo do Cancelamento <span class="text-danger">*</span></label>
        <textarea id="swal-motivo-cancelamento" class="form-control" rows="3"
          placeholder="Ex.: Cliente desistiu, cobrança em duplicidade, estorno..."></textarea>
      </div>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3d0c13',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Sim, cancelar',
    cancelButtonText: 'Voltar',
    preConfirm: () => {
      const motivo = document.getElementById('swal-motivo-cancelamento').value.trim()
      if (!motivo) {
        Swal.showValidationMessage('Informe o motivo do cancelamento.')
        return false
      }
      return motivo
    }
  })

  if (!isConfirmed) return

  try {
    await ApiService.updateMensalidade(id, { status: 'cancelada', motivoCancelamento })
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
