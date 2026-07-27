/**
 * Lógica da Página de Tickets
 * Controle de emissão, listagem, busca, paginação e baixa de tickets.
 */

let allTickets = []
let allVagas = []
let allMensalistas = []
let allTarifas = []

let ticketsFiltrados = []
let paginaAtual = 1
const TICKETS_POR_PAGINA = 10

document.addEventListener('DOMContentLoaded', async () => {
  await carregarDados()

  // Busca por placa (reseta para a primeira página a cada nova busca)
  document.getElementById('input-busca-ticket').addEventListener('input', e => {
    paginaAtual = 1
    filtrarTickets(e.target.value)
  })

  // Verificação de mensalista ao digitar a placa no modal de novo ticket
  const inputPlaca = document.getElementById('ticket-placa')
  inputPlaca.addEventListener('input', e => {
    verificarMensalistaNaDigitacao(e.target.value)
  })

  document
    .getElementById('form-novo-ticket')
    .addEventListener('submit', criarNovoTicket)

  // Botão "Tentar novamente" do banner de erro global da página
  document.getElementById('btn-retry-page')?.addEventListener('click', () => {
    carregarDados()
  })

  // Paginação
  document
    .getElementById('btn-pagina-anterior')
    ?.addEventListener('click', () => {
      if (paginaAtual > 1) {
        paginaAtual--
        renderizarPagina()
      }
    })
  document
    .getElementById('btn-pagina-proxima')
    ?.addEventListener('click', () => {
      const totalPaginas = Math.max(
        1,
        Math.ceil(ticketsFiltrados.length / TICKETS_POR_PAGINA)
      )
      if (paginaAtual < totalPaginas) {
        paginaAtual++
        renderizarPagina()
      }
    })
})

// Carrega os dados necessários das APIs
async function carregarDados () {
  const pageError = document.getElementById('page-error')
  const pageErrorText = document.getElementById('page-error-text')
  const tbody = document.getElementById('tbody-tickets')

  pageError?.classList.add('d-none')
  tbody?.setAttribute('aria-busy', 'true')

  try {
    const [tickets, vagas, mensalistas, tarifas] = await Promise.all([
      ApiService.getTickets(),
      ApiService.getVagas(),
      ApiService.getMensalistas(),
      ApiService.getTarifas()
    ])

    allTickets = tickets
    allVagas = vagas
    allMensalistas = mensalistas
    allTarifas = tarifas

    paginaAtual = 1
    filtrarTickets(document.getElementById('input-busca-ticket').value)

    preencherSelectVagas()
    preencherSelectTarifas()
    preencherSelectMensalistas()
    atualizarAvisoFormulario()
  } catch (error) {
    console.error('Erro ao carregar dados dos tickets:', error)

    if (pageError && pageErrorText) {
      pageErrorText.textContent =
        'Não foi possível carregar as informações dos tickets. Verifique sua conexão e tente novamente.'
      pageError.classList.remove('d-none')
    }

    Swal.fire({
      icon: 'error',
      title: 'Erro de Conexão',
      text: 'Não foi possível carregar as informações dos tickets.'
    })
  } finally {
    tbody?.setAttribute('aria-busy', 'false')
  }
}

// Renderiza a página atual da tabela de tickets (a partir de ticketsFiltrados)
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

  tbody.innerHTML = ''

  const total = ticketsFiltrados.length

  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4 text-muted">
          Nenhum ticket encontrado.
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
  paginaAtual = Math.min(paginaAtual, totalPaginas)

  const inicio = (paginaAtual - 1) * TICKETS_POR_PAGINA
  const fim = Math.min(inicio + TICKETS_POR_PAGINA, total)
  const pagina = ticketsFiltrados.slice(inicio, fim)

  pagina.forEach(ticket => renderizarLinhaTicket(ticket, tbody))

  if (infoEl)
    infoEl.textContent = `Mostrando ${inicio + 1}–${fim} de ${total} tickets`
  if (labelEl) labelEl.textContent = `Página ${paginaAtual} de ${totalPaginas}`
  btnAnterior?.classList.toggle('disabled', paginaAtual === 1)
  btnProxima?.classList.toggle('disabled', paginaAtual === totalPaginas)

  // Vincula eventos aos botões de fechamento renderizados nesta página
  tbody.querySelectorAll('.btn-fechar-ticket').forEach(btn => {
    btn.addEventListener('click', async e => {
      const ticketId = e.currentTarget.getAttribute('data-id')
      await finalizarTicket(ticketId)
    })
  })
}

// Renderiza uma linha da tabela — ordem das colunas: ID, Placa, Vaga,
// Mensalista, Entrada, Saída, Valor Total, Status, Ação (bate com o <thead>).
function renderizarLinhaTicket (ticket, tbody) {
  const vaga = allVagas.find(v => v.id === ticket.vagaId)
  const codVaga = vaga ? vaga.codigo : ticket.vagaId

  const mensalista = ticket.mensalistaId
    ? allMensalistas.find(m => m.id === ticket.mensalistaId)
    : null
  const nomeMensalista = mensalista ? mensalista.nome : 'Avulso'

  const dataEntradaStr = new Date(ticket.dataEntrada).toLocaleString('pt-BR')
  const dataSaidaStr = ticket.dataSaida
    ? new Date(ticket.dataSaida).toLocaleString('pt-BR')
    : '-'

  const valorStr =
    ticket.valorTotal !== null && ticket.valorTotal !== undefined
      ? `R$ ${ticket.valorTotal.toFixed(2).replace('.', ',')}`
      : '-'

  const statusKey = (ticket.status || '').toLowerCase()
  const statusBadge =
    statusKey === 'aberto'
      ? '<span class="badge-status status-aberto"><i class="fas fa-clock" aria-hidden="true"></i> Aberto</span>'
      : '<span class="badge-status status-fechado"><i class="fas fa-check-circle" aria-hidden="true"></i> Fechado</span>'

  const btnAcao =
    statusKey === 'aberto'
      ? `<button type="button" class="btn btn-sm btn-outline-danger btn-fechar-ticket" data-id="${ticket.id}">
           <i class="fas fa-sign-out-alt me-1" aria-hidden="true"></i>Fechar Ticket
         </button>`
      : '<span class="text-muted text-xs">Somente leitura</span>'

  const tr = document.createElement('tr')
  tr.innerHTML = `
    <td class="fw-bold text-muted">#${ApiService.sanitizeText(ticket.id)}</td>
    <td class="fw-bold">${ApiService.sanitizeText(ticket.placa)}</td>
    <td><span class="badge bg-light text-dark border">${ApiService.sanitizeText(
      codVaga
    )}</span></td>
    <td>${ApiService.sanitizeText(nomeMensalista)}</td>
    <td><small>${dataEntradaStr}</small></td>
    <td><small>${dataSaidaStr}</small></td>
    <td class="fw-bold">${valorStr}</td>
    <td>${statusBadge}</td>
    <td>${btnAcao}</td>
  `
  tbody.appendChild(tr)
}

// Filtro por placa — atualiza ticketsFiltrados e re-renderiza a página 1 (ou a atual, se já estava navegando)
function filtrarTickets (termo) {
  const termoClean = termo.trim().toUpperCase()

  // Ordena por data de entrada real (mais recente primeiro) em vez de
  // depender da ordem de inserção do array retornado pela API.
  const ordenados = [...allTickets].sort(
    (a, b) => new Date(b.dataEntrada) - new Date(a.dataEntrada)
  )

  ticketsFiltrados = termoClean
    ? ordenados.filter(t => t.placa.toUpperCase().includes(termoClean))
    : ordenados

  renderizarPagina()
}

// Preenche o combo de Vagas com apenas as vagas "livre"
function preencherSelectVagas () {
  const selectVaga = document.getElementById('ticket-vaga')
  selectVaga.innerHTML =
    '<option value="" selected disabled>Selecione uma vaga livre...</option>'

  const vagasLivres = allVagas.filter(
    v => (v.status || '').toLowerCase() === 'livre'
  )

  vagasLivres.forEach(vaga => {
    const option = document.createElement('option')
    option.value = vaga.id
    option.textContent = `${vaga.codigo} - ${vaga.tipo}`
    selectVaga.appendChild(option)
  })
}

// Preenche o combo de Tarifas cadastradas
function preencherSelectTarifas () {
  const selectTarifa = document.getElementById('ticket-tarifa')
  selectTarifa.innerHTML =
    '<option value="" selected disabled>Selecione a tarifa...</option>'

  allTarifas.forEach(tarifa => {
    const option = document.createElement('option')
    option.value = tarifa.id
    option.textContent = `${tarifa.nome} (R$ ${Number(tarifa.valorHora)
      .toFixed(2)
      .replace('.', ',')}/h)`
    selectTarifa.appendChild(option)
  })
}

// Preenche o combo de Mensalistas ativos (opcional — veículo avulso é o padrão)
function preencherSelectMensalistas () {
  const selectMensalista = document.getElementById('ticket-mensalista')
  selectMensalista.innerHTML =
    '<option value="">Veículo avulso (sem mensalista)</option>'

  allMensalistas
    .filter(m => m.ativo)
    .forEach(mensalista => {
      const option = document.createElement('option')
      option.value = mensalista.id
      option.textContent = `${mensalista.nome} (${mensalista.placa})`
      selectMensalista.appendChild(option)
    })
}

// Mostra/oculta o aviso e desabilita a emissão se não houver vaga livre ou tarifa cadastrada
function atualizarAvisoFormulario () {
  const avisoDiv = document.getElementById('ticket-form-aviso')
  const avisoTexto = document.getElementById('ticket-form-aviso-texto')
  const btnEmitir = document.getElementById('btn-emitir-ticket')

  const temVagaLivre = allVagas.some(
    v => (v.status || '').toLowerCase() === 'livre'
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
  )}. Resolva isso em Vagas & Tarifas antes de continuar.`

  if (avisoDiv && avisoTexto) {
    avisoTexto.textContent = mensagem
    avisoDiv.classList.remove('d-none')
  }
  if (btnEmitir) {
    btnEmitir.disabled = true
    btnEmitir.title = mensagem
  }
}

// Verifica se a placa digitada pertence a um mensalista ativo e pré-seleciona o combo
function verificarMensalistaNaDigitacao (placa) {
  const infoDiv = document.getElementById('mensalista-status-info')
  const selectMensalista = document.getElementById('ticket-mensalista')
  const placaClean = placa.trim().toUpperCase()

  if (placaClean.length < 7) {
    infoDiv.innerHTML = ''
    return
  }

  const mensalistaEncontrado = allMensalistas.find(
    m => m.ativo && m.placa && m.placa.toUpperCase() === placaClean
  )

  if (mensalistaEncontrado) {
    infoDiv.innerHTML = `<span class="text-success fw-semibold"><i class="fas fa-check-circle me-1" aria-hidden="true"></i> Mensalista Ativo: ${ApiService.sanitizeText(
      mensalistaEncontrado.nome
    )} (isento de tarifa)</span>`
    if (selectMensalista) selectMensalista.value = mensalistaEncontrado.id
  } else {
    infoDiv.innerHTML = `<span class="text-muted"><i class="fas fa-info-circle me-1" aria-hidden="true"></i> Veículo avulso (tarifado normalmente)</span>`
    if (selectMensalista) selectMensalista.value = ''
  }
}

// Emissão de Novo Ticket
async function criarNovoTicket (e) {
  e.preventDefault()
  const form = e.target

  // Usa a validação nativa do formulário (required/pattern já definidos no
  // HTML) em vez de checar campo a campo manualmente — ativa o feedback
  // visual/ARIA (.invalid-feedback) que já existe na marcação.
  if (!form.checkValidity()) {
    form.classList.add('was-validated')
    return
  }

  const placa = document
    .getElementById('ticket-placa')
    .value.trim()
    .toUpperCase()
  const vagaId = document.getElementById('ticket-vaga').value
  const tarifaId = document.getElementById('ticket-tarifa').value
  const mensalistaId =
    document.getElementById('ticket-mensalista').value || null

  const btnSubmit = document.getElementById('btn-registrar-entrada')
  btnSubmit.disabled = true // evita duplo clique/duplo envio

  try {
    await ApiService.criarTicket({
      placa,
      vagaId,
      tarifaId,
      mensalistaId
    })

    Swal.fire({
      icon: 'success',
      title: 'Ticket Emitido!',
      text: `Entrada registrada com sucesso para a placa ${placa}.`,
      timer: 2000,
      showConfirmButton: false
    })

    form.reset()
    form.classList.remove('was-validated')
    document.getElementById('mensalista-status-info').innerHTML = ''
    const modalInstance = bootstrap.Modal.getInstance(
      document.getElementById('modalNovoTicket')
    )
    if (modalInstance) modalInstance.hide()

    await carregarDados()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao emitir ticket',
      text: error.message
    })
  } finally {
    btnSubmit.disabled = false
  }
}

// Encerramento/Baixa do Ticket
async function finalizarTicket (ticketId) {
  const confirmacao = await Swal.fire({
    title: 'Confirmar Saída?',
    text: 'O sistema efetuará o cálculo do valor e liberará a vaga automaticamente.',
    icon: 'question',
    showCancelButton: true,
    // Cores derivadas da paleta do projeto (tons escuros, não os pastéis
    // claros — pastel puro como fundo sólido de botão dá baixo contraste
    // com o texto branco padrão do SweetAlert2).
    confirmButtonColor: '#0e3a2f', // $color-sucesso-text
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Sim, dar saída',
    cancelButtonText: 'Cancelar'
  })

  if (!confirmacao.isConfirmed) return

  const botao = document.querySelector(
    `.btn-fechar-ticket[data-id="${ticketId}"]`
  )
  if (botao) botao.disabled = true // evita duplo clique

  try {
    const ticketFinalizado = await ApiService.fecharTicket(ticketId)
    const valorFinal = ticketFinalizado.valorTotal ?? 0

    Swal.fire({
      icon: 'success',
      title: 'Ticket Finalizado!',
      html: `
        <div class="text-center">
          <p class="mb-1">Placa: <strong>${ApiService.sanitizeText(
            ticketFinalizado.placa
          )}</strong></p>
          <p class="fs-4 text-success fw-bold">Valor Total: R$ ${valorFinal
            .toFixed(2)
            .replace('.', ',')}</p>
        </div>
      `,
      confirmButtonColor: '#0e3a2f'
    })

    await carregarDados()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao dar saída',
      text: error.message
    })
    if (botao) botao.disabled = false
  }
}
