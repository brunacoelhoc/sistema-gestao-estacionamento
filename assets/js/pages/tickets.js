/**
 * Lógica da Página de Tickets
 * Controle de emissão, listagem, busca e baixa de tickets.
 */

let allTickets = []
let allVagas = []
let allMensalistas = []

document.addEventListener('DOMContentLoaded', async () => {
  await carregarDados()

  // Evento de busca por placa
  document.getElementById('input-busca-ticket').addEventListener('input', e => {
    filtrarTickets(e.target.value)
  })

  // Evento ao digitar a placa no modal de novo ticket (Verificação LGPD e Mensalista)
  const inputPlaca = document.getElementById('ticket-placa')
  inputPlaca.addEventListener('input', e => {
    verificarMensalistaNaDigitacao(e.target.value)
  })

  // Evento de envio do formulário de novo ticket
  document
    .getElementById('form-novo-ticket')
    .addEventListener('submit', criarNovoTicket)
})

// Carrega os dados necessários das APIs
async function carregarDados () {
  try {
    const [tickets, vagas, mensalistas] = await Promise.all([
      ApiService.getTickets(),
      ApiService.getVagas(),
      ApiService.getMensalistas()
    ])

    allTickets = tickets
    allVagas = vagas
    allMensalistas = mensalistas

    renderizarTabelaTickets(allTickets)
    preencherSelectVagas()
  } catch (error) {
    console.error('Erro ao carregar dados dos tickets:', error)
    Swal.fire({
      icon: 'error',
      title: 'Erro de Conexão',
      text: 'Não foi possível carregar as informações dos tickets.'
    })
  }
}

// Renderiza a tabela de tickets
function renderizarTabelaTickets (ticketsList) {
  const tbody = document.getElementById('tbody-tickets')
  tbody.innerHTML = ''

  if (!ticketsList || ticketsList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4 text-muted">
          Nenhum ticket encontrado.
        </td>
      </tr>
    `
    return
  }

  // Ordena tickets mais recentes primeiro
  const ticketsOrdenados = [...ticketsList].reverse()

  ticketsOrdenados.forEach(ticket => {
    const vaga = allVagas.find(v => v.id === ticket.vagaId)
    const codVaga = vaga ? `${vaga.codigo}` : ticket.vagaId

    const dataEntradaStr = new Date(ticket.dataEntrada).toLocaleString('pt-BR')
    const dataSaidaStr = ticket.dataSaida
      ? new Date(ticket.dataSaida).toLocaleString('pt-BR')
      : '-'

    const valorStr =
      ticket.valorTotal !== null && ticket.valorTotal !== undefined
        ? `R$ ${ticket.valorTotal.toFixed(2).replace('.', ',')}`
        : '-'

    const statusBadge =
      ticket.status === 'Aberto'
        ? '<span class="badge bg-warning text-dark">Aberto</span>'
        : '<span class="badge bg-success">Pago</span>'

    const btnAcao =
      ticket.status === 'Aberto'
        ? `<button class="btn btn-sm btn-outline-danger btn-fechar-ticket" data-id="${ticket.id}">
           <i class="fas fa-sign-out-alt me-1"></i>Saída
         </button>`
        : `<span class="text-muted text-xs">Concluído</span>`

    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td class="fw-bold text-muted">#${ticket.id}</td>
      <td class="fw-bold">${ApiService.sanitizeText(ticket.placa)}</td>
      <td>${ApiService.sanitizeText(ticket.tipoVeiculo)}</td>
      <td><span class="badge bg-light text-dark border">${ApiService.sanitizeText(
        codVaga
      )}</span></td>
      <td><small>${dataEntradaStr}</small></td>
      <td><small>${dataSaidaStr}</small></td>
      <td class="fw-bold">${valorStr}</td>
      <td>${statusBadge}</td>
      <td>${btnAcao}</td>
    `

    tbody.appendChild(tr)
  })

  // Vincular eventos aos botões de saída
  document.querySelectorAll('.btn-fechar-ticket').forEach(btn => {
    btn.addEventListener('click', async e => {
      const ticketId = e.currentTarget.getAttribute('data-id')
      await finalizarTicket(ticketId)
    })
  })
}

// Filtro em tempo real por placa
function filtrarTickets (termo) {
  const termoClean = termo.trim().toUpperCase()
  const filtrados = allTickets.filter(t =>
    t.placa.toUpperCase().includes(termoClean)
  )
  renderizarTabelaTickets(filtrados)
}

// Preenche o combo de Vagas com apenas as vagas Livres
function preencherSelectVagas () {
  const selectVaga = document.getElementById('ticket-vaga')
  selectVaga.innerHTML = '<option value="">Selecione uma vaga...</option>'

  const vagasLivres = allVagas.filter(v => v.status === 'Livre')

  if (vagasLivres.length === 0) {
    selectVaga.innerHTML =
      '<option value="">Nenhuma vaga disponível no momento</option>'
    selectVaga.disabled = true
    return
  }

  selectVaga.disabled = false
  vagasLivres.forEach(vaga => {
    const option = document.createElement('option')
    option.value = vaga.id
    option.textContent = `${vaga.codigo} - ${vaga.tipo} (${vaga.localizacao})`
    selectVaga.appendChild(option)
  })
}

// Verifica se a placa pertence a um mensalista ativo
function verificarMensalistaNaDigitacao (placa) {
  const infoDiv = document.getElementById('mensalista-status-info')
  const placaClean = placa.trim().toUpperCase()

  if (placaClean.length < 7) {
    infoDiv.innerHTML = ''
    return
  }

  const mensalistaEncontrado = allMensalistas.find(
    m => m.placaVeiculo.toUpperCase() === placaClean && m.status === 'Ativo'
  )

  if (mensalistaEncontrado) {
    infoDiv.innerHTML = `<span class="text-success fw-semibold"><i class="fas fa-check-circle me-1"></i> Mensalista Ativo: ${ApiService.sanitizeText(
      mensalistaEncontrado.nome
    )} (Isento de tarifa avulsa)</span>`
  } else {
    infoDiv.innerHTML = `<span class="text-muted"><i class="fas fa-info-circle me-1"></i> Veículo Avulso (Tarifado normalmente)</span>`
  }
}

// Emissão de Novo Ticket
async function criarNovoTicket (e) {
  e.preventDefault()

  const placa = document
    .getElementById('ticket-placa')
    .value.trim()
    .toUpperCase()
  const tipoVeiculo = document.getElementById('ticket-tipo').value
  const vagaId = document.getElementById('ticket-vaga').value

  if (!placa || !vagaId) {
    Swal.fire({
      icon: 'warning',
      title: 'Atenção',
      text: 'Preencha todos os campos obrigatórios.'
    })
    return
  }

  try {
    await ApiService.criarTicket({
      placa,
      tipoVeiculo,
      vagaId
    })

    Swal.fire({
      icon: 'success',
      title: 'Ticket Emitido!',
      text: `Entrada registrada com sucesso para a placa ${placa}.`,
      timer: 2000,
      showConfirmButton: false
    })

    // Resetar formulário e modal
    document.getElementById('form-novo-ticket').reset()
    document.getElementById('mensalista-status-info').innerHTML = ''
    const modalElement = document.getElementById('modalNovoTicket')
    const modalInstance = bootstrap.Modal.getInstance(modalElement)
    if (modalInstance) modalInstance.hide()

    // Recarregar dados da tela
    await carregarDados()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao emitir ticket',
      text: error.message
    })
  }
}

// Encerramento/Baixa do Ticket
async function finalizarTicket (ticketId) {
  const confirmacao = await Swal.fire({
    title: 'Confirmar Saída?',
    text: 'O sistema efetuará o cálculo do valor e liberará a vaga automaticamente.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#198754',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Sim, dar saída',
    cancelButtonText: 'Cancelar'
  })

  if (confirmacao.isConfirmed) {
    try {
      const ticketFinalizado = await ApiService.fecharTicket(ticketId)

      Swal.fire({
        icon: 'success',
        title: 'Ticket Finalizado!',
        html: `
          <div class="text-center">
            <p class="mb-1">Placa: <strong>${ApiService.sanitizeText(
              ticketFinalizado.placa
            )}</strong></p>
            <p class="fs-4 text-success fw-bold">Valor Total: R$ ${ticketFinalizado.valorTotal
              .toFixed(2)
              .replace('.', ',')}</p>
          </div>
        `,
        confirmButtonColor: '#0d6efd'
      })

      await carregarDados()
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Erro ao dar saída',
        text: error.message
      })
    }
  }
}
