/**
 * Lógica do Dashboard Principal
 * Inicializa os KPIs, filtro por tipo de vaga, ranking de vagas,
 * tabela de tickets recentes e ações da página.
 */

// Armazenamento em memória dos dados para permitir filtragem local ágil
let globalVagas = []
let globalTickets = []
let globalMensalistas = []

document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardData()

  // Listener para o botão de tentar novamente em caso de erro
  document
    .getElementById('btn-retry-dashboard')
    ?.addEventListener('click', () => {
      loadDashboardData()
    })

  // Listener para o Filtro por Tipo de Vaga (Requisito 2.7)
  document.getElementById('filtro-tipo-vaga')?.addEventListener('change', e => {
    const tipoSelecionado = e.target.value
    aplicarFiltroTipoVaga(tipoSelecionado)
  })
})

// Carregamento dos Dados do Dashboard
async function loadDashboardData () {
  const errorBanner = document.getElementById('dashboard-error')
  const errorText = document.getElementById('dashboard-error-text')
  const tbody = document.getElementById('tbody-tickets-recentes')

  errorBanner?.classList.add('d-none')
  tbody?.setAttribute('aria-busy', 'true')

  try {
    const [vagas, tickets, mensalistas] = await Promise.all([
      ApiService.getVagas(),
      ApiService.getTickets(),
      ApiService.getMensalistas()
    ])

    // Armazena no escopo global para filtragem
    globalVagas = vagas || []
    globalTickets = tickets || []
    globalMensalistas = mensalistas || []

    // Obtém o tipo selecionado no momento (caso o usuário troque e recarregue)
    const selectTipo = document.getElementById('filtro-tipo-vaga')
    const tipoAtual = selectTipo ? selectTipo.value : 'todos'

    // Atualiza a tela com base no filtro
    aplicarFiltroTipoVaga(tipoAtual)

    // Renderiza a lista de tickets ativos (independente do filtro de tipo de vaga)
    renderTicketsRecentes(
      globalTickets.filter(t => (t.status || '').toLowerCase() === 'aberto'),
      globalVagas,
      globalMensalistas
    )

    // Renderiza o Ranking de Vagas (Requisito 2.6)
    renderRankingVagas(globalVagas, globalTickets)
  } catch (error) {
    console.error('Erro ao carregar dados do dashboard:', error)

    if (errorBanner && errorText) {
      errorText.textContent =
        'Não foi possível carregar os dados do painel. Verifique sua conexão e tente novamente.'
      errorBanner.classList.remove('d-none')
    }

    Swal.fire({
      icon: 'error',
      title: 'Erro de Conexão',
      text: 'Não foi possível carregar os dados do backend (json-server).'
    })
  } finally {
    tbody?.setAttribute('aria-busy', 'false')
  }
}

// Aplica o filtro por Tipo de Vaga e recarrega os KPIs afetados (Requisito 2.7)
function aplicarFiltroTipoVaga (tipo) {
  let vagasFiltradas = globalVagas

  if (tipo && tipo.toLowerCase() !== 'todos') {
    vagasFiltradas = globalVagas.filter(
      v => (v.tipo || '').toLowerCase() === tipo.toLowerCase()
    )
  }

  // Se filtrarmos as vagas por tipo, os tickets contabilizados para faturamento/taxa
  // também devem ser associados apenas às vagas desse tipo
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

  // Taxa de ocupação: % de vagas "ocupada" em relação ao total de vagas do tipo
  const taxaOcupacao = totalVagas > 0 ? (vagasOcupadas / totalVagas) * 100 : 0

  // Faturamento TOTAL: soma de todos os tickets fechados
  const faturamentoTotal = ticketsFechados.reduce(
    (acc, t) => acc + (Number(t.valorTotal) || 0),
    0
  )

  // Ticket médio = faturamento total / quantidade de tickets fechados
  // Exibe "Nenhum dado disponível" se não houver tickets fechados
  const ticketMedioTexto =
    ticketsFechados.length > 0
      ? `R$ ${(faturamentoTotal / ticketsFechados.length)
          .toFixed(2)
          .replace('.', ',')}`
      : 'Nenhum dado disponível'

  // Tempo médio de permanência dos tickets fechados
  const tempoMedioTexto = calcularTempoMedio(ticketsFechados)

  document.getElementById('kpi-vagas-livres').textContent = vagasLivres
  document.getElementById('kpi-vagas-ocupadas').textContent = vagasOcupadas
  document.getElementById('kpi-vagas-manutencao').textContent = vagasManutencao
  document.getElementById(
    'kpi-taxa-ocupacao'
  ).textContent = `${taxaOcupacao.toFixed(1)}%`
  document.getElementById('kpi-tickets-abertos').textContent =
    ticketsAbertos.length
  document.getElementById(
    'kpi-faturamento'
  ).textContent = `R$ ${faturamentoTotal.toFixed(2).replace('.', ',')}`
  document.getElementById('kpi-ticket-medio').textContent = ticketMedioTexto
  document.getElementById('kpi-tempo-medio').textContent = tempoMedioTexto
}

// Calcula tempo médio de permanência
function calcularTempoMedio (ticketsFechados) {
  const validos = ticketsFechados.filter(t => t.dataEntrada && t.dataSaida)
  if (validos.length === 0) return 'Nenhum dado disponível'

  const totalMs = validos.reduce((acc, t) => {
    const entrada = new Date(t.dataEntrada)
    const saida = new Date(t.dataSaida)
    return acc + Math.max(0, saida - entrada)
  }, 0)

  const mediaMinutos = Math.round(totalMs / validos.length / 60000)
  const horas = Math.floor(mediaMinutos / 60)
  const minutos = mediaMinutos % 60

  if (horas === 0 && minutos === 0) return 'Menos de 1m'
  return `${horas}h ${minutos}m`
}

// Renderização do Ranking das Vagas Mais Utilizadas (Requisito 2.6)
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

  // Contabiliza total de uso (tickets associados) por id da vaga
  const contagemUso = {}
  tickets.forEach(ticket => {
    if (ticket.vagaId) {
      const vId = String(ticket.vagaId)
      contagemUso[vId] = (contagemUso[vId] || 0) + 1
    }
  })

  // Mapeia as vagas adicionando o total de usos e ordena do maior para o menor
  const ranking = vagas
    .map(vaga => ({
      ...vaga,
      totalUso: contagemUso[String(vaga.id)] || 0
    }))
    .sort((a, b) => b.totalUso - a.totalUso)

  ranking.forEach((item, index) => {
    const tr = document.createElement('tr')

    // Destaque visual para o top 3
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
          <i class="fas fa-check-circle text-success me-2" aria-hidden="true"></i>Nenhum ticket aberto no momento.
        </td>
      </tr>
    `
    return
  }

  ticketsAbertos.forEach(ticket => {
    const vaga = vagas.find(v => String(v.id) === String(ticket.vagaId))
    const identificadorVaga = vaga
      ? `${vaga.codigo} (${vaga.tipo})`
      : ticket.vagaId

    const horaEntrada = new Date(ticket.dataEntrada).toLocaleTimeString(
      'pt-BR',
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    )

    const mensalista = ticket.mensalistaId
      ? mensalistas.find(m => String(m.id) === String(ticket.mensalistaId))
      : null
    const clienteHtml = mensalista
      ? `<span class="badge-status status-mensalista"><i class="fas fa-id-card me-1" aria-hidden="true"></i>${ApiService.sanitizeText(
          mensalista.nome
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

// Função de Encerramento do Ticket
async function encerrarTicket (ticketId, botao) {
  const result = await Swal.fire({
    title: 'Confirmar Saída?',
    text: 'O valor será calculado de acordo com o tempo de permanência ou regramento de mensalista.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#0e3a2f',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Sim, finalizar',
    cancelButtonText: 'Cancelar'
  })

  if (!result.isConfirmed) return

  if (botao) botao.disabled = true // Previne clique duplo

  try {
    const ticketFinalizado = await ApiService.fecharTicket(ticketId)
    const valorFinal = Number(ticketFinalizado.valorTotal) || 0

    Swal.fire({
      icon: 'success',
      title: 'Ticket Finalizado!',
      text: `Valor Total a Pagar: R$ ${valorFinal
        .toFixed(2)
        .replace('.', ',')}`,
      confirmButtonColor: '#0e3a2f'
    })

    await loadDashboardData()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao fechar ticket',
      text: error.message
    })
    if (botao) botao.disabled = false
  }
}
