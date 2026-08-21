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
const TEMPO_TOLERANCIA_MINUTOS = 15 // Deve refletir a mesma tolerância usada em ApiService.fecharTicket

// Últimos conjuntos de vagas/tickets usados para calcular os KPIs (já
// considerando o filtro por tipo de vaga ativo), usados pelo modal de
// detalhes dos cards.
let kpiVagasAtual = []
let kpiTicketsAtual = []

// Vagas/mensalistas usados para montar cada linha da tabela de tickets
// ativos (renderLinhaTicketRecente só recebe o ticket + o tbody).
let vagasParaTicketsRecentes = []
let mensalistasParaTicketsRecentes = []

/**
 * Cria um paginador genérico para uma tabela: guarda a lista completa de
 * itens, renderiza só a página atual e mantém os controles (texto "Mostrando
 * X–Y de Z", botões anterior/próxima e o seletor de itens por página)
 * sincronizados. Usado pelas tabelas de "Tickets Ativos" e "Ranking de
 * Vagas" do dashboard, que precisam do mesmo comportamento.
 */
function criarPaginador ({
  idSufixo,
  tbodyId,
  tamanhoPadrao = 10,
  renderLinha,
  colspanVazio,
  textoVazio,
  aposRenderizar
}) {
  const estado = { itens: [], pagina: 1, tamanho: tamanhoPadrao }

  function renderizar () {
    const tbody = document.getElementById(tbodyId)
    if (!tbody) return
    tbody.innerHTML = ''

    const infoEl = document.getElementById(`paginacao-info-${idSufixo}`)
    const labelEl = document.getElementById(`pagina-atual-label-${idSufixo}`)
    const btnAnterior = document
      .getElementById(`btn-pagina-anterior-${idSufixo}`)
      ?.closest('.page-item')
    const btnProxima = document
      .getElementById(`btn-pagina-proxima-${idSufixo}`)
      ?.closest('.page-item')

    const total = estado.itens.length

    if (total === 0) {
      tbody.innerHTML = `<tr><td colspan="${colspanVazio}" class="text-center py-4 text-muted">${textoVazio}</td></tr>`
      if (infoEl) infoEl.textContent = 'Mostrando 0 de 0'
      if (labelEl) labelEl.textContent = '1'
      btnAnterior?.classList.add('disabled')
      btnProxima?.classList.add('disabled')
      return
    }

    const totalPaginas = Math.max(1, Math.ceil(total / estado.tamanho))
    estado.pagina = Math.min(estado.pagina, totalPaginas)
    const inicio = (estado.pagina - 1) * estado.tamanho
    const fim = Math.min(inicio + estado.tamanho, total)

    estado.itens.slice(inicio, fim).forEach(item => renderLinha(item, tbody))
    aposRenderizar?.(tbody)

    if (infoEl) { infoEl.textContent = `Mostrando ${inicio + 1}–${fim} de ${total}` }
    if (labelEl) labelEl.textContent = `${estado.pagina} de ${totalPaginas}`
    btnAnterior?.classList.toggle('disabled', estado.pagina === 1)
    btnProxima?.classList.toggle('disabled', estado.pagina === totalPaginas)
  }

  document
    .getElementById(`btn-pagina-anterior-${idSufixo}`)
    ?.addEventListener('click', () => {
      if (estado.pagina > 1) {
        estado.pagina--
        renderizar()
      }
    })

  document
    .getElementById(`btn-pagina-proxima-${idSufixo}`)
    ?.addEventListener('click', () => {
      const totalPaginas = Math.max(
        1,
        Math.ceil(estado.itens.length / estado.tamanho)
      )
      if (estado.pagina < totalPaginas) {
        estado.pagina++
        renderizar()
      }
    })

  document
    .getElementById(`select-tamanho-pagina-${idSufixo}`)
    ?.addEventListener('change', e => {
      estado.tamanho = Number(e.target.value) || tamanhoPadrao
      estado.pagina = 1
      renderizar()
    })

  return {
    definirItens (itens) {
      estado.itens = itens
      estado.pagina = 1
      renderizar()
    }
  }
}

const paginadorTicketsRecentes = criarPaginador({
  idSufixo: 'tickets-recentes',
  tbodyId: 'tbody-tickets-recentes',
  colspanVazio: 5,
  textoVazio:
    '<i class="fas fa-check-circle text-success me-2" aria-hidden="true"></i>Nenhum ticket aberto encontrado.',
  renderLinha: (item, tbody) => renderLinhaTicketRecente(item, tbody),
  aposRenderizar: ligarBotoesFecharTicketRecente
})

const paginadorRanking = criarPaginador({
  idSufixo: 'ranking',
  tbodyId: 'tbody-ranking-vagas',
  colspanVazio: 4,
  textoVazio: 'Nenhuma vaga cadastrada.',
  renderLinha: (item, tbody) => renderLinhaRanking(item, tbody)
})

document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardData()

  // "Biscoito da sorte": só aparece uma vez, logo após o login.
  if (typeof mostrarFraseMotivacionalSeAplicavel === 'function') {
    mostrarFraseMotivacionalSeAplicavel()
  }

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

  // === MODAL DE DETALHES AO CLICAR NOS CARDS DE KPI ===
  document.querySelectorAll('.card-kpi[data-kpi]').forEach(card => {
    card.addEventListener('click', () => abrirDetalhesKpi(card.dataset.kpi))
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        abrirDetalhesKpi(card.dataset.kpi)
      }
    })
  })
})

/**
 * Abre um modal com o detalhamento dos dados por trás de um card de KPI,
 * usando o mesmo conjunto de vagas/tickets já filtrado que gerou o número
 * exibido no card (respeita o filtro por tipo de vaga ativo).
 */
function abrirDetalhesKpi (chave) {
  if (typeof Swal === 'undefined') return

  const vagas = kpiVagasAtual
  const tickets = kpiTicketsAtual

  const listaPorTipo = filtro => {
    const contagem = vagas.filter(filtro).reduce((acc, v) => {
      const tipo = (v.tipo || 'comum').toLowerCase()
      acc[tipo] = (acc[tipo] || 0) + 1
      return acc
    }, {})

    const itens = Object.entries(contagem)
      .map(
        ([tipo, qtd]) =>
          `<li>${tipo.charAt(0).toUpperCase() + tipo.slice(1)}: <strong>${qtd}</strong></li>`
      )
      .join('')

    return itens || '<li class="text-muted">Nenhuma vaga nesta condição.</li>'
  }

  const ticketsFechados = tickets.filter(
    t => (t.status || '').toLowerCase() === 'fechado'
  )
  const faturamentoTotal = ticketsFechados.reduce(
    (acc, t) => acc + (Number(t.valorTotal ?? t.valorCobrado) || 0),
    0
  )

  let title = ''
  let html = ''

  switch (chave) {
    case 'vagas-livres':
      title = 'Vagas Livres'
      html = `<p class="text-muted mb-2">Vagas com status "livre", disponíveis para novos veículos, por tipo:</p>
        <ul class="text-start">${listaPorTipo(v => (v.status || '').toLowerCase() === 'livre')}</ul>`
      break
    case 'vagas-ocupadas':
      title = 'Vagas Ocupadas'
      html = `<p class="text-muted mb-2">Vagas com um ticket aberto no momento, por tipo:</p>
        <ul class="text-start">${listaPorTipo(v => (v.status || '').toLowerCase() === 'ocupada')}</ul>`
      break
    case 'vagas-manutencao':
      title = 'Vagas em Manutenção'
      html = `<p class="text-muted mb-2">Vagas bloqueadas manualmente e indisponíveis para uso, por tipo:</p>
        <ul class="text-start">${listaPorTipo(v => (v.status || '').toLowerCase() === 'manutencao')}</ul>`
      break
    case 'taxa-ocupacao': {
      const ocupadas = vagas.filter(
        v => (v.status || '').toLowerCase() === 'ocupada'
      ).length
      const total = vagas.length
      const taxa = total > 0 ? ((ocupadas / total) * 100).toFixed(1) : '0.0'
      title = 'Taxa de Ocupação'
      html = `<p class="text-muted mb-2">Percentual de vagas ocupadas em relação ao total cadastrado (considerando o filtro de tipo ativo).</p>
        <p class="fs-5 mb-0"><strong>${ocupadas}</strong> ocupadas de <strong>${total}</strong> vagas = <strong>${taxa}%</strong></p>`
      break
    }
    case 'tickets-abertos': {
      const abertos = tickets.filter(
        t => (t.status || '').toLowerCase() === 'aberto'
      )
      title = 'Tickets Abertos'
      html = `<p class="text-muted mb-2">Veículos atualmente estacionados, ainda sem saída registrada.</p>
        <p class="fs-5 mb-0"><strong>${abertos.length}</strong> ticket(s) em aberto no momento.</p>`
      break
    }
    case 'faturamento':
      title = 'Faturamento Total'
      html = `<p class="text-muted mb-2">Soma do valor cobrado de todos os tickets já fechados. Tickets abertos não entram no cálculo, pois ainda não têm valor final.</p>
        <p class="fs-5 mb-0"><strong>${ticketsFechados.length}</strong> ticket(s) fechado(s) somam <strong>R$ ${faturamentoTotal
        .toFixed(2)
        .replace('.', ',')}</strong>.</p>`
      break
    case 'ticket-medio': {
      const medio =
        ticketsFechados.length > 0 ? faturamentoTotal / ticketsFechados.length : 0
      title = 'Ticket Médio'
      html = `<p class="text-muted mb-2">Faturamento total dividido pela quantidade de tickets fechados.</p>
        <p class="fs-5 mb-0">R$ ${faturamentoTotal
          .toFixed(2)
          .replace('.', ',')} ÷ ${ticketsFechados.length} ticket(s) = <strong>R$ ${medio
        .toFixed(2)
        .replace('.', ',')}</strong></p>`
      break
    }
    case 'tempo-medio': {
      const comTempo = ticketsFechados.filter(
        t => (t.horaEntrada || t.dataEntrada) && (t.horaSaida || t.dataSaida)
      )
      title = 'Tempo Médio de Permanência'
      html = `<p class="text-muted mb-2">Média do tempo entre entrada e saída de todos os tickets fechados com esses dois horários registrados.</p>
        <p class="fs-5 mb-0">Calculado sobre <strong>${comTempo.length}</strong> ticket(s) fechado(s).</p>`
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

    // Atualiza o contador de capacidade do hero (antes fixo em "240 Vagas Monitoradas")
    const elTotalVagasHero = document.getElementById('hero-total-vagas')
    if (elTotalVagasHero) {
      const totalVagas = globalVagas.length
      elTotalVagasHero.textContent = `${totalVagas} ${
        totalVagas === 1 ? 'Vaga Monitorada' : 'Vagas Monitoradas'
      }`
    }
  } catch (error) {
    console.error('Erro ao carregar dados do dashboard:', error)

    // Sessão expirada (401) já é tratada por AuthService.tratarSessaoExpirada
    // — logout + redirect pro login já disparados a essa altura. Mostrar o
    // aviso genérico de conexão aqui só confundiria (e some sozinho assim
    // que a navegação para o login completar).
    if (typeof AuthService !== 'undefined' && !AuthService.estaLogado()) {
      return
    }

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
  kpiVagasAtual = vagas
  kpiTicketsAtual = tickets

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

  const animar =
    typeof animarContadorGsap === 'function'
      ? animarContadorGsap
      : (el, valor, opcoes) => {
          if (el) el.textContent = opcoes?.formatar ? opcoes.formatar(valor) : valor
        }

  animar(document.getElementById('kpi-vagas-livres'), vagasLivres)
  animar(document.getElementById('kpi-vagas-ocupadas'), vagasOcupadas)
  animar(document.getElementById('kpi-vagas-manutencao'), vagasManutencao)
  animar(document.getElementById('kpi-taxa-ocupacao'), taxaOcupacao, {
    formatar: v => `${v.toFixed(1)}%`
  })
  animar(document.getElementById('kpi-tickets-abertos'), ticketsAbertos.length)
  animar(document.getElementById('kpi-faturamento'), faturamentoTotal, {
    formatar: v => `R$ ${v.toFixed(2).replace('.', ',')}`
  })

  const elTicketMedio = document.getElementById('kpi-ticket-medio')
  if (elTicketMedio) {
    if (ticketsFechados.length > 0) {
      animar(elTicketMedio, faturamentoTotal / ticketsFechados.length, {
        formatar: v => `R$ ${v.toFixed(2).replace('.', ',')}`
      })
    } else {
      elTicketMedio.textContent = ticketMedioTexto
    }
  }
  if (document.getElementById('kpi-tempo-medio')) { document.getElementById('kpi-tempo-medio').textContent = tempoMedioTexto }
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
  if (!vagas || vagas.length === 0) {
    paginadorRanking.definirItens([])
    return
  }

  const contagemUso = {}
  tickets.forEach(ticket => {
    if (ticket.vagaId) {
      const vId = String(ticket.vagaId)
      contagemUso[vId] = (contagemUso[vId] || 0) + 1
    }
  })

  // A posição (1º, 2º, 3º...) precisa ser calculada sobre o ranking
  // completo, antes de paginar — senão cada página reiniciaria em "1º".
  const ranking = vagas
    .map(vaga => ({
      ...vaga,
      totalUso: contagemUso[String(vaga.id)] || 0
    }))
    .sort((a, b) => b.totalUso - a.totalUso)
    .map((item, index) => ({ ...item, posicao: index + 1 }))

  paginadorRanking.definirItens(ranking)
}

function renderLinhaRanking (item, tbody) {
  const tr = document.createElement('tr')

  let badgePosicao = `<span class="fw-bold text-muted">${item.posicao}º</span>`
  if (item.posicao === 1) { badgePosicao = '<span class="badge bg-warning text-dark"><i class="fas fa-crown me-1"></i>1º</span>' } else if (item.posicao === 2) { badgePosicao = '<span class="badge bg-secondary">2º</span>' } else if (item.posicao === 3) { badgePosicao = '<span class="badge bg-dark">3º</span>' }

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
}

// Renderização dos Tickets na Tabela Ativa
function renderTicketsRecentes (ticketsAbertos, vagas, mensalistas) {
  vagasParaTicketsRecentes = vagas
  mensalistasParaTicketsRecentes = mensalistas
  paginadorTicketsRecentes.definirItens(ticketsAbertos)
}

function renderLinhaTicketRecente (ticket, tbody) {
  const vaga = vagasParaTicketsRecentes.find(
    v => String(v.id) === String(ticket.vagaId)
  )
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
    ? mensalistasParaTicketsRecentes.find(
      m => String(m.id) === String(ticket.mensalistaId)
    )
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
}

function ligarBotoesFecharTicketRecente (tbody) {
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
  let previsaoCiclo = null

  if (ehMensalista) {
    const mensalista = globalMensalistas.find(m => String(m.id) === String(ticket.mensalistaId))
    // Prévia client-side do ciclo de 30 dias — espelha a regra real do
    // backend (ver assets/js/modules/mensalista-ciclo.js).
    const mensalidadesDoMensalista = await ApiService.getMensalidades(ticket.mensalistaId)
    previsaoCiclo = preverCicloMensalista(
      mensalidadesDoMensalista,
      ticket.dataEntrada || ticket.horaEntrada,
      mensalista?.valorMensalidade
    )
    valorCalculado = previsaoCiclo.valor
  } else if (diffMinutos <= TEMPO_TOLERANCIA_MINUTOS) {
    valorCalculado = 0
  } else {
    const valorHora = tarifa ? Number(tarifa.valorHora || tarifa.valor || 0) : 0
    const diffHoras = diffMs / (1000 * 60 * 60)
    const horasPagas = Math.max(1, Math.ceil(diffHoras))
    valorCalculado = horasPagas * valorHora
  }

  const avisoMensalista = previsaoCiclo?.cobraAgora
    ? `<div class="alert alert-warning py-2 mb-3">
        <strong>Novo ciclo de 30 dias:</strong> sem ciclo vigente — liberado até
        <strong>${formatarDataCicloMensalista(previsaoCiclo.dataFim)}</strong>.
      </div>`
    : `<div class="alert alert-info py-2 mb-3">
        <strong>Mensalista liberado:</strong> ciclo já pago, válido até
        <strong>${formatarDataCicloMensalista(previsaoCiclo?.dataFim)}</strong>.
      </div>`

  const selectPagamentoHTML = ehMensalista
    ? `${avisoMensalista}${
        previsaoCiclo?.cobraAgora
          ? `<div class="mb-3 text-start">
              <label for="swal-dashboard-pagamento" class="form-label fw-semibold">Forma de Pagamento:</label>
              <select id="swal-dashboard-pagamento" class="form-select">
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
      if (ehMensalista && !previsaoCiclo?.cobraAgora) return 'isento'
      const select = document.getElementById('swal-dashboard-pagamento')
      return select ? select.value : 'pix'
    }
  })

  if (!isConfirmed) return

  if (botao) botao.disabled = true

  try {
    // ApiService.fecharTicket é o único ponto que calcula e persiste o valor
    // cobrado, garantindo que ele nunca divirja do valor mostrado acima.
    const resultado = await ApiService.fecharTicket(ticketId, { formaPagamento })

    const vaga = globalVagas.find(
      v => String(v.id) === String(ticket.vagaId)
    )

    const ciclo = resultado?.mensalistaCiclo
    const htmlMensalista = ciclo
      ? `<p class="mt-2 mb-0 text-muted">${
          ciclo.cobradoAgora
            ? `<strong>Mensalista:</strong> novo ciclo cobrado agora. Liberado até <strong>${formatarDataCicloMensalista(ciclo.dataFim)}</strong>.`
            : `<strong>Mensalista:</strong> valor já cobrado e pago pelo cliente. Liberado até <strong>${formatarDataCicloMensalista(ciclo.dataFim)}</strong>.`
        }</p>`
      : ''

    const { isDenied } = await Swal.fire({
      icon: 'success',
      title: 'Saída Registrada!',
      html: `<p class="mb-0">Veículo ${ApiService.sanitizeText(ticket.placa)} liberado com sucesso.</p>${htmlMensalista}`,
      confirmButtonColor: '#0e3a2f',
      confirmButtonText: 'OK',
      showDenyButton: true,
      denyButtonText: '<i class="fas fa-file-pdf me-1"></i>Comprovante',
      denyButtonColor: '#0d6efd'
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
        valor: valorCalculado
      })
    }

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
