/**
 * Lógica do Dashboard Principal
 * Inicializa os KPIs, tabela de tickets recentes e o efeito Vanta.js
 */

document.addEventListener('DOMContentLoaded', async () => {
  initVantaBackground()
  await loadDashboardData()
})

// Inicialização da animação de fundo interativa
function initVantaBackground () {
  if (typeof VANTA !== 'undefined' && document.getElementById('vanta-bg')) {
    VANTA.WAVES({
      el: '#vanta-bg',
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.0,
      minWidth: 200.0,
      scale: 1.0,
      scaleMobile: 1.0,
      color: 0x0d6efd,
      shininess: 35.0,
      waveHeight: 15.0,
      waveSpeed: 0.65,
      zoom: 0.85
    })
  }
}

// Carregamento dos Dados do Dashboard
async function loadDashboardData () {
  try {
    const [vagas, tickets] = await Promise.all([
      ApiService.getVagas(),
      ApiService.getTickets()
    ])

    // Cálculo dos KPIs
    const vagasLivres = vagas.filter(v => v.status === 'Livre').length
    const vagasOcupadas = vagas.filter(v => v.status === 'Ocupada').length
    const ticketsAbertos = tickets.filter(t => t.status === 'Aberto')

    // Cálculo do Faturamento do dia
    const hojeStr = new Date().toISOString().split('T')[0]
    const faturamentoHoje = tickets
      .filter(
        t =>
          t.status === 'Pago' && t.dataSaida && t.dataSaida.startsWith(hojeStr)
      )
      .reduce((acc, t) => acc + (t.valorTotal || 0), 0)

    // Atualiza os cards de KPI na tela
    document.getElementById('kpi-vagas-livres').textContent = vagasLivres
    document.getElementById('kpi-vagas-ocupadas').textContent = vagasOcupadas
    document.getElementById('kpi-tickets-abertos').textContent =
      ticketsAbertos.length
    document.getElementById(
      'kpi-faturamento'
    ).textContent = `R$ ${faturamentoHoje.toFixed(2).replace('.', ',')}`

    // Renderiza a tabela de tickets ativos
    renderTicketsRecentes(ticketsAbertos, vagas)
  } catch (error) {
    console.error('Erro ao carregar dados do dashboard:', error)
    Swal.fire({
      icon: 'error',
      title: 'Erro de Conexão',
      text: 'Não foi possível carregar os dados do backend (json-server).'
    })
  }
}

// Renderização dos Tickets na Tabela
function renderTicketsRecentes (ticketsAbertos, vagas) {
  const tbody = document.getElementById('tbody-tickets-recentes')
  tbody.innerHTML = ''

  if (ticketsAbertos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-muted">
          <i class="fas fa-check-circle text-success me-2"></i>Nenhum ticket aberto no momento.
        </td>
      </tr>
    `
    return
  }

  ticketsAbertos.forEach(ticket => {
    const vaga = vagas.find(v => v.id === ticket.vagaId)
    const identificadorVaga = vaga
      ? `${vaga.codigo} (${vaga.tipo})`
      : ticket.vagaId
    const horaEntrada = new Date(ticket.dataEntrada).toLocaleTimeString(
      'pt-BR',
      { hour: '2-digit', minute: '2-digit' }
    )
    const isMensalista = ticket.mensalistaId
      ? '<span class="badge bg-info">Mensalista</span>'
      : '<span class="badge bg-secondary">Avulso</span>'

    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td class="fw-bold">${ApiService.sanitizeText(ticket.placa)}</td>
      <td>${ApiService.sanitizeText(ticket.tipoVeiculo)}</td>
      <td><span class="badge bg-light text-dark border">${ApiService.sanitizeText(
        identificadorVaga
      )}</span></td>
      <td>${horaEntrada}</td>
      <td>${isMensalista}</td>
      <td>
        <button class="btn btn-sm btn-outline-danger btn-fechar-ticket" data-id="${
          ticket.id
        }">
          <i class="fas fa-sign-out-alt me-1"></i>Dar Saída
        </button>
      </td>
    `

    tbody.appendChild(tr)
  })

  // Vincular eventos dos botões de saída
  document.querySelectorAll('.btn-fechar-ticket').forEach(btn => {
    btn.addEventListener('click', async e => {
      const ticketId = e.currentTarget.getAttribute('data-id')
      await encerrarTicket(ticketId)
    })
  })
}

// Função de Encerramento do Ticket
async function encerrarTicket (ticketId) {
  const result = await Swal.fire({
    title: 'Confirmar Saída?',
    text: 'O valor será calculado de acordo com o tempo de permanência ou regramento de mensalista.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#198754',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Sim, finalizar',
    cancelButtonText: 'Cancelar'
  })

  if (result.isConfirmed) {
    try {
      const ticketFinalizado = await ApiService.fecharTicket(ticketId)
      Swal.fire({
        icon: 'success',
        title: 'Ticket Finalizado!',
        text: `Valor Total a Pagar: R$ ${ticketFinalizado.valorTotal
          .toFixed(2)
          .replace('.', ',')}`,
        confirmButtonColor: '#0d6efd'
      })
      // Recarrega os dados para atualizar a tela
      loadDashboardData()
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Erro ao fechar ticket',
        text: error.message
      })
    }
  }
}
