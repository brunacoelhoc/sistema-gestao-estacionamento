/**
 * Lógica da Página de Vagas & Tarifas
 * Renderização dinâmica do mapa, tabelas de gestão, validações e regras de negócio.
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

    // Renderiza a aba ativa (Mapa Visual e Tabelas de Gestão)
    renderizarGridVagas(todasVagas)
    renderizarTabelaVagas(todasVagas)
    renderizarTabelaTarifas(todasTarifas)
  } catch (error) {
    console.error('Erro ao carregar dados de Vagas e Tarifas:', error)

    if (pageError) {
      pageError.classList.remove('d-none')
    }

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

    const sanitize =
      typeof ApiService !== 'undefined'
        ? ApiService.sanitizeText
        : str => str || ''

    card.innerHTML = `
      <div class="vaga-codigo">${sanitize(numeroVaga)}</div>
      <div class="vaga-tipo fw-semibold text-uppercase">${sanitize(
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
   2. GESTÃO DE VAGAS (TABELA)
   ========================================================================== */

function renderizarTabelaVagas (vagas) {
  const tbody =
    document.getElementById('tabela-vagas-body') ||
    document.querySelector('#tabela-vagas tbody') ||
    document.getElementById('listagem-vagas-body') ||
    document.querySelector('table tbody')

  if (!tbody) return

  const sanitize =
    typeof ApiService !== 'undefined'
      ? ApiService.sanitizeText
      : str => str || ''

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
        <td class="fw-bold">${sanitize(numero)}</td>
        <td class="text-capitalize">${sanitize(tipo)}</td>
        <td><span class="badge status-${status.toLowerCase()}">${sanitize(
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
   3. TABELA DE TARIFAS
   ========================================================================== */

/* ==========================================================================
   3. TABELA DE TARIFAS (CORRIGIDA)
   ========================================================================== */

function renderizarTabelaTarifas (tarifas) {
  // Busca por todos os IDs e estruturas comuns que o HTML pode ter
  const tbody =
    document.getElementById('tabela-tarifas-body') ||
    document.querySelector('#tabela-tarifas tbody') ||
    document.getElementById('listagem-tarifas-body') ||
    document.querySelector('#tarifas-body') ||
    document.querySelectorAll('table tbody')[1] || // Seleciona a segunda tabela da página
    document.querySelector('.table-tarifas tbody')

  if (!tbody) {
    console.warn(
      '[Tarifas] Container/tbody da tabela de tarifas não foi encontrado no HTML.'
    )
    return
  }

  const sanitize =
    typeof ApiService !== 'undefined'
      ? ApiService.sanitizeText
      : str => str || ''

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
          <td class="fw-bold">${sanitize(nome)}</td>
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
   4. REGRAS DE NEGÓCIO E AÇÕES DE EDIÇÃO E EXCLUSÃO
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
      return {
        codigo: document.getElementById('swal-input-codigo').value,
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
        text: error.message
      })
    }
  }
}

// EDIÇÃO DE TARIFA
async function editarTarifa (tarifaId) {
  const tarifa = todasTarifas.find(t => String(t.id) === String(tarifaId))
  if (!tarifa) return

  // Identifica a categoria atual (normalizando maiúsculas/minúsculas)
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

      if (isNaN(valorHora) || valorHora < 0) {
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
        text: error.message || 'Falha ao salvar no servidor.'
      })
    }
  }
}

async function abrirOpcoesVaga (vaga) {
  const statusKey = (vaga.status || '').toLowerCase()
  const numeroVaga = vaga.codigo || vaga.numero || vaga.id
  const sanitize =
    typeof ApiService !== 'undefined'
      ? ApiService.sanitizeText
      : str => str || ''

  if (possuiTicketAberto(vaga.id) || statusKey === 'ocupada') {
    if (typeof Swal !== 'undefined') {
      await Swal.fire({
        title: `Vaga ${sanitize(numeroVaga)}`,
        html: `
          <p class="mb-1"><strong>Tipo:</strong> ${sanitize(vaga.tipo)}</p>
          <p class="mb-0"><strong>Status Atual:</strong> <span class="badge bg-danger">Ocupada</span></p>
          <p class="text-muted small mt-2 mb-0">
            <i class="fas fa-exclamation-circle text-warning me-1"></i>
            Existe um ticket aberto para esta vaga. Para alterar o status ou liberar a vaga, encerre o ticket na tela de Tickets.
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
      title: `Vaga ${sanitize(numeroVaga)}`,
      html: `
        <p class="mb-1"><strong>Tipo:</strong> ${sanitize(vaga.tipo)}</p>
        <p class="mb-0"><strong>Status Atual:</strong> ${
          STATUS_VAGA[statusKey]?.texto || 'Livre'
        }</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: vaiParaManutencao
        ? 'Marcar em Manutenção'
        : 'Liberar Vaga',
      cancelButtonText: 'Cancelar'
    })

    if (result.isConfirmed) {
      try {
        await ApiService.updateVagaStatus(vaga.id, novoStatus)
        Swal.fire({
          icon: 'success',
          title: 'Status Atualizado!',
          timer: 1500,
          showConfirmButton: false
        })
        await carregarTodosOsDados()
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Erro ao atualizar',
          text: error.message || 'Falha ao comunicar com o servidor.'
        })
      }
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
          text: error.message
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
          text: error.message
        })
      }
    }
  }
}

// Expõe explicitamente as funções no escopo global window para chamadas via onclick no HTML
window.editarVaga = editarVaga
window.excluirVaga = excluirVaga
window.editarTarifa = editarTarifa
window.excluirTarifa = excluirTarifa
