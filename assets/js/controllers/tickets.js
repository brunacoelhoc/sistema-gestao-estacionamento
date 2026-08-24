/**
 * Lógica da Página de Tickets
 * Controle de emissão, listagem, busca, paginação, regras de mensalista e baixa de tickets.
 */

// allVagas/allMensalistas/allTarifas continuam carregadas por inteiro (são
// listas pequenas, usadas pelos combos do formulário e pelas regras de
// negócio client-side). Tickets é a única lista grande da tela — em vez de
// um array completo, guardamos só a página atual + o total, pedidos ao
// backend a cada busca/filtro/troca de página (ver carregarTickets).
let allVagas = []
let allMensalistas = []
let allTarifas = []

let ticketsPaginaAtual = []
let totalTicketsFiltrados = 0
let paginaAtual = 1
let TICKETS_POR_PAGINA = 10
let debounceBuscaTicket = null

// Regras de cobrança usadas só pra prévia de valor mostrada antes de
// confirmar o fechamento — buscadas uma vez de GET /config (fonte única:
// AppController.config no backend). Os valores abaixo são só o fallback
// usado até a resposta chegar (ou se a busca falhar).
let configRegrasCobranca = { toleranciaMinutos: 15, duracaoCicloMensalistaDias: 30, adicionalVagaCobertaValor: 3 }

// O id do ticket é um cuid longo (ex.: "cm3k9x0p10000abcd1234efgh") — bom
// para o banco, ilegível na tabela. Exibe só os 8 primeiros caracteres; o
// UUID completo continua intacto no banco e em toda chamada à API (data-id,
// fechamento de ticket etc.), só a exibição é truncada.
function formatarIdExibicao (id) {
  return (id || '').slice(0, 8)
}

document.addEventListener('DOMContentLoaded', async () => {
  initInputMasks()
  await carregarDados()

  // Busca por placa/vaga (reseta para a primeira página a cada nova busca).
  // Debounced porque agora cada tecla digitada pede uma página nova ao
  // backend, em vez de só filtrar um array já carregado.
  document
    .getElementById('input-busca-ticket')
    ?.addEventListener('input', () => {
      paginaAtual = 1
      clearTimeout(debounceBuscaTicket)
      debounceBuscaTicket = setTimeout(() => carregarTickets(), 300)
    })

  // Filtro de status do ticket (Todos, Aberto, Fechado)
  document
    .getElementById('filtro-status-ticket')
    ?.addEventListener('change', () => {
      paginaAtual = 1
      carregarTickets()
    })

  // Verificação de mensalista ao digitar a placa no modal de novo ticket
  const inputPlaca = document.getElementById('ticket-placa')
  inputPlaca?.addEventListener('input', e => {
    verificarMensalistaNaDigitacao(e.target.value)
  })

  // Caminho inverso: escolher um mensalista no combo já preenche a placa
  // (só um atalho — o campo continua editável, pro caso do mensalista
  // aparecer com um veículo diferente do cadastrado).
  document
    .getElementById('ticket-mensalista')
    ?.addEventListener('change', e => {
      const mensalistaId = e.target.value
      if (!mensalistaId || !inputPlaca) return

      const mensalista = allMensalistas.find(
        m => String(m.id) === String(mensalistaId)
      )
      const placaMensalista = mensalista?.placa || mensalista?.placaVeiculo || ''
      if (placaMensalista) {
        inputPlaca.value = placaMensalista
        verificarMensalistaNaDigitacao(placaMensalista)
      }
    })

  document
    .getElementById('form-novo-ticket')
    ?.addEventListener('submit', criarNovoTicket)

  // Botão "Tentar novamente" do banner de erro global da página
  document.getElementById('btn-retry-page')?.addEventListener('click', () => {
    carregarDados()
  })

  // Exportação (CSV/Excel) respeitando a busca/filtro de status atuais
  document
    .getElementById('btn-exportar-tickets-csv')
    ?.addEventListener('click', () => exportarTickets('csv'))
  document
    .getElementById('btn-exportar-tickets-excel')
    ?.addEventListener('click', () => exportarTickets('excel'))

  // Paginação — cada troca de página/tamanho agora busca a página no
  // backend (ver carregarTickets), em vez de só re-renderizar um array local.
  document
    .getElementById('btn-pagina-anterior')
    ?.addEventListener('click', () => {
      if (paginaAtual > 1) {
        paginaAtual--
        carregarTickets()
      }
    })

  document
    .getElementById('btn-pagina-proxima')
    ?.addEventListener('click', () => {
      const totalPaginas = Math.max(
        1,
        Math.ceil(totalTicketsFiltrados / TICKETS_POR_PAGINA)
      )
      if (paginaAtual < totalPaginas) {
        paginaAtual++
        carregarTickets()
      }
    })

  document
    .getElementById('select-tamanho-pagina-tickets')
    ?.addEventListener('change', e => {
      TICKETS_POR_PAGINA = Number(e.target.value) || 10
      paginaAtual = 1
      carregarTickets()
    })
})

// Máscara do input da placa — compartilhada com Mensalistas, ver
// assets/js/modules/validacao.js.
function initInputMasks () {
  ligarMascaraPlaca('ticket-placa')
}

// Carrega os dados de apoio do formulário (vagas, tarifas, mensalistas) e,
// em seguida, a primeira página de tickets.
async function carregarDados () {
  const pageError = document.getElementById('page-error')
  const pageErrorText = document.getElementById('page-error-text')

  pageError?.classList.add('d-none')

  try {
    const [vagas, mensalistas, tarifas, config] = await Promise.all([
      ApiService.getVagas ? ApiService.getVagas() : Promise.resolve([]),
      ApiService.getMensalistas
        ? ApiService.getMensalistas()
        : Promise.resolve([]),
      ApiService.getTarifas ? ApiService.getTarifas() : Promise.resolve([]),
      ApiService.getConfig().catch(() => null)
    ])

    allVagas = vagas || []
    allMensalistas = mensalistas || []
    allTarifas = tarifas || []
    if (config) configRegrasCobranca = config

    preencherSelectVagas()
    preencherSelectTarifas()
    preencherSelectMensalistas()
    atualizarAvisoFormulario()

    paginaAtual = 1
    await carregarTickets()
  } catch (error) {
    console.error('Erro ao carregar dados dos tickets:', error)

    // Sessão expirada (401) já é tratada por AuthService.tratarSessaoExpirada
    // — logout + redirect pro login já disparados a essa altura.
    if (typeof AuthService !== 'undefined' && !AuthService.estaLogado()) {
      return
    }

    if (pageError && pageErrorText) {
      pageErrorText.textContent =
        'Não foi possível carregar as informações dos tickets. Verifique sua conexão.'
      pageError.classList.remove('d-none')
    }

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Erro de Conexão',
        text: 'Não foi possível carregar as informações dos tickets.'
      })
    }
  }
}

// Busca no backend a página atual de tickets, já considerando a busca e o
// filtro de status ativos na tela (ver TicketsController.listar em
// src/tickets/tickets.controller.ts).
async function carregarTickets () {
  const pageError = document.getElementById('page-error')
  const pageErrorText = document.getElementById('page-error-text')
  const tbody = document.getElementById('tbody-tickets')

  tbody?.setAttribute('aria-busy', 'true')

  const termo = (document.getElementById('input-busca-ticket')?.value || '').trim()
  const statusFiltro = document.getElementById('filtro-status-ticket')?.value || 'TODOS'

  try {
    const resposta = await ApiService.getTickets({
      page: paginaAtual,
      pageSize: TICKETS_POR_PAGINA,
      status: statusFiltro,
      termo
    })

    ticketsPaginaAtual = resposta?.dados || []
    totalTicketsFiltrados = resposta?.total || 0
    paginaAtual = Math.min(paginaAtual, resposta?.totalPaginas || 1)

    pageError?.classList.add('d-none')
    renderizarPagina()
  } catch (error) {
    console.error('Erro ao carregar tickets:', error)

    if (typeof AuthService !== 'undefined' && !AuthService.estaLogado()) {
      return
    }

    if (pageError && pageErrorText) {
      pageErrorText.textContent =
        'Não foi possível carregar as informações dos tickets. Verifique sua conexão.'
      pageError.classList.remove('d-none')
    }

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Erro de Conexão',
        text: 'Não foi possível carregar as informações dos tickets.'
      })
    }
  } finally {
    tbody?.setAttribute('aria-busy', 'false')
  }
}

// Renderiza a página de tickets já trazida do backend
function renderizarPagina () {
  const tbody = document.getElementById('tbody-tickets')
  const infoEl = document.getElementById('paginacao-info')
  const labelEl = document.getElementById('pagina-atual-label')
  const btnAnterior = document
    .getElementById('btn-pagina-anterior')
    ?.closest('.page-item')
  const btnProxima = document
    .getElementById('btn-pagina-proxima')
    ?.closest('.page-item')

  if (!tbody) return
  tbody.innerHTML = ''

  const total = totalTicketsFiltrados

  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4 text-muted">
          <i class="fas fa-search me-2" aria-hidden="true"></i>Nenhum ticket encontrado.
        </td>
      </tr>
    `
    if (infoEl) infoEl.textContent = 'Mostrando 0 de 0 tickets'
    if (labelEl) labelEl.textContent = '1'
    btnAnterior?.classList.add('disabled')
    btnProxima?.classList.add('disabled')
    return
  }

  const totalPaginas = Math.max(1, Math.ceil(total / TICKETS_POR_PAGINA))
  const inicio = (paginaAtual - 1) * TICKETS_POR_PAGINA
  const fim = Math.min(inicio + TICKETS_POR_PAGINA, total)

  ticketsPaginaAtual.forEach(ticket => renderizarLinhaTicket(ticket, tbody))

  if (infoEl) { infoEl.textContent = `Mostrando ${inicio + 1}–${fim} de ${total} tickets` }
  if (labelEl) labelEl.textContent = `Página ${paginaAtual} de ${totalPaginas}`
  btnAnterior?.classList.toggle('disabled', paginaAtual === 1)
  btnProxima?.classList.toggle('disabled', paginaAtual === totalPaginas)

  // Adiciona o ouvinte para botões de fechamento de ticket
  tbody.querySelectorAll('.btn-fechar-ticket').forEach(btn => {
    btn.addEventListener('click', async e => {
      const ticketId = e.currentTarget.getAttribute('data-id')
      await finalizarTicket(ticketId)
    })
  })
}

// Helper para formatar rótulo da forma de pagamento
function getFormaPagamentoBadge (forma) {
  switch ((forma || '').toLowerCase()) {
    case 'pix':
      return '<span class="badge bg-success text-white"><i class="fas fa-pix me-1"></i>PIX</span>'
    case 'cartao_credito':
      return '<span class="badge bg-primary text-white"><i class="fas fa-credit-card me-1"></i>Crédito</span>'
    case 'cartao_debito':
      return '<span class="badge bg-info text-dark"><i class="fas fa-credit-card me-1"></i>Débito</span>'
    case 'dinheiro':
      return '<span class="badge bg-warning text-dark"><i class="fas fa-money-bill-wave me-1"></i>Dinheiro</span>'
    case 'isento':
      return '<span class="badge bg-secondary text-white"><i class="fas fa-star me-1"></i>Isento</span>'
    default:
      return '<span class="text-muted">-</span>'
  }
}

// Renderiza uma linha individual da tabela de tickets
function renderizarLinhaTicket (ticket, tbody) {
  const vaga = allVagas.find(v => String(v.id) === String(ticket.vagaId))
  const numeroVaga = vaga
    ? vaga.codigo || vaga.numero || vaga.id
    : ticket.vagaId
  const codVaga = vaga
    ? `${numeroVaga} (${vaga.tipo || 'comum'})`
    : ticket.vagaId

  const mensalista = ticket.mensalistaId
    ? allMensalistas.find(m => String(m.id) === String(ticket.mensalistaId))
    : null
  const nomeMensalista = mensalista
    ? mensalista.nome || mensalista.nomeCliente
    : 'Avulso'

  const dataEntradaStr =
    ticket.horaEntrada || ticket.dataEntrada
      ? new Date(ticket.horaEntrada || ticket.dataEntrada).toLocaleString(
        'pt-BR'
      )
      : '-'
  const dataSaidaStr =
    ticket.horaSaida || ticket.dataSaida
      ? new Date(ticket.horaSaida || ticket.dataSaida).toLocaleString('pt-BR')
      : '-'

  const valorFinal = ticket.valorCobrado ?? ticket.valorTotal
  const valorStr =
    valorFinal !== null && valorFinal !== undefined
      ? `R$ ${Number(valorFinal).toFixed(2).replace('.', ',')}`
      : '-'

  const statusKey = (ticket.status || 'aberto').toLowerCase()
  const statusBadge =
    statusKey === 'aberto'
      ? '<span class="badge-status status-aberto"><i class="fas fa-clock me-1" aria-hidden="true"></i>Aberto</span>'
      : '<span class="badge-status status-fechado"><i class="fas fa-check-circle me-1" aria-hidden="true"></i>Fechado</span>'

  const pagamentoBadge =
    statusKey === 'fechado'
      ? getFormaPagamentoBadge(
        ticket.formaPagamento || (ticket.mensalistaId ? 'isento' : '')
      )
      : ''

  const btnAcao =
    statusKey === 'aberto'
      ? `<button type="button" class="btn btn-sm btn-outline-danger btn-fechar-ticket" data-id="${ticket.id}">
         <i class="fas fa-sign-out-alt me-1" aria-hidden="true"></i>Fechar Ticket
       </button>`
      : `<div class="d-flex flex-column gap-1">${pagamentoBadge}</div>`

  const tr = document.createElement('tr')
  tr.innerHTML = `
    <td class="fw-bold text-muted" title="${ApiService.sanitizeText(ticket.id)}">#${ApiService.sanitizeText(formatarIdExibicao(ticket.id))}</td>
    <td class="fw-bold">${ApiService.sanitizeText(ticket.placa)}</td>
    <td><span class="badge bg-light text-dark border">${ApiService.sanitizeText(
      codVaga
    )}</span></td>
    <td>${ApiService.sanitizeText(nomeMensalista)}</td>
    <td><small>${dataEntradaStr}</small></td>
    <td><small>${dataSaidaStr}</small></td>
    <td class="fw-bold text-primary">${valorStr}</td>
    <td>${statusBadge}</td>
    <td>${btnAcao}</td>
  `
  tbody.appendChild(tr)
}

// Monta as linhas "achatadas" (prontas para planilha) a partir de TODOS os
// tickets que batem com a busca/status ativos na tela — não só a página
// exibida na tabela —, e delega para o exportador genérico (CSV ou Excel).
async function exportarTickets (formato) {
  const termo = (document.getElementById('input-busca-ticket')?.value || '').trim()
  const statusFiltro = document.getElementById('filtro-status-ticket')?.value || 'TODOS'

  let ticketsParaExportar
  try {
    // Sem `page`, o backend devolve a lista completa já filtrada (ver
    // ApiService.getTickets e TicketsController.listar em
    // src/tickets/tickets.controller.ts).
    ticketsParaExportar = await ApiService.getTickets({ status: statusFiltro, termo })
  } catch (error) {
    console.error('Erro ao buscar tickets para exportação:', error)
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Erro ao exportar',
        text: 'Não foi possível buscar os tickets para exportação.'
      })
    }
    return
  }

  const colunas = [
    { chave: 'id', rotulo: 'ID' },
    { chave: 'placa', rotulo: 'Placa' },
    { chave: 'vaga', rotulo: 'Vaga' },
    { chave: 'mensalista', rotulo: 'Cliente' },
    { chave: 'entrada', rotulo: 'Entrada' },
    { chave: 'saida', rotulo: 'Saída' },
    { chave: 'valor', rotulo: 'Valor (R$)' },
    { chave: 'status', rotulo: 'Status' },
    { chave: 'formaPagamento', rotulo: 'Forma de Pagamento' }
  ]

  const linhas = (ticketsParaExportar || []).map(ticket => {
    const vaga = allVagas.find(v => String(v.id) === String(ticket.vagaId))
    const mensalista = ticket.mensalistaId
      ? allMensalistas.find(m => String(m.id) === String(ticket.mensalistaId))
      : null

    const dataEntradaVal = ticket.horaEntrada || ticket.dataEntrada
    const dataSaidaVal = ticket.horaSaida || ticket.dataSaida
    const valorFinal = ticket.valorCobrado ?? ticket.valorTotal
    const statusKey = (ticket.status || 'aberto').toLowerCase()

    return {
      id: ticket.id,
      placa: ticket.placa,
      vaga: vaga ? vaga.codigo || vaga.numero || vaga.id : ticket.vagaId,
      mensalista: mensalista
        ? mensalista.nome || mensalista.nomeCliente
        : 'Avulso',
      entrada: dataEntradaVal ? new Date(dataEntradaVal).toLocaleString('pt-BR') : '-',
      saida: dataSaidaVal ? new Date(dataSaidaVal).toLocaleString('pt-BR') : '-',
      valor: valorFinal !== null && valorFinal !== undefined
        ? Number(valorFinal).toFixed(2).replace('.', ',')
        : '-',
      status: statusKey === 'aberto' ? 'Aberto' : 'Fechado',
      formaPagamento:
        statusKey === 'fechado'
          ? ticket.formaPagamento || (ticket.mensalistaId ? 'Isento' : '-')
          : '-'
    }
  })

  if (formato === 'excel') {
    exportarParaExcel('tickets-parkgestao.xlsx', 'Tickets', colunas, linhas)
  } else {
    exportarParaCSV('tickets-parkgestao.csv', colunas, linhas)
  }
}

// Preenche o combo de Vagas (apenas status "livre")
function preencherSelectVagas () {
  const selectVaga = document.getElementById('ticket-vaga')
  if (!selectVaga) return

  selectVaga.innerHTML =
    '<option value="" selected disabled>Selecione uma vaga livre...</option>'

  const vagasLivres = allVagas
    .filter(v => (v.status || 'livre').toLowerCase() === 'livre')
    .sort((a, b) =>
      String(a.codigo || a.numero || a.id).localeCompare(
        String(b.codigo || b.numero || b.id),
        undefined,
        { numeric: true, sensitivity: 'base' }
      )
    )

  vagasLivres.forEach(vaga => {
    const option = document.createElement('option')
    option.value = vaga.id
    const num = vaga.codigo || vaga.numero || vaga.id
    option.textContent = `${num} - ${vaga.tipo || 'comum'}`
    selectVaga.appendChild(option)
  })
}

// Preenche o combo de Tarifas
function preencherSelectTarifas () {
  const selectTarifa = document.getElementById('ticket-tarifa')
  if (!selectTarifa) return

  selectTarifa.innerHTML =
    '<option value="" selected disabled>Selecione a tarifa...</option>'

  allTarifas.forEach(tarifa => {
    const option = document.createElement('option')
    option.value = tarifa.id
    const nomeTarifa = tarifa.categoria || tarifa.tipo || tarifa.nome || 'Geral'
    const valor = Number(tarifa.valorHora || tarifa.valor || 0)
      .toFixed(2)
      .replace('.', ',')
    option.textContent = `${nomeTarifa} (R$ ${valor}/h)`
    selectTarifa.appendChild(option)
  })
}

// Preenche o combo de Mensalistas Ativos
function preencherSelectMensalistas () {
  const selectMensalista = document.getElementById('ticket-mensalista')
  if (!selectMensalista) return

  selectMensalista.innerHTML =
    '<option value="">Veículo avulso (sem mensalista)</option>'

  if (!Array.isArray(allMensalistas)) return

  // "ativo" (boolean) é a única fonte da verdade para o status do mensalista.
  allMensalistas
    .filter(m => m.ativo === true)
    .forEach(mensalista => {
      const option = document.createElement('option')
      option.value = mensalista.id
      const nome = mensalista.nome || mensalista.nomeCliente || 'Mensalista'
      const placa = mensalista.placa || mensalista.placaVeiculo || 'Sem Placa'
      option.textContent = `${nome} (${placa})`
      selectMensalista.appendChild(option)
    })
}

// Validação visual de indisponibilidade de Vagas/Tarifas
function atualizarAvisoFormulario () {
  const avisoDiv = document.getElementById('ticket-form-aviso')
  const avisoTexto = document.getElementById('ticket-form-aviso-texto')
  const btnEmitir =
    document.getElementById('btn-emitir-ticket') ||
    document.getElementById('btn-registrar-entrada')

  const temVagaLivre = allVagas.some(
    v => (v.status || 'livre').toLowerCase() === 'livre'
  )
  const temTarifa = allTarifas.length > 0

  if (temVagaLivre && temTarifa) {
    avisoDiv?.classList.add('d-none')
    if (btnEmitir) {
      btnEmitir.disabled = false
      btnEmitir.removeAttribute('title')
    }
    return
  }

  const motivos = []
  if (!temVagaLivre) motivos.push('nenhuma vaga livre')
  if (!temTarifa) motivos.push('nenhuma tarifa cadastrada')

  const mensagem = `Não é possível abrir um novo ticket: ${motivos.join(
    ' e '
  )}. Cadastre em Vagas & Tarifas para continuar.`

  if (avisoDiv && avisoTexto) {
    avisoTexto.textContent = mensagem
    avisoDiv.classList.remove('d-none')
  }
  if (btnEmitir) {
    btnEmitir.disabled = true
    btnEmitir.title = mensagem
  }
}

// Identifica mensalista ativo dinamicamente durante a digitação
function verificarMensalistaNaDigitacao (placa) {
  const infoDiv = document.getElementById('mensalista-status-info')
  const selectMensalista = document.getElementById('ticket-mensalista')
  if (!infoDiv) return

  const placaClean = placa.trim().toUpperCase()

  if (placaClean.length < 7) {
    infoDiv.innerHTML = ''
    return
  }

  const mensalistaEncontrado = allMensalistas.find(m => {
    const ativo = m.ativo === true || String(m.ativo).toLowerCase() === 'true'
    const p = (m.placa || m.placaVeiculo || '').toUpperCase()
    return ativo && p === placaClean
  })

  if (mensalistaEncontrado) {
    const valorMensal = Number(mensalistaEncontrado.valorMensalidade || 0)
      .toFixed(2)
      .replace('.', ',')
    infoDiv.innerHTML = `<span class="text-success fw-semibold"><i class="fas fa-check-circle me-1" aria-hidden="true"></i> Mensalista Ativo: ${ApiService.sanitizeText(
      mensalistaEncontrado.nome || mensalistaEncontrado.nomeCliente
    )} (Mensalidade: R$ ${valorMensal})</span>`
    if (selectMensalista) selectMensalista.value = mensalistaEncontrado.id
  } else {
    infoDiv.innerHTML = '<span class="text-muted"><i class="fas fa-info-circle me-1" aria-hidden="true"></i> Veículo avulso (tarifado normalmente)</span>'
    if (selectMensalista) selectMensalista.value = ''
  }
}

// Criação de Novo Ticket (Abertura)
async function criarNovoTicket (e) {
  e.preventDefault()

  const placa = document
    .getElementById('ticket-placa')
    ?.value.trim()
    .toUpperCase()
  const vagaId = document.getElementById('ticket-vaga')?.value
  const tarifaId = document.getElementById('ticket-tarifa')?.value
  const mensalistaId =
    document.getElementById('ticket-mensalista')?.value || null

  if (!validarPlaca(placa)) {
    Swal.fire({
      icon: 'warning',
      title: 'Placa Inválida',
      text: 'Utilize o formato Mercosul (ABC1D23) ou antigo (ABC1234).'
    })
    return
  }

  // Regra "sem ticket duplo para a mesma placa" agora é validada no backend
  // (dentro da transação de abertura — ver TicketsService.abrir em
  // src/tickets/tickets.service.ts), já que a tela não mantém mais a lista
  // completa de tickets em memória para checar aqui. O erro, se acontecer,
  // chega pelo catch abaixo.

  if (!vagaId || !tarifaId) {
    Swal.fire({
      icon: 'warning',
      title: 'Campos Obrigatórios',
      text: 'Por favor, selecione uma vaga e uma tarifa.'
    })
    return
  }

  const btnSubmit =
    document.getElementById('btn-registrar-entrada') ||
    document.getElementById('btn-emitir-ticket')
  if (btnSubmit) btnSubmit.disabled = true

  try {
    const novoTicket = {
      placa,
      vagaId,
      tarifaId,
      mensalistaId: mensalistaId || null,
      horaEntrada: new Date().toISOString(),
      dataEntrada: new Date().toISOString(),
      horaSaida: null,
      dataSaida: null,
      valorCobrado: null,
      valorTotal: null,
      formaPagamento: null,
      status: 'aberto'
    }

    // ApiService.criarTicket já muda o status da vaga para "ocupada" internamente.
    if (ApiService.criarTicket) {
      await ApiService.criarTicket(novoTicket)
    } else {
      await ApiService.createTicket(novoTicket)
    }

    toastSucesso(`Ticket emitido! Entrada da placa ${placa} registrada.`)

    const form = document.getElementById('form-novo-ticket')
    form?.reset()
    const infoDiv = document.getElementById('mensalista-status-info')
    if (infoDiv) infoDiv.innerHTML = ''

    // Fecha o modal via Bootstrap se presente
    const modalEl =
      document.getElementById('modalNovoTicket') ||
      document.getElementById('modal-ticket')
    if (modalEl && typeof bootstrap !== 'undefined') {
      const modalInstance = bootstrap.Modal.getInstance(modalEl)
      modalInstance?.hide()
    }

    await carregarDados()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao emitir ticket',
      text: error.message || 'Falha na comunicação com o servidor.'
    })
  } finally {
    if (btnSubmit) btnSubmit.disabled = false
  }
}

// Fechamento de Ticket com cálculo preciso e seleção de meio de pagamento
async function finalizarTicket (ticketId) {
  // O ticket sendo fechado sempre está na página atualmente renderizada —
  // o botão "Fechar Ticket" só existe para linhas da página exibida.
  const ticket = ticketsPaginaAtual.find(t => String(t.id) === String(ticketId))
  if (!ticket) {
    Swal.fire({ icon: 'error', title: 'Erro', text: 'Ticket não encontrado.' })
    return
  }

  const tarifa = allTarifas.find(t => String(t.id) === String(ticket.tarifaId))
  const horaEntrada = new Date(
    ticket.horaEntrada || ticket.dataEntrada || Date.now()
  )
  const horaSaida = new Date()

  // Cálculo de permanência em minutos e horas
  const diffMs = horaSaida - horaEntrada
  const diffMinutos = Math.max(1, Math.floor(diffMs / (1000 * 60)))
  const horasFormatadas = Math.floor(diffMinutos / 60)
  const minutosRestantes = diffMinutos % 60
  const tempoTexto = `${
    horasFormatadas > 0 ? `${horasFormatadas}h ` : ''
  }${minutosRestantes}min`

  const mensalista = ticket.mensalistaId
    ? allMensalistas.find(m => String(m.id) === String(ticket.mensalistaId))
    : null

  let valorCalculado = 0
  const ehMensalista = Boolean(ticket.mensalistaId)
  let previsaoCiclo = null

  if (ehMensalista) {
    // Prévia client-side do ciclo — espelha a regra real do backend (ver
    // assets/js/modules/mensalista-ciclo.js) pra este valor nunca divergir
    // do que vai ser efetivamente cobrado ao confirmar.
    const mensalidadesDoMensalista = await ApiService.getMensalidades(ticket.mensalistaId)
    previsaoCiclo = preverCicloMensalista(
      mensalidadesDoMensalista,
      ticket.dataEntrada || ticket.horaEntrada,
      mensalista?.valorMensalidade,
      configRegrasCobranca.duracaoCicloMensalistaDias
    )
    valorCalculado = previsaoCiclo.valor
  } else {
    const valorHoraBase = tarifa ? Number(tarifa.valorHora || tarifa.valor || 0) : 0

    // Vaga coberta custa mais que uma comum — mesmo acréscimo aplicado de
    // fato no fechamento (ver CobrancaService.calcularTarifaAvulsa), só pra
    // essa prévia nunca divergir do valor cobrado ao confirmar.
    const vaga = allVagas.find(v => String(v.id) === String(ticket.vagaId))
    const valorHora = vaga?.tipo === 'coberta'
      ? valorHoraBase + configRegrasCobranca.adicionalVagaCobertaValor
      : valorHoraBase

    // Regra: Isenção por Tolerância (ex: até 15 minutos não paga)
    if (diffMinutos <= configRegrasCobranca.toleranciaMinutos) {
      valorCalculado = 0
    } else {
      const diffHoras = diffMs / (1000 * 60 * 60)
      const horasPagas = Math.max(1, Math.ceil(diffHoras)) // Fração de hora arredonda para cima
      valorCalculado = horasPagas * valorHora
    }
  }

  // Prepara modal com seleção de meio de pagamento
  const avisoMensalista = previsaoCiclo?.cobraAgora
    ? `<div class="alert alert-warning py-2 mb-3">
        <strong>Novo ciclo de 30 dias:</strong> este mensalista não tem um ciclo vigente —
        esta cobrança abre um novo período, liberado até
        <strong>${formatarDataCicloMensalista(previsaoCiclo.dataFim)}</strong>.
      </div>`
    : `<div class="alert alert-info py-2 mb-3">
        <strong>Mensalista liberado:</strong> ciclo já pago, válido até
        <strong>${formatarDataCicloMensalista(previsaoCiclo?.dataFim)}</strong> — este ticket sai isento.
      </div>`

  const selectPagamentoHTML = ehMensalista
    ? `${avisoMensalista}${
        previsaoCiclo?.cobraAgora
          ? `<div class="mb-3 text-start">
              <label for="swal-forma-pagamento" class="form-label fw-semibold">Forma de Pagamento:</label>
              <select id="swal-forma-pagamento" class="form-select">
                <option value="pix" selected>📱 PIX</option>
                <option value="cartao_credito">💳 Cartão de Crédito</option>
                <option value="cartao_debito">💳 Cartão de Débito</option>
                <option value="dinheiro">💵 Dinheiro</option>
              </select>
            </div>`
          : ''
      }`
    : `
      <div class="mb-3 text-start">
        <label for="swal-forma-pagamento" class="form-label fw-semibold">Forma de Pagamento:</label>
        <select id="swal-forma-pagamento" class="form-select">
          <option value="pix" selected>📱 PIX</option>
          <option value="cartao_credito">💳 Cartão de Crédito</option>
          <option value="cartao_debito">💳 Cartão de Débito</option>
          <option value="dinheiro">💵 Dinheiro</option>
        </select>
      </div>
    `

  const { isConfirmed, value: formaPagamento } = await Swal.fire({
    title: 'Fechar e Cobrar Ticket',
    html: `
      <div class="text-center mb-3">
        <p class="mb-1 text-muted">Placa: <strong class="text-dark">${ApiService.sanitizeText(
          ticket.placa
        )}</strong></p>
        <p class="mb-1 text-muted">Permanência: <strong class="text-dark">${tempoTexto}</strong></p>
        <div class="my-2">
          <span class="fs-2 fw-bold text-success">R$ ${valorCalculado
            .toFixed(2)
            .replace('.', ',')}</span>
        </div>
      </div>
      ${selectPagamentoHTML}
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#0e3a2f',
    confirmButtonText: '<i class="fas fa-check me-1"></i> Confirmar Saída',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      if (ehMensalista && !previsaoCiclo?.cobraAgora) return 'isento'
      const select = document.getElementById('swal-forma-pagamento')
      return select ? select.value : 'pix'
    }
  })

  if (!isConfirmed) return

  const botao = document.querySelector(
    `.btn-fechar-ticket[data-id="${ticketId}"]`
  )
  if (botao) botao.disabled = true

  try {
    // ApiService.fecharTicket é o único ponto que calcula e persiste o valor
    // cobrado, garantindo que ele nunca divirja do valor mostrado acima.
    const resultado = await ApiService.fecharTicket(ticketId, { formaPagamento })

    const vaga = allVagas.find(v => String(v.id) === String(ticket.vagaId))

    const ciclo = resultado?.mensalistaCiclo
    const htmlMensalista = ciclo
      ? `<p class="mt-2 mb-0 text-muted">${
          ciclo.cobradoAgora
            ? `<strong>Mensalista:</strong> novo ciclo cobrado agora. Liberado até <strong>${formatarDataCicloMensalista(ciclo.dataFim)}</strong>.`
            : `<strong>Mensalista:</strong> valor já cobrado e pago pelo cliente. Liberado até <strong>${formatarDataCicloMensalista(ciclo.dataFim)}</strong>.`
        }</p>`
      : ''

    // Enviar por e-mail só faz sentido para mensalista com e-mail cadastrado
    // (vinculado à placa) — avulso não tem onde receber, recebe só o PDF
    // impresso/baixado na hora.
    const podeEnviarPorEmail = ehMensalista && Boolean(mensalista?.email)

    const { isDenied, dismiss } = await Swal.fire({
      icon: 'success',
      title: 'Ticket Encerrado!',
      html: `<p class="mb-0">Saída do veículo ${ApiService.sanitizeText(ticket.placa)} registrada com sucesso.</p>${htmlMensalista}`,
      confirmButtonColor: '#0e3a2f',
      confirmButtonText: 'OK',
      showDenyButton: true,
      denyButtonText: '<i class="fas fa-file-pdf me-1"></i>Comprovante',
      denyButtonColor: '#0d6efd',
      showCancelButton: podeEnviarPorEmail,
      cancelButtonText: '<i class="fas fa-envelope me-1"></i>Enviar por E-mail',
      cancelButtonColor: '#6c757d'
    })

    if (isDenied && typeof gerarComprovanteTicketPDF === 'function') {
      gerarComprovanteTicketPDF({
        ticketId: ticket.id,
        placa: ticket.placa,
        vagaCodigo: vaga?.codigo || vaga?.numero || ticket.vagaId,
        horaEntrada,
        horaSaida,
        tempoTexto,
        formaPagamento,
        valor: valorCalculado,
        cicloVigente: ciclo ? { dataInicio: ciclo.dataInicio, dataFim: ciclo.dataFim } : null
      })
    }

    if (podeEnviarPorEmail && dismiss === Swal.DismissReason.cancel) {
      Swal.fire({ title: 'Enviando comprovante...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
      try {
        await ApiService.enviarComprovanteTicketEmail(ticket.id)
        Swal.fire({
          icon: 'success',
          title: 'Comprovante enviado!',
          text: `Enviado para ${mensalista.email}.`
        })
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Erro ao enviar comprovante',
          text: error.message || 'Falha ao enviar o comprovante por e-mail.'
        })
      }
    }

    await carregarDados()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao fechar ticket',
      text: error.message || 'Falha ao processar encerramento.'
    })
    if (botao) botao.disabled = false
  }
}
