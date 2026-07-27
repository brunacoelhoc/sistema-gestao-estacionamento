/**
 * Lógica da Página de Vagas & Tarifas
 * Renderização dinâmica do mapa de pátio, bloqueio/manutenção de vagas,
 * criação/edição/exclusão de vagas e tarifas com validações e SweetAlert2.
 */

let todasVagas = []
let todosTickets = []
let todasTarifas = []

document.addEventListener('DOMContentLoaded', async () => {
  await carregarTodosOsDados()

  // Evento do filtro por tipo/categoria no Mapa Visual
  document.getElementById('filtro-tipo-vaga')?.addEventListener('change', e => {
    filtrarVagasPorTipo(e.target.value)
  })

  // Listener para formulários de cadastro na página (caso existam no HTML)
  document
    .getElementById('form-nova-tarifa')
    ?.addEventListener('submit', cadastrarNovaTarifa)
  document
    .getElementById('form-nova-vaga')
    ?.addEventListener('submit', cadastrarNovaVaga)

  // Botão "Tentar novamente" em caso de erro na página
  document.getElementById('btn-retry-page')?.addEventListener('click', () => {
    carregarTodosOsDados()
  })
})

// Mapeamento de status da vaga
const STATUS_VAGA = {
  livre: {
    cardClass: 'vaga-livre',
    badgeClass: 'status-livre',
    icon: 'fa-check-circle',
    texto: 'Livre'
  },
  ocupada: {
    cardClass: 'vaga-ocupada',
    badgeClass: 'status-ocupada',
    icon: 'fa-car',
    texto: 'Ocupada'
  },
  manutencao: {
    cardClass: 'vaga-manutencao',
    badgeClass: 'status-manutencao',
    icon: 'fa-tools',
    texto: 'Manutenção'
  },
  manutenção: {
    cardClass: 'vaga-manutencao',
    badgeClass: 'status-manutencao',
    icon: 'fa-tools',
    texto: 'Manutenção'
  }
}

// Helper seguro para sanitização
function sanitizar (texto) {
  if (typeof ApiService !== 'undefined' && ApiService.sanitizeText) {
    return ApiService.sanitizeText(texto)
  }
  return texto || ''
}

// Carrega Vagas, Tickets e Tarifas da API
async function carregarTodosOsDados () {
  const pageError = document.getElementById('page-error')
  pageError?.classList.add('d-none')

  try {
    const [vagas, tickets, tarifas] = await Promise.all([
      typeof ApiService !== 'undefined' && ApiService.getVagas
        ? ApiService.getVagas()
        : Promise.resolve([]),
      typeof ApiService !== 'undefined' && ApiService.getTickets
        ? ApiService.getTickets()
        : Promise.resolve([]),
      typeof ApiService !== 'undefined' && ApiService.getTarifas
        ? ApiService.getTarifas()
        : Promise.resolve([])
    ])

    todasVagas = vagas || []
    todosTickets = tickets || []
    todasTarifas = tarifas || []

    renderizarGridVagas(todasVagas)
    renderizarTabelaVagas(todasVagas)
    renderizarTabelaTarifas(todasTarifas)
  } catch (error) {
    console.error('Erro ao carregar dados de Vagas e Tarifas:', error)

    if (pageError) pageError.classList.remove('d-none')

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Erro de Conexão',
        text: 'Não foi possível carregar os dados do servidor.'
      })
    }
  }
}

/* ==========================================================================
   1. MAPA VISUAL DE VAGAS
   ========================================================================== */

function renderizarGridVagas (vagasList) {
  const gridContainer = document.getElementById('grid-mapa-vagas')
  if (!gridContainer) return
  gridContainer.innerHTML = ''

  if (!vagasList || vagasList.length === 0) {
    gridContainer.innerHTML = `
      <div class="text-center py-5 text-muted" style="grid-column: 1 / -1;">
        <i class="fas fa-search me-2" aria-hidden="true"></i>Nenhuma vaga encontrada para esta categoria.
      </div>
    `
    return
  }

  vagasList.forEach(vaga => {
    const rawStatus = (vaga.status || 'livre').toLowerCase()
    const info = STATUS_VAGA[rawStatus] || STATUS_VAGA.livre
    const numeroVaga = vaga.codigo || vaga.numero || vaga.id

    const card = document.createElement('div')
    card.className = `vaga-card ${info.cardClass} is-interativo shadow-sm position-relative`
    card.setAttribute('role', 'button')
    card.setAttribute('tabindex', '0')
    card.setAttribute(
      'aria-label',
      `Vaga ${numeroVaga}, tipo ${vaga.tipo}, status ${info.texto}`
    )

    card.innerHTML = `
      <div class="vaga-codigo">${sanitizar(numeroVaga)}</div>
      <div class="vaga-tipo fw-semibold text-uppercase">${sanitizar(
        vaga.tipo || 'comum'
      )}</div>
      <div class="mt-2">
        <span class="badge-status ${info.badgeClass}">
          <i class="fas ${info.icon}" aria-hidden="true"></i> ${info.texto}
        </span>
      </div>
    `

    card.addEventListener('click', () => abrirOpcoesVaga(vaga))
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        abrirOpcoesVaga(vaga)
      }
    })

    gridContainer.appendChild(card)
  })
}

function filtrarVagasPorTipo (tipo) {
  const tipoFormatado = (tipo || '').trim().toLowerCase()
  if (
    !tipoFormatado ||
    tipoFormatado === 'todas' ||
    tipoFormatado === 'todos'
  ) {
    renderizarGridVagas(todasVagas)
  } else {
    const filtradas = todasVagas.filter(
      v => (v.tipo || '').toLowerCase() === tipoFormatado
    )
    renderizarGridVagas(filtradas)
  }
}

/* ==========================================================================
   2. INTERAÇÃO E ALTERAÇÃO DE STATUS (MANUTENÇÃO / LIBERAÇÃO)
   ========================================================================== */

async function abrirOpcoesVaga (vaga) {
  const statusKey = (vaga.status || '').toLowerCase()
  const numeroVaga = vaga.codigo || vaga.numero || vaga.id

  if (possuiTicketAberto(vaga.id) || statusKey === 'ocupada') {
    if (typeof Swal !== 'undefined') {
      await Swal.fire({
        title: `Vaga ${sanitizar(numeroVaga)}`,
        html: `
          <p class="mb-1"><strong>Tipo:</strong> ${sanitizar(vaga.tipo)}</p>
          <p class="mb-0"><strong>Status Atual:</strong> <span class="badge bg-danger">Ocupada</span></p>
          <p class="text-muted small mt-3 mb-0">
            <i class="fas fa-exclamation-triangle text-warning me-1"></i>
            Esta vaga possui um veículo estacionado no momento. Para alterá-la, dê saída no ticket primeiro.
          </p>
        `,
        icon: 'info',
        confirmButtonText: 'Entendido'
      })
    }
    return
  }

  const vaiParaManutencao = statusKey === 'livre'
  const novoStatus = vaiParaManutencao ? 'manutencao' : 'livre'

  if (typeof Swal !== 'undefined') {
    const result = await Swal.fire({
      title: `Vaga ${sanitizar(numeroVaga)}`,
      html: `
        <p class="mb-1"><strong>Tipo:</strong> ${sanitizar(vaga.tipo)}</p>
        <p class="mb-0"><strong>Status Atual:</strong> <span class="fw-bold">${
          STATUS_VAGA[statusKey]?.texto || 'Livre'
        }</span></p>
        <p class="text-muted small mt-2 mb-0">
          ${
            vaiParaManutencao
              ? 'Deseja bloquear esta vaga para manutenção/reparos?'
              : 'Deseja liberar esta vaga para novos veículos?'
          }
        </p>
      `,
      icon: vaiParaManutencao ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonColor: vaiParaManutencao ? '#d33' : '#198754',
      confirmButtonText: vaiParaManutencao
        ? '<i class="fas fa-tools me-1"></i> Bloquear (Manutenção)'
        : '<i class="fas fa-check me-1"></i> Liberar Vaga',
      cancelButtonText: 'Cancelar'
    })

    if (result.isConfirmed) {
      try {
        if (typeof ApiService !== 'undefined' && ApiService.updateVagaStatus) {
          await ApiService.updateVagaStatus(vaga.id, novoStatus)
        } else if (typeof ApiService !== 'undefined' && ApiService.updateVaga) {
          await ApiService.updateVaga(vaga.id, { ...vaga, status: novoStatus })
        }

        Swal.fire({
          icon: 'success',
          title: vaiParaManutencao ? 'Vaga em Manutenção!' : 'Vaga Liberada!',
          timer: 1500,
          showConfirmButton: false
        })
        await carregarTodosOsDados()
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Erro ao atualizar status',
          text: error.message || 'Comportamento inesperado. Tente novamente.'
        })
      }
    }
  }
}

/* ==========================================================================
   3. CADASTRO DE NOVAS TARIFAS E VAGAS
   ========================================================================== */

// Cadastro via Modal Direta
async function abrirModalNovaTarifa () {
  if (typeof Swal === 'undefined') return

  const { value: formValues } = await Swal.fire({
    title: 'Cadastrar Nova Tarifa',
    html: `
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Categoria / Tipo <span class="text-danger">*</span></label>
        <input id="swal-nova-categoria" class="form-control" placeholder="Ex: Carro, Moto, PCD">
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Valor da Hora (R$) <span class="text-danger">*</span></label>
        <input id="swal-novo-valor" type="number" step="0.50" min="0" class="form-control" placeholder="Ex: 10.00">
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Salvar Tarifa',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const categoria = document
        .getElementById('swal-nova-categoria')
        .value.trim()
      const valorStr = document.getElementById('swal-novo-valor').value.trim()
      const valorHora = Number(valorStr)

      if (!categoria || valorStr === '' || isNaN(valorHora) || valorHora <= 0) {
        Swal.showValidationMessage(
          'Por favor, preencha todos os campos com valores válidos.'
        )
        return false
      }

      return { categoria, valorHora }
    }
  })

  if (formValues) {
    await executarSalvarTarifa(formValues)
  }
}

// Cadastro via Form do HTML
async function cadastrarNovaTarifa (event) {
  if (event) event.preventDefault()

  const elCategoria =
    document.getElementById('input-tarifa-categoria') ||
    document.getElementById('tarifa-categoria')
  const elValor =
    document.getElementById('input-tarifa-valor') ||
    document.getElementById('tarifa-valor')

  const categoria = elCategoria ? elCategoria.value.trim() : ''
  const valorInput = elValor ? elValor.value.trim() : ''
  const valorHora = Number(valorInput.replace(',', '.'))

  if (!categoria || valorInput === '' || isNaN(valorHora) || valorHora <= 0) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: 'Campos Obrigatórios',
        text: 'Por favor, preencha todos os campos corretamente antes de salvar a tarifa.'
      })
    }
    return
  }

  const salvou = await executarSalvarTarifa({ categoria, valorHora })
  if (salvou) {
    if (elCategoria) elCategoria.value = ''
    if (elValor) elValor.value = ''
  }
}

// Lógica de Persistência da Tarifa na API
async function executarSalvarTarifa (dadosTarifa) {
  try {
    if (typeof ApiService !== 'undefined') {
      if (ApiService.createTarifa) {
        await ApiService.createTarifa(dadosTarifa)
      } else if (ApiService.saveTarifa) {
        await ApiService.saveTarifa(dadosTarifa)
      }
    }

    if (typeof Swal !== 'undefined') {
      await Swal.fire({
        icon: 'success',
        title: 'Sucesso!',
        text: 'Tarifa salva com sucesso.',
        timer: 1800,
        showConfirmButton: false
      })
    }

    await carregarTodosOsDados()
    return true
  } catch (error) {
    console.error('Erro ao salvar tarifa:', error)
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Erro ao salvar',
        text: 'Comportamento inesperado. Tente novamente.'
      })
    }
    return false
  }
}

// Modal Rápida para Cadastrar Nova Vaga
async function abrirModalNovaVaga () {
  if (typeof Swal === 'undefined') return

  const { value: formValues } = await Swal.fire({
    title: 'Cadastrar Nova Vaga',
    html: `
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Código/Número <span class="text-danger">*</span></label>
        <input id="swal-novo-codigo" class="form-control" placeholder="Ex: A-01, B-12">
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Tipo de Veículo <span class="text-danger">*</span></label>
        <select id="swal-novo-tipo" class="form-select">
          <option value="carro">Carro</option>
          <option value="moto">Moto</option>
          <option value="deficiente">Deficiente (PCD)</option>
          <option value="idoso">Idoso</option>
        </select>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Cadastrar',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const codigo = document.getElementById('swal-novo-codigo').value.trim()
      const tipo = document.getElementById('swal-novo-tipo').value

      if (!codigo) {
        Swal.showValidationMessage('Informe o código da vaga.')
        return false
      }

      return { codigo, tipo, status: 'livre' }
    }
  })

  if (formValues) {
    try {
      if (typeof ApiService !== 'undefined' && ApiService.createVaga) {
        await ApiService.createVaga(formValues)
      }

      Swal.fire({
        icon: 'success',
        title: 'Sucesso!',
        text: 'Vaga cadastrada com sucesso.',
        timer: 1500,
        showConfirmButton: false
      })

      await carregarTodosOsDados()
    } catch (error) {
      console.error('Erro ao cadastrar vaga:', error)
      Swal.fire({
        icon: 'error',
        title: 'Erro ao salvar',
        text: 'Comportamento inesperado. Tente novamente.'
      })
    }
  }
}

/* ==========================================================================
   4. GESTÃO DE VAGAS (TABELA)
   ========================================================================== */

function renderizarTabelaVagas (vagas) {
  const tbody =
    document.getElementById('tabela-vagas-body') ||
    document.querySelector('#tabela-vagas tbody') ||
    document.getElementById('listagem-vagas-body') ||
    document.querySelector('table tbody')

  if (!tbody) return

  if (!vagas || vagas.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center py-4 text-muted">Nenhuma vaga cadastrada.</td></tr>'
    return
  }

  tbody.innerHTML = vagas
    .map(vaga => {
      const numero = vaga.codigo || vaga.numero || vaga.id
      const tipo = vaga.tipo || 'comum'
      const status = vaga.status || 'livre'

      return `
      <tr>
        <td class="fw-bold">${sanitizar(numero)}</td>
        <td class="text-capitalize">${sanitizar(tipo)}</td>
        <td><span class="badge status-${status.toLowerCase()}">${sanitizar(
        status
      )}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="editarVaga('${
            vaga.id
          }')">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="excluirVaga('${
            vaga.id
          }')">
            <i class="fas fa-trash"></i> Excluir
          </button>
        </td>
      </tr>
    `
    })
    .join('')
}

/* ==========================================================================
   5. TABELA DE TARIFAS
   ========================================================================== */

function renderizarTabelaTarifas (tarifas) {
  const tbody =
    document.getElementById('tabela-tarifas-body') ||
    document.querySelector('#tabela-tarifas tbody') ||
    document.getElementById('listagem-tarifas-body') ||
    document.querySelector('#tarifas-body') ||
    document.querySelectorAll('table tbody')[1] ||
    document.querySelector('.table-tarifas tbody')

  if (!tbody) return

  if (!tarifas || tarifas.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="3" class="text-center py-4 text-muted">Nenhuma tarifa cadastrada.</td></tr>'
    return
  }

  tbody.innerHTML = tarifas
    .map(tarifa => {
      const nome = tarifa.categoria || tarifa.tipo || tarifa.nome || 'Geral'
      const valor = Number(tarifa.valorHora || tarifa.valor || 0)
        .toFixed(2)
        .replace('.', ',')

      return `
        <tr>
          <td class="fw-bold">${sanitizar(nome)}</td>
          <td>R$ ${valor} / h</td>
          <td>
            <button class="btn btn-sm btn-outline-primary me-1" onclick="editarTarifa('${
              tarifa.id
            }')">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="excluirTarifa('${
              tarifa.id
            }')">
              <i class="fas fa-trash"></i> Excluir
            </button>
          </td>
        </tr>
      `
    })
    .join('')
}

/* ==========================================================================
   6. REGRAS DE NEGÓCIO E AÇÕES DE EDIÇÃO E EXCLUSÃO
   ========================================================================== */

function possuiTicketAberto (vagaId) {
  return todosTickets.some(
    ticket =>
      String(ticket.vagaId) === String(vagaId) &&
      (ticket.status || '').toLowerCase() === 'aberto'
  )
}

// EDIÇÃO DE VAGA
async function editarVaga (vagaId) {
  const vaga = todasVagas.find(v => String(v.id) === String(vagaId))
  if (!vaga) return

  if (possuiTicketAberto(vagaId)) {
    Swal.fire({
      icon: 'warning',
      title: 'Vaga Ocupada',
      text: 'Esta vaga possui um ticket em aberto e não pode ter suas informações editadas agora.'
    })
    return
  }

  const { value: formValues } = await Swal.fire({
    title: 'Editar Vaga',
    html: `
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Código/Número da Vaga</label>
        <input id="swal-input-codigo" class="form-control" value="${
          vaga.codigo || vaga.numero || vaga.id
        }">
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Tipo de Veículo</label>
        <select id="swal-input-tipo" class="form-select">
          <option value="carro" ${
            vaga.tipo === 'carro' ? 'selected' : ''
          }>Carro</option>
          <option value="moto" ${
            vaga.tipo === 'moto' ? 'selected' : ''
          }>Moto</option>
          <option value="deficiente" ${
            vaga.tipo === 'deficiente' ? 'selected' : ''
          }>Deficiente</option>
          <option value="idoso" ${
            vaga.tipo === 'idoso' ? 'selected' : ''
          }>Idoso</option>
        </select>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Salvar',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const codigo = document.getElementById('swal-input-codigo').value.trim()
      if (!codigo) {
        Swal.showValidationMessage('O código da vaga não pode ficar vazio.')
        return false
      }
      return {
        codigo,
        tipo: document.getElementById('swal-input-tipo').value
      }
    }
  })

  if (formValues) {
    try {
      await ApiService.updateVaga(vagaId, formValues)
      Swal.fire({
        icon: 'success',
        title: 'Vaga atualizada!',
        timer: 1500,
        showConfirmButton: false
      })
      await carregarTodosOsDados()
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Erro ao atualizar',
        text: 'Comportamento inesperado. Tente novamente.'
      })
    }
  }
}

// EDIÇÃO DE TARIFA
async function editarTarifa (tarifaId) {
  const tarifa = todasTarifas.find(t => String(t.id) === String(tarifaId))
  if (!tarifa) return

  const catAtual = (tarifa.categoria || tarifa.tipo || tarifa.nome || 'Geral')
    .toLowerCase()
    .trim()

  const { value: formValues } = await Swal.fire({
    title: 'Editar Tarifa',
    html: `
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Categoria / Tipo</label>
        <select id="swal-input-categoria" class="form-select">
          <option value="Carro" ${
            catAtual === 'carro' ? 'selected' : ''
          }>Carro</option>
          <option value="Moto" ${
            catAtual === 'moto' ? 'selected' : ''
          }>Moto</option>
          <option value="Deficiente" ${
            catAtual === 'deficiente' || catAtual === 'pcd' ? 'selected' : ''
          }>Deficiente (PCD)</option>
          <option value="Idoso" ${
            catAtual === 'idoso' ? 'selected' : ''
          }>Idoso</option>
          <option value="Geral" ${
            catAtual === 'geral' ? 'selected' : ''
          }>Geral / Padrão</option>
        </select>
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Valor da Hora (R$)</label>
        <input id="swal-input-valor" type="number" step="0.50" class="form-control" value="${
          tarifa.valorHora || tarifa.valor || 0
        }">
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Salvar',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const categoria = document.getElementById('swal-input-categoria').value
      const valorHora = Number(
        document.getElementById('swal-input-valor').value
      )

      if (isNaN(valorHora) || valorHora <= 0) {
        Swal.showValidationMessage('Informe um valor válido por hora.')
        return false
      }

      return { categoria, valorHora }
    }
  })

  if (formValues) {
    try {
      await ApiService.updateTarifa(tarifaId, formValues)
      Swal.fire({
        icon: 'success',
        title: 'Tarifa atualizada!',
        timer: 1500,
        showConfirmButton: false
      })
      await carregarTodosOsDados()
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Erro ao atualizar tarifa',
        text: 'Comportamento inesperado. Tente novamente.'
      })
    }
  }
}

// EXCLUSÃO DE VAGA
async function excluirVaga (vagaId) {
  if (possuiTicketAberto(vagaId)) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: 'Ação Bloqueada',
        text: 'Esta vaga possui um ticket em aberto e não pode ser excluída no momento.'
      })
    }
    return
  }

  if (typeof Swal !== 'undefined') {
    const result = await Swal.fire({
      title: 'Excluir Vaga?',
      text: 'Esta ação não poderá ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    })

    if (result.isConfirmed) {
      try {
        await ApiService.deleteVaga(vagaId)
        Swal.fire({
          icon: 'success',
          title: 'Vaga excluída com sucesso!',
          timer: 1500,
          showConfirmButton: false
        })
        await carregarTodosOsDados()
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Erro ao excluir vaga',
          text: 'Comportamento inesperado. Tente novamente.'
        })
      }
    }
  }
}

// EXCLUSÃO DE TARIFA
async function excluirTarifa (tarifaId) {
  const temTicketAberto = todosTickets.some(
    t =>
      String(t.tarifaId) === String(tarifaId) &&
      (t.status || '').toLowerCase() === 'aberto'
  )

  if (temTicketAberto) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: 'Ação Bloqueada',
        text: 'Esta tarifa está vinculada a um ticket em aberto e não pode ser excluída.'
      })
    }
    return
  }

  if (typeof Swal !== 'undefined') {
    const result = await Swal.fire({
      title: 'Excluir Tarifa?',
      text: 'Esta ação não poderá ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    })

    if (result.isConfirmed) {
      try {
        await ApiService.deleteTarifa(tarifaId)
        Swal.fire({
          icon: 'success',
          title: 'Tarifa excluída com sucesso!',
          timer: 1500,
          showConfirmButton: false
        })
        await carregarTodosOsDados()
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Erro ao excluir tarifa',
          text: 'Comportamento inesperado. Tente novamente.'
        })
      }
    }
  }
}

// Expõe as funções globalmente
window.editarVaga = editarVaga
window.excluirVaga = excluirVaga
window.editarTarifa = editarTarifa
window.excluirTarifa = excluirTarifa
window.cadastrarNovaTarifa = cadastrarNovaTarifa
window.abrirModalNovaTarifa = abrirModalNovaTarifa
window.abrirModalNovaVaga = abrirModalNovaVaga
