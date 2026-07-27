/**
 * Lógica da Página de Tickets
 * Controle de emissão, listagem, busca, paginação, regras de mensalista e baixa de tickets.
 */

let allTickets = []
let allVagas = []
let allMensalistas = []
let allTarifas = []

let ticketsFiltrados = []
let paginaAtual = 1
const TICKETS_POR_PAGINA = 10

document.addEventListener('DOMContentLoaded', async () => {
  initInputMasks()
  await carregarDados()

  // Busca por placa/vaga (reseta para a primeira página a cada nova busca)
  document
    .getElementById('input-busca-ticket')
    ?.addEventListener('input', () => {
      paginaAtual = 1
      filtrarTickets()
    })

  // Filtro de status do ticket (Todos, Aberto, Fechado)
  document
    .getElementById('filtro-status-ticket')
    ?.addEventListener('change', () => {
      paginaAtual = 1
      filtrarTickets()
    })

  // Verificação de mensalista ao digitar a placa no modal de novo ticket
  const inputPlaca = document.getElementById('ticket-placa')
  inputPlaca?.addEventListener('input', e => {
    verificarMensalistaNaDigitacao(e.target.value)
  })

  document
    .getElementById('form-novo-ticket')
    ?.addEventListener('submit', criarNovoTicket)

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

// Formatador e máscara simples do input da placa
function initInputMasks () {
  const placaInput = document.getElementById('ticket-placa')
  placaInput?.addEventListener('input', e => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (value.length > 7) value = value.slice(0, 7)
    e.target.value = value
  })
}

// Algoritmo de Validação de Placa (Mercosul ou Padrão Antigo)
function validarPlaca (placa) {
  const cleanPlaca = (placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const regexAntigo = /^[A-Z]{3}[0-9]{4}$/
  const regexMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/
  return regexAntigo.test(cleanPlaca) || regexMercosul.test(cleanPlaca)
}

// Carrega os dados das APIs
async function carregarDados () {
  const pageError = document.getElementById('page-error')
  const pageErrorText = document.getElementById('page-error-text')
  const tbody = document.getElementById('tbody-tickets')

  pageError?.classList.add('d-none')
  tbody?.setAttribute('aria-busy', 'true')

  try {
    const [tickets, vagas, mensalistas, tarifas] = await Promise.all([
      ApiService.getTickets ? ApiService.getTickets() : Promise.resolve([]),
      ApiService.getVagas ? ApiService.getVagas() : Promise.resolve([]),
      ApiService.getMensalistas
        ? ApiService.getMensalistas()
        : Promise.resolve([]),
      ApiService.getTarifas ? ApiService.getTarifas() : Promise.resolve([])
    ])

    allTickets = tickets || []
    allVagas = vagas || []
    allMensalistas = mensalistas || []
    allTarifas = tarifas || []

    paginaAtual = 1
    filtrarTickets()

    preencherSelectVagas()
    preencherSelectTarifas()
    preencherSelectMensalistas()
    atualizarAvisoFormulario()
  } catch (error) {
    console.error('Erro ao carregar dados dos tickets:', error)

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

// Renderiza a tabela de tickets paginada
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

  const total = ticketsFiltrados.length

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

  // Adiciona o ouvinte para botões de fechamento de ticket
  tbody.querySelectorAll('.btn-fechar-ticket').forEach(btn => {
    btn.addEventListener('click', async e => {
      const ticketId = e.currentTarget.getAttribute('data-id')
      await finalizarTicket(ticketId)
    })
  })
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

  const btnAcao =
    statusKey === 'aberto'
      ? `<button type="button" class="btn btn-sm btn-outline-danger btn-fechar-ticket" data-id="${ticket.id}">
         <i class="fas fa-sign-out-alt me-1" aria-hidden="true"></i>Fechar Ticket
       </button>`
      : '<span class="text-muted text-xs">Finalizado</span>'

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
    <td class="fw-bold text-primary">${valorStr}</td>
    <td>${statusBadge}</td>
    <td>${btnAcao}</td>
  `
  tbody.appendChild(tr)
}

// Filtro por termo (placa ou código da vaga) e status do ticket
function filtrarTickets () {
  const termo = (document.getElementById('input-busca-ticket')?.value || '')
    .trim()
    .toUpperCase()
  const statusFiltro = (
    document.getElementById('filtro-status-ticket')?.value || 'TODOS'
  ).toLowerCase()

  const ordenados = [...allTickets].sort((a, b) => {
    const dataA = new Date(a.horaEntrada || a.dataEntrada || 0)
    const dataB = new Date(b.horaEntrada || b.dataEntrada || 0)
    return dataB - dataA
  })

  ticketsFiltrados = ordenados.filter(t => {
    const combinaStatus =
      statusFiltro === 'todos' ||
      (t.status || '').toLowerCase() === statusFiltro

    const vaga = allVagas.find(v => String(v.id) === String(t.vagaId))
    const codigoVaga = vaga
      ? String(vaga.codigo || vaga.numero || '').toUpperCase()
      : ''

    const combinaTermo =
      !termo ||
      (t.placa || '').toUpperCase().includes(termo) ||
      codigoVaga.includes(termo)

    return combinaStatus && combinaTermo
  })

  renderizarPagina()
}

// Preenche o combo de Vagas (apenas status "livre")
function preencherSelectVagas () {
  const selectVaga = document.getElementById('ticket-vaga')
  if (!selectVaga) return

  selectVaga.innerHTML =
    '<option value="" selected disabled>Selecione uma vaga livre...</option>'

  const vagasLivres = allVagas.filter(
    v => (v.status || 'livre').toLowerCase() === 'livre'
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

  allMensalistas
    .filter(m => {
      const ehAtivoBool =
        m.ativo === true || String(m.ativo).toLowerCase() === 'true'
      const ehAtivoStatus =
        m.status && String(m.status).toLowerCase() === 'ativo'
      return ehAtivoBool || ehAtivoStatus
    })
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
    infoDiv.innerHTML = `<span class="text-success fw-semibold"><i class="fas fa-check-circle me-1" aria-hidden="true"></i> Mensalista Ativo: ${ApiService.sanitizeText(
      mensalistaEncontrado.nome || mensalistaEncontrado.nomeCliente
    )} (Isento)</span>`
    if (selectMensalista) selectMensalista.value = mensalistaEncontrado.id
  } else {
    infoDiv.innerHTML = `<span class="text-muted"><i class="fas fa-info-circle me-1" aria-hidden="true"></i> Veículo avulso (tarifado normalmente)</span>`
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

  // Regra: Impede ticket duplo para a mesma placa no pátio
  const jaAberto = allTickets.some(
    t =>
      (t.placa || '').toUpperCase() === placa &&
      (t.status || 'aberto').toLowerCase() === 'aberto'
  )

  if (jaAberto) {
    Swal.fire({
      icon: 'warning',
      title: 'Veículo no Pátio',
      text: `A placa ${placa} já possui um ticket aberto registrado.`
    })
    return
  }

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
      status: 'aberto'
    }

    if (ApiService.criarTicket) {
      await ApiService.criarTicket(novoTicket)
    } else {
      await ApiService.createTicket(novoTicket)
    }

    // Regra: Muda status da vaga para "ocupada"
    if (ApiService.updateVagaStatus) {
      await ApiService.updateVagaStatus(vagaId, 'ocupada')
    }

    Swal.fire({
      icon: 'success',
      title: 'Ticket Emitido!',
      text: `Entrada da placa ${placa} registrada com sucesso.`,
      timer: 1800,
      showConfirmButton: false
    })

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

// Fechamento de Ticket e Cálculo de Cobrança (Item 5.1 & 5.2)
async function finalizarTicket (ticketId) {
  const confirmacao = await Swal.fire({
    title: 'Fechar Ticket?',
    text: 'O valor cobrado será calculado e a vaga ficará livre.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#0e3a2f',
    confirmButtonText: 'Sim, fechar ticket',
    cancelButtonText: 'Cancelar'
  })

  if (!confirmacao.isConfirmed) return

  const botao = document.querySelector(
    `.btn-fechar-ticket[data-id="${ticketId}"]`
  )
  if (botao) botao.disabled = true

  try {
    const ticket = allTickets.find(t => String(t.id) === String(ticketId))
    if (!ticket) throw new Error('Ticket não encontrado.')

    const tarifa = allTarifas.find(
      t => String(t.id) === String(ticket.tarifaId)
    )
    const horaEntrada = new Date(
      ticket.horaEntrada || ticket.dataEntrada || Date.now()
    )
    const horaSaida = new Date()

    let valorCalculado = 0

    // Regra: Mensalista cobrado R$ 0,00 (Item 5.2)
    if (ticket.mensalistaId) {
      valorCalculado = 0
    } else {
      const valorHora = tarifa
        ? Number(tarifa.valorHora || tarifa.valor || 0)
        : 0
      const diffHoras = (horaSaida - horaEntrada) / (1000 * 60 * 60)
      const horasPagas = Math.max(1, Math.ceil(diffHoras)) // Fração de hora arredonda pra cima
      valorCalculado = horasPagas * valorHora
    }

    const ticketAtualizado = {
      ...ticket,
      horaSaida: horaSaida.toISOString(),
      dataSaida: horaSaida.toISOString(),
      valorCobrado: valorCalculado,
      valorTotal: valorCalculado,
      status: 'fechado'
    }

    if (ApiService.fecharTicket) {
      await ApiService.fecharTicket(ticketId, ticketAtualizado)
    } else if (ApiService.updateTicket) {
      await ApiService.updateTicket(ticketId, ticketAtualizado)
    }

    // Regra: Devolve a vaga para o status "livre" (Item 5.1)
    if (ticket.vagaId && ApiService.updateVagaStatus) {
      await ApiService.updateVagaStatus(ticket.vagaId, 'livre')
    }

    Swal.fire({
      icon: 'success',
      title: 'Ticket Encerrado!',
      html: `
        <div class="text-center">
          <p class="mb-1">Placa: <strong>${ApiService.sanitizeText(
            ticket.placa
          )}</strong></p>
          <p class="fs-3 text-success fw-bold me-1">R$ ${valorCalculado
            .toFixed(2)
            .replace('.', ',')}</p>
          ${
            ticket.mensalistaId
              ? '<span class="badge bg-info text-dark">Isento (Mensalista)</span>'
              : ''
          }
        </div>
      `,
      confirmButtonColor: '#0e3a2f'
    })

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
