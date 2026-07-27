/**
 * Lógica do Dashboard Principal
 * Inicializa os KPIs, tabela de tickets recentes e o efeito Vanta.js
 */

document.addEventListener('DOMContentLoaded', async () => {
  initVantaBackground()
  await loadDashboardData()

  document
    .getElementById('btn-retry-dashboard')
    ?.addEventListener('click', () => {
      loadDashboardData()
    })
})

// Inicialização da animação de fundo interativa
// NOTA: usa VANTA.WAVES — o index.html precisa carregar vanta.waves.min.js
// (não vanta.topology.min.js, que expõe um efeito diferente).
function initVantaBackground () {
  const jaReduzido =
    document.documentElement.classList.contains('reduce-motion') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (jaReduzido) return // respeita a preferência de redução de movimento

  if (
    typeof VANTA !== 'undefined' &&
    typeof VANTA.WAVES === 'function' &&
    document.getElementById('vanta-bg')
  ) {
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

    atualizarKPIs(vagas, tickets)
    renderTicketsRecentes(
      tickets.filter(t => (t.status || '').toLowerCase() === 'aberto'),
      vagas,
      mensalistas
    )
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

  // Taxa de ocupação: % de vagas "ocupada" em relação ao total de vagas
  const taxaOcupacao = totalVagas > 0 ? (vagasOcupadas / totalVagas) * 100 : 0

  // Faturamento TOTAL: soma de todos os tickets fechados (sem recorte de data —
  // tickets em aberto ainda não têm valorTotal definido)
  const faturamentoTotal = ticketsFechados.reduce(
    (acc, t) => acc + (Number(t.valorTotal) || 0),
    0
  )

  // Ticket médio = faturamento total / quantidade de tickets fechados
  const ticketMedio =
    ticketsFechados.length > 0 ? faturamentoTotal / ticketsFechados.length : 0

  // Tempo médio de permanência dos tickets fechados (dataSaida - dataEntrada)
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
  document.getElementById('kpi-ticket-medio').textContent = `R$ ${ticketMedio
    .toFixed(2)
    .replace('.', ',')}`
  document.getElementById('kpi-tempo-medio').textContent = tempoMedioTexto
}

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
  return `${horas}h ${minutos}m`
}

// Renderização dos Tickets na Tabela (colunas: Placa, Vaga, Entrada, Cliente, Ação)
function renderTicketsRecentes (ticketsAbertos, vagas, mensalistas) {
  const tbody = document.getElementById('tbody-tickets-recentes')
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
    const vaga = vagas.find(v => v.id === ticket.vagaId)
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
      ? mensalistas.find(m => m.id === ticket.mensalistaId)
      : null
    const clienteHtml = mensalista
      ? `<span class="badge-status status-mensalista"><i class="fas fa-id-card" aria-hidden="true"></i> ${ApiService.sanitizeText(
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
    confirmButtonColor: '#0e3a2f', // $color-sucesso-text
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Sim, finalizar',
    cancelButtonText: 'Cancelar'
  })

  if (!result.isConfirmed) return

  if (botao) botao.disabled = true // anti duplo-clique

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
