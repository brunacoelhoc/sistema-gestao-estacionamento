/**
 * Lógica do Dashboard Principal
 * Inicializa os KPIs, filtro por tipo de vaga, ranking de vagas,
 * busca rápida por placa, tabela de tickets recentes e ações da página.
 */

// Armazenamento em memória dos dados para permitir filtragem local ágil
let globalVagas = []
let globalTickets = []
let globalMensalistas = []
let globalTarifas = []

document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardData()

  // Listener para o botão de tentar novamente em caso de erro
  document
    .getElementById('btn-retry-dashboard')
    ?.addEventListener('click', () => {
      loadDashboardData()
    })

  // Listener para o Filtro por Tipo de Vaga
  document.getElementById('filtro-tipo-vaga')?.addEventListener('change', e => {
    const tipoSelecionado = e.target.value
    aplicarFiltroTipoVaga(tipoSelecionado)
  })

  // === BUSCA RÁPIDA POR PLACA NO DASHBOARD ===
  initBuscaRapidaPlaca()
})

/**
 * Inicializa a busca rápida por placa para agilizar a baixa do ticket no atendimento
 */
function initBuscaRapidaPlaca () {
  const inputBusca = document.getElementById('input-busca-placa-rapida')
  if (!inputBusca) return

  // Formatação em caixa alta
  inputBusca.addEventListener('input', e => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (value.length > 7) value = value.slice(0, 7)
    e.target.value = value

    filtrarTicketsPorPlaca(value)
  })

  // Atalho: Pressionar Enter para dar saída direta na primeira placa correspondente
  inputBusca.addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const termo = e.target.value.trim().toUpperCase()
      if (!termo) return

      const ticketEncontrado = globalTickets.find(
        t =>
          (t.status || '').toLowerCase() === 'aberto' &&
          (t.placa || '').toUpperCase().includes(termo)
      )

      if (ticketEncontrado) {
        await encerrarTicket(ticketEncontrado.id)
        e.target.value = ''
        filtrarTicketsPorPlaca('')
      } else {
        Swal.fire({
          icon: 'info',
          title: 'Ticket não localizado',
          text: `Nenhum ticket aberto foi encontrado para a placa "${termo}".`,
          timer: 2000,
          showConfirmButton: false
        })
      }
    }
  })
}

/**
 * Filtra dinamicamente a tabela de tickets abertos pela busca de placa
 */
function filtrarTicketsPorPlaca (placaTermo) {
  const ticketsAbertos = globalTickets.filter(
    t => (t.status || '').toLowerCase() === 'aberto'
  )

  if (!placaTermo) {
    renderTicketsRecentes(ticketsAbertos, globalVagas, globalMensalistas)
    return
  }

  const filtrados = ticketsAbertos.filter(t =>
    (t.placa || '').toUpperCase().includes(placaTermo)
  )

  renderTicketsRecentes(filtrados, globalVagas, globalMensalistas)
}

// Carregamento dos Dados do Dashboard
async function loadDashboardData () {
  const errorBanner = document.getElementById('dashboard-error')
  const errorText = document.getElementById('dashboard-error-text')
  const tbody = document.getElementById('tbody-tickets-recentes')

  errorBanner?.classList.add('d-none')
  tbody?.setAttribute('aria-busy', 'true')

  try {
    const [vagas, tickets, mensalistas, tarifas] = await Promise.all([
      ApiService.getVagas ? ApiService.getVagas() : Promise.resolve([]),
      ApiService.getTickets ? ApiService.getTickets() : Promise.resolve([]),
      ApiService.getMensalistas
        ? ApiService.getMensalistas()
        : Promise.resolve([]),
      ApiService.getTarifas ? ApiService.getTarifas() : Promise.resolve([])
    ])

    // Armazena no escopo global para filtragem
    globalVagas = vagas || []
    globalTickets = tickets || []
    globalMensalistas = mensalistas || []
    globalTarifas = tarifas || []

    const selectTipo = document.getElementById('filtro-tipo-vaga')
    const tipoAtual = selectTipo ? selectTipo.value : 'todos'

    // Atualiza KPIs com base no filtro
    aplicarFiltroTipoVaga(tipoAtual)

    // Aplica filtro de busca rápida se houver texto
    const inputBusca = document.getElementById('input-busca-placa-rapida')
    const termoPlaca = inputBusca ? inputBusca.value.trim().toUpperCase() : ''
    filtrarTicketsPorPlaca(termoPlaca)

    // Renderiza o Ranking de Vagas
    renderRankingVagas(globalVagas, globalTickets)
  } catch (error) {
    console.error('Erro ao carregar dados do dashboard:', error)

    if (errorBanner && errorText) {
      errorText.textContent =
        'Não foi possível carregar os dados do painel. Verifique sua conexão e tente novamente.'
      errorBanner.classList.remove('d-none')
    }

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Erro de Conexão',
        text: 'Não foi possível carregar os dados do backend.'
      })
    }
  } finally {
    tbody?.setAttribute('aria-busy', 'false')
  }
}

// Aplica o filtro por Tipo de Vaga e recarrega os KPIs afetados
function aplicarFiltroTipoVaga (tipo) {
  let vagasFiltradas = globalVagas

  if (tipo && tipo.toLowerCase() !== 'todos') {
    vagasFiltradas = globalVagas.filter(
      v => (v.tipo || '').toLowerCase() === tipo.toLowerCase()
    )
  }

  const idsVagasFiltradas = new Set(vagasFiltradas.map(v => String(v.id)))

  const ticketsFiltrados = globalTickets.filter(t =>
    idsVagasFiltradas.has(String(t.vagaId))
  )

  atualizarKPIs(vagasFiltradas, ticketsFiltrados)
}

// Calcula e atualiza todos os KPIs do topo do dashboard
function atualizarKPIs (vagas, tickets) {
  const vagasLivres = vagas.filter(
    v => (v.status || '').toLowerCase() === 'livre'
  ).length
  const vagasOcupadas = vagas.filter(
    v => (v.status || '').toLowerCase() === 'ocupada'
  ).length
  const vagasManutencao = vagas.filter(
    v => (v.status || '').toLowerCase() === 'manutencao'
  ).length
  const totalVagas = vagas.length

  const ticketsAbertos = tickets.filter(
    t => (t.status || '').toLowerCase() === 'aberto'
  )
  const ticketsFechados = tickets.filter(
    t => (t.status || '').toLowerCase() === 'fechado'
  )

  const taxaOcupacao = totalVagas > 0 ? (vagasOcupadas / totalVagas) * 100 : 0

  const faturamentoTotal = ticketsFechados.reduce(
    (acc, t) => acc + (Number(t.valorTotal ?? t.valorCobrado) || 0),
    0
  )

  const ticketMedioTexto =
    ticketsFechados.length > 0
      ? `R$ ${(faturamentoTotal / ticketsFechados.length)
          .toFixed(2)
          .replace('.', ',')}`
      : 'Nenhum dado disponível'

  const tempoMedioTexto = calcularTempoMedio(ticketsFechados)

  if (document.getElementById('kpi-vagas-livres'))
    document.getElementById('kpi-vagas-livres').textContent = vagasLivres
  if (document.getElementById('kpi-vagas-ocupadas'))
    document.getElementById('kpi-vagas-ocupadas').textContent = vagasOcupadas
  if (document.getElementById('kpi-vagas-manutencao'))
    document.getElementById('kpi-vagas-manutencao').textContent =
      vagasManutencao
  if (document.getElementById('kpi-taxa-ocupacao'))
    document.getElementById(
      'kpi-taxa-ocupacao'
    ).textContent = `${taxaOcupacao.toFixed(1)}%`
  if (document.getElementById('kpi-tickets-abertos'))
    document.getElementById('kpi-tickets-abertos').textContent =
      ticketsAbertos.length
  if (document.getElementById('kpi-faturamento'))
    document.getElementById(
      'kpi-faturamento'
    ).textContent = `R$ ${faturamentoTotal.toFixed(2).replace('.', ',')}`
  if (document.getElementById('kpi-ticket-medio'))
    document.getElementById('kpi-ticket-medio').textContent = ticketMedioTexto
  if (document.getElementById('kpi-tempo-medio'))
    document.getElementById('kpi-tempo-medio').textContent = tempoMedioTexto
}

// Calcula tempo médio de permanência
function calcularTempoMedio (ticketsFechados) {
  const validos = ticketsFechados.filter(
    t => (t.horaEntrada || t.dataEntrada) && (t.horaSaida || t.dataSaida)
  )
  if (validos.length === 0) return 'Nenhum dado disponível'

  const totalMs = validos.reduce((acc, t) => {
    const entrada = new Date(t.horaEntrada || t.dataEntrada)
    const saida = new Date(t.horaSaida || t.dataSaida)
    return acc + Math.max(0, saida - entrada)
  }, 0)

  const mediaMinutos = Math.round(totalMs / validos.length / 60000)
  const horas = Math.floor(mediaMinutos / 60)
  const minutos = mediaMinutos % 60

  if (horas === 0 && minutos === 0) return 'Menos de 1m'
  return `${horas}h ${minutos}m`
}

// Renderização do Ranking das Vagas Mais Utilizadas
function renderRankingVagas (vagas, tickets) {
  const tbody = document.getElementById('tbody-ranking-vagas')
  if (!tbody) return

  tbody.innerHTML = ''

  if (!vagas || vagas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-4 text-muted">Nenhuma vaga cadastrada.</td>
      </tr>
    `
    return
  }

  const contagemUso = {}
  tickets.forEach(ticket => {
    if (ticket.vagaId) {
      const vId = String(ticket.vagaId)
      contagemUso[vId] = (contagemUso[vId] || 0) + 1
    }
  })

  const ranking = vagas
    .map(vaga => ({
      ...vaga,
      totalUso: contagemUso[String(vaga.id)] || 0
    }))
    .sort((a, b) => b.totalUso - a.totalUso)

  ranking.forEach((item, index) => {
    const tr = document.createElement('tr')

    let badgePosicao = `<span class="fw-bold text-muted">${index + 1}º</span>`
    if (index === 0)
      badgePosicao = `<span class="badge bg-warning text-dark"><i class="fas fa-crown me-1"></i>1º</span>`
    else if (index === 1)
      badgePosicao = `<span class="badge bg-secondary">2º</span>`
    else if (index === 2) badgePosicao = `<span class="badge bg-dark">3º</span>`

    const tipoFormatado = item.tipo
      ? item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1).toLowerCase()
      : 'Comum'

    tr.innerHTML = `
      <td>${badgePosicao}</td>
      <td class="fw-bold">${ApiService.sanitizeText(
        item.codigo || `Vaga ${item.id}`
      )}</td>
      <td><span class="badge bg-light text-dark border">${ApiService.sanitizeText(
        tipoFormatado
      )}</span></td>
      <td class="text-end fw-bold text-primary">${item.totalUso} ${
      item.totalUso === 1 ? 'ticket' : 'tickets'
    }</td>
    `
    tbody.appendChild(tr)
  })
}

// Renderização dos Tickets na Tabela Ativa
function renderTicketsRecentes (ticketsAbertos, vagas, mensalistas) {
  const tbody = document.getElementById('tbody-tickets-recentes')
  if (!tbody) return
  tbody.innerHTML = ''

  if (ticketsAbertos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-muted">
          <i class="fas fa-check-circle text-success me-2" aria-hidden="true"></i>Nenhum ticket aberto encontrado.
        </td>
      </tr>
    `
    return
  }

  ticketsAbertos.forEach(ticket => {
    const vaga = vagas.find(v => String(v.id) === String(ticket.vagaId))
    const identificadorVaga = vaga
      ? `${vaga.codigo || vaga.numero || vaga.id} (${vaga.tipo || 'comum'})`
      : ticket.vagaId

    const dataEntradaVal = ticket.horaEntrada || ticket.dataEntrada
    const horaEntrada = dataEntradaVal
      ? new Date(dataEntradaVal).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      : '-'

    const mensalista = ticket.mensalistaId
      ? mensalistas.find(m => String(m.id) === String(ticket.mensalistaId))
      : null
    const clienteHtml = mensalista
      ? `<span class="badge-status status-mensalista"><i class="fas fa-id-card me-1" aria-hidden="true"></i>${ApiService.sanitizeText(
          mensalista.nome || mensalista.nomeCliente
        )}</span>`
      : '<span class="badge bg-secondary">Avulso</span>'

    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td class="fw-bold">${ApiService.sanitizeText(ticket.placa)}</td>
      <td><span class="badge bg-light text-dark border">${ApiService.sanitizeText(
        identificadorVaga
      )}</span></td>
      <td>${horaEntrada}</td>
      <td>${clienteHtml}</td>
      <td>
        <button type="button" class="btn btn-sm btn-outline-danger btn-fechar-ticket" data-id="${
          ticket.id
        }">
          <i class="fas fa-sign-out-alt me-1" aria-hidden="true"></i>Dar Saída
        </button>
      </td>
    `
    tbody.appendChild(tr)
  })

  tbody.querySelectorAll('.btn-fechar-ticket').forEach(btn => {
    btn.addEventListener('click', async e => {
      const ticketId = e.currentTarget.getAttribute('data-id')
      await encerrarTicket(ticketId, e.currentTarget)
    })
  })
}

// Função de Encerramento Rápido do Ticket no Dashboard
async function encerrarTicket (ticketId, botao) {
  const ticket = globalTickets.find(t => String(t.id) === String(ticketId))
  if (!ticket) {
    Swal.fire({
      icon: 'error',
      title: 'Erro',
      text: 'Ticket não localizado.'
    })
    return
  }

  const tarifa = globalTarifas.find(
    t => String(t.id) === String(ticket.tarifaId)
  )
  const horaEntrada = new Date(
    ticket.horaEntrada || ticket.dataEntrada || Date.now()
  )
  const horaSaida = new Date()

  const diffMs = horaSaida - horaEntrada
  const diffMinutos = Math.max(1, Math.floor(diffMs / (1000 * 60)))
  const horasFormatadas = Math.floor(diffMinutos / 60)
  const minutosRestantes = diffMinutos % 60
  const tempoTexto = `${
    horasFormatadas > 0 ? `${horasFormatadas}h ` : ''
  }${minutosRestantes}min`

  let valorCalculado = 0
  const ehMensalista = Boolean(ticket.mensalistaId)

  if (ehMensalista) {
    valorCalculado = 0
  } else {
    const valorHora = tarifa ? Number(tarifa.valorHora || tarifa.valor || 0) : 0
    const diffHoras = diffMs / (1000 * 60 * 60)
    const horasPagas = Math.max(1, Math.ceil(diffHoras))
    valorCalculado = horasPagas * valorHora
  }

  const selectPagamentoHTML = ehMensalista
    ? `<div class="alert alert-info py-2 mb-3"><strong>Isenção Aplicada:</strong> Veículo de Mensalista.</div>`
    : `
      <div class="mb-3 text-start">
        <label for="swal-dashboard-pagamento" class="form-label fw-semibold">Forma de Pagamento:</label>
        <select id="swal-dashboard-pagamento" class="form-select">
          <option value="pix" selected>📱 PIX</option>
          <option value="cartao_credito">💳 Cartão de Crédito</option>
          <option value="cartao_debito">💳 Cartão de Débito</option>
          <option value="dinheiro">💵 Dinheiro</option>
        </select>
      </div>
    `

  const { isConfirmed, value: formaPagamento } = await Swal.fire({
    title: 'Confirmar Saída do Veículo',
    html: `
      <div class="text-center mb-3">
        <p class="mb-1 text-muted">Placa: <strong class="text-dark fs-5">${ApiService.sanitizeText(
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
    cancelButtonColor: '#6c757d',
    confirmButtonText: '<i class="fas fa-check me-1"></i> Confirmar Saída',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      if (ehMensalista) return 'isento'
      const select = document.getElementById('swal-dashboard-pagamento')
      return select ? select.value : 'pix'
    }
  })

  if (!isConfirmed) return

  if (botao) botao.disabled = true

  try {
    const ticketAtualizado = {
      ...ticket,
      horaSaida: horaSaida.toISOString(),
      dataSaida: horaSaida.toISOString(),
      valorCobrado: valorCalculado,
      valorTotal: valorCalculado,
      formaPagamento: formaPagamento,
      tempoPermanencia: tempoTexto,
      status: 'fechado'
    }

    if (ApiService.fecharTicket) {
      await ApiService.fecharTicket(ticketId, ticketAtualizado)
    } else if (ApiService.updateTicket) {
      await ApiService.updateTicket(ticketId, ticketAtualizado)
    }

    if (ticket.vagaId && ApiService.updateVagaStatus) {
      await ApiService.updateVagaStatus(ticket.vagaId, 'livre')
    }

    Swal.fire({
      icon: 'success',
      title: 'Saída Registrada!',
      text: `Veículo ${ticket.placa} liberado com sucesso.`,
      timer: 1800,
      showConfirmButton: false
    })

    await loadDashboardData()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao fechar ticket',
      text: error.message || 'Falha ao processar o encerramento.'
    })
    if (botao) botao.disabled = false
  }
}
