/**
 * Lógica da Página de Vagas & Tarifas
 * Renderização dinâmica do mapa de pátio, bloqueio/manutenção de vagas,
 * criação/edição/exclusão e filtragem de vagas e tarifas.
 */

let todasVagas = []
let todosTickets = []
let todasTarifas = []
let vagasFiltradasAtual = []

document.addEventListener('DOMContentLoaded', async () => {
  await carregarTodosOsDados()

  // Evento do filtro por tipo no Mapa Visual
  document.getElementById('filtro-tipo-vaga')?.addEventListener('change', e => {
    filtrarVagasPorTipo(e.target.value)
  })

  // Listeners dos filtros da Tabela de Vagas
  document
    .getElementById('filtro-tabela-busca')
    ?.addEventListener('input', aplicarFiltrosTabelaVagas)
  document
    .getElementById('filtro-tabela-tipo')
    ?.addEventListener('change', aplicarFiltrosTabelaVagas)
  document
    .getElementById('filtro-tabela-status')
    ?.addEventListener('change', aplicarFiltrosTabelaVagas)
  document
    .getElementById('btn-limpar-filtros-tabela')
    ?.addEventListener('click', limparFiltrosTabelaVagas)

  // Exportação (CSV/Excel) das tabelas de Vagas e Tarifas
  document
    .getElementById('btn-exportar-vagas-csv')
    ?.addEventListener('click', () => exportarVagas('csv'))
  document
    .getElementById('btn-exportar-vagas-excel')
    ?.addEventListener('click', () => exportarVagas('excel'))
  document
    .getElementById('btn-exportar-tarifas-csv')
    ?.addEventListener('click', () => exportarTarifas('csv'))
  document
    .getElementById('btn-exportar-tarifas-excel')
    ?.addEventListener('click', () => exportarTarifas('excel'))

  // Listener para formulários de cadastro na página
  document
    .getElementById('form-nova-tarifa')
    ?.addEventListener('submit', cadastrarNovaTarifa)
  document
    .getElementById('form-nova-vaga')
    ?.addEventListener('submit', cadastrarNovaVaga)

  // Botão "Tentar novamente"
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
    aplicarFiltrosTabelaVagas() // Aplica os filtros ativos ao carregar
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

// Extrai a "fileira" (letra) e o "assento" (número) do código da vaga, no
// estilo sala de cinema — ex.: "A1" -> fileira "A", assento 1.
function separarFileiraEAssento (codigo) {
  const match = String(codigo || '').match(/^([A-Za-z]+)\s*-?\s*(\d+)$/)
  if (!match) return { fileira: '•', assento: codigo }
  return { fileira: match[1].toUpperCase(), assento: Number(match[2]) }
}

// Mapa Visual estilo "sala de cinema": cada vaga vira uma bolinha (verde =
// livre, vermelha = ocupada, âmbar = manutenção) agrupada por fileira, com
// uma "tela" no topo para reforçar a metáfora.
function renderizarGridVagas (vagasList) {
  const gridContainer = document.getElementById('grid-mapa-vagas')
  if (!gridContainer) return
  gridContainer.innerHTML = ''

  if (!vagasList || vagasList.length === 0) {
    gridContainer.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="fas fa-search me-2" aria-hidden="true"></i>Nenhuma vaga encontrada para esta categoria.
      </div>
    `
    return
  }

  const fileiras = new Map()
  vagasList.forEach(vaga => {
    const numeroVaga = vaga.codigo || vaga.numero || vaga.id
    const { fileira, assento } = separarFileiraEAssento(numeroVaga)
    if (!fileiras.has(fileira)) fileiras.set(fileira, [])
    fileiras.get(fileira).push({ vaga, assento, numeroVaga })
  })

  const cinema = document.createElement('div')
  cinema.className = 'cinema-mapa'
  cinema.innerHTML = '<div class="cinema-tela">ENTRADA DO PÁTIO</div>'

  Array.from(fileiras.keys())
    .sort()
    .forEach(letraFileira => {
      const itens = fileiras.get(letraFileira).sort((a, b) => a.assento - b.assento)

      const linha = document.createElement('div')
      linha.className = 'cinema-fileira'
      linha.innerHTML = `<span class="cinema-fileira-label">${sanitizar(letraFileira)}</span>`

      const assentos = document.createElement('div')
      assentos.className = 'cinema-assentos'

      itens.forEach(({ vaga, numeroVaga }) => {
        const rawStatus = (vaga.status || 'livre').toLowerCase()
        const info = STATUS_VAGA[rawStatus] || STATUS_VAGA.livre

        const bolinha = document.createElement('button')
        bolinha.type = 'button'
        bolinha.className = `vaga-circulo vaga-circulo-${rawStatus.replace('ç', 'c').replace('ã', 'a')}`
        bolinha.setAttribute(
          'aria-label',
          `Vaga ${numeroVaga}, tipo ${vaga.tipo || 'comum'}, status ${info.texto}`
        )
        bolinha.title = `${numeroVaga} — ${info.texto}`
        bolinha.innerHTML = `<span>${sanitizar(numeroVaga)}</span>`

        bolinha.addEventListener('click', () => abrirOpcoesVaga(vaga))

        assentos.appendChild(bolinha)
      })

      linha.appendChild(assentos)
      cinema.appendChild(linha)
    })

  gridContainer.appendChild(cinema)
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
    const filtradas = todasVagas.filter(vaga => {
      const tipoVaga = (vaga.tipo || '').trim().toLowerCase()
      return tipoVaga === tipoFormatado
    })

    renderizarGridVagas(filtradas)
  }
}

/* ==========================================================================
   2. INTERAÇÃO E ALTERAÇÃO DE STATUS
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

        toastSucesso(
          vaiParaManutencao ? 'Vaga em Manutenção!' : 'Vaga Liberada!'
        )
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

async function executarSalvarTarifa (dadosTarifa) {
  try {
    if (typeof ApiService !== 'undefined') {
      if (ApiService.createTarifa) {
        await ApiService.createTarifa(dadosTarifa)
      } else if (ApiService.saveTarifa) {
        await ApiService.saveTarifa(dadosTarifa)
      }
    }

    if (typeof toastSucesso === 'function') {
      toastSucesso('Tarifa salva com sucesso.')
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
        <label class="form-label fw-bold">Tipo <span class="text-danger">*</span></label>
        <select id="swal-novo-tipo" class="form-select">
          <option value="comum">Comum</option>
          <option value="coberta">Coberta</option>
          <option value="mensalista">Mensalista</option>
        </select>
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Status</label>
        <select id="swal-novo-status" class="form-select">
          <option value="livre" selected>Livre</option>
          <option value="manutencao">Manutenção</option>
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
      const status = document.getElementById('swal-novo-status').value

      if (!codigo) {
        Swal.showValidationMessage('Informe o código da vaga.')
        return false
      }

      if (verificarDuplicidadeVaga(codigo, null)) {
        Swal.showValidationMessage(
          'Já existe uma vaga cadastrada com este código.'
        )
        return false
      }

      return { codigo, tipo, status }
    }
  })

  if (formValues) {
    try {
      if (typeof ApiService !== 'undefined' && ApiService.createVaga) {
        await ApiService.createVaga(formValues)
      }

      toastSucesso('Vaga cadastrada com sucesso.')

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
   4. GESTÃO DE VAGAS (TABELA & FILTROS)
   ========================================================================== */

function aplicarFiltrosTabelaVagas () {
  const busca = (document.getElementById('filtro-tabela-busca')?.value || '')
    .trim()
    .toLowerCase()
  const tipo = (
    document.getElementById('filtro-tabela-tipo')?.value || 'todos'
  ).toLowerCase()
  const status = (
    document.getElementById('filtro-tabela-status')?.value || 'todos'
  ).toLowerCase()

  const vagasFiltradas = todasVagas.filter(vaga => {
    const numero = String(
      vaga.codigo || vaga.numero || vaga.id || ''
    ).toLowerCase()
    const tipoVaga = String(vaga.tipo || '').toLowerCase()
    const statusVaga = String(vaga.status || 'livre').toLowerCase()

    const bateBusca = !busca || numero.includes(busca)
    const bateTipo = tipo === 'todos' || tipoVaga === tipo
    const bateStatus = status === 'todos' || statusVaga === status

    return bateBusca && bateTipo && bateStatus
  })

  vagasFiltradasAtual = vagasFiltradas
  renderizarTabelaVagas(vagasFiltradas)
}

function limparFiltrosTabelaVagas () {
  const inputBusca = document.getElementById('filtro-tabela-busca')
  const selectTipo = document.getElementById('filtro-tabela-tipo')
  const selectStatus = document.getElementById('filtro-tabela-status')

  if (inputBusca) inputBusca.value = ''
  if (selectTipo) selectTipo.value = 'todos'
  if (selectStatus) selectStatus.value = 'todos'

  vagasFiltradasAtual = todasVagas
  renderizarTabelaVagas(todasVagas)
}

// Monta as linhas "achatadas" a partir da lista de vagas já filtrada pela
// busca/tipo/status ativos na tabela, e delega para o exportador genérico.
function exportarVagas (formato) {
  const colunas = [
    { chave: 'codigo', rotulo: 'Código' },
    { chave: 'tipo', rotulo: 'Tipo' },
    { chave: 'status', rotulo: 'Status' }
  ]

  const linhas = vagasFiltradasAtual.map(vaga => ({
    codigo: vaga.codigo || vaga.numero || vaga.id,
    tipo: vaga.tipo || 'comum',
    status: STATUS_VAGA[(vaga.status || 'livre').toLowerCase()]?.texto ||
      vaga.status ||
      'Livre'
  }))

  if (formato === 'excel') {
    exportarParaExcel('vagas-parkgestao.xlsx', 'Vagas', colunas, linhas)
  } else {
    exportarParaCSV('vagas-parkgestao.csv', colunas, linhas)
  }
}

// Exporta a tabela de tarifas (não tem filtro próprio, exporta a lista completa).
function exportarTarifas (formato) {
  const colunas = [
    { chave: 'categoria', rotulo: 'Categoria' },
    { chave: 'valorHora', rotulo: 'Valor por Hora (R$)' }
  ]

  const linhas = todasTarifas.map(tarifa => ({
    categoria: tarifa.categoria || tarifa.tipo || tarifa.nome || 'Geral',
    valorHora: Number(tarifa.valorHora || tarifa.valor || 0)
      .toFixed(2)
      .replace('.', ',')
  }))

  if (formato === 'excel') {
    exportarParaExcel('tarifas-parkgestao.xlsx', 'Tarifas', colunas, linhas)
  } else {
    exportarParaCSV('tarifas-parkgestao.csv', colunas, linhas)
  }
}

const paginadorVagas =
  typeof criarPaginador === 'function'
    ? criarPaginador({
        idSufixo: 'vagas',
        tbodyId: 'tbody-vagas',
        colspanVazio: 4,
        textoVazio:
          '<i class="fas fa-search me-1" aria-hidden="true"></i>Nenhuma vaga encontrada com os filtros aplicados.',
        renderLinha: renderLinhaVaga
      })
    : null

function renderLinhaVaga (vaga, tbody) {
  const numero = vaga.codigo || vaga.numero || vaga.id
  const tipo = vaga.tipo || 'comum'
  const statusRaw = (vaga.status || 'livre').toLowerCase()
  const statusInfo = STATUS_VAGA[statusRaw] || STATUS_VAGA.livre

  // Botão rápido para colocar em manutenção / liberar, sem precisar ir até
  // o Mapa Visual. Para vagas ocupadas, abre o mesmo aviso explicando que é
  // preciso encerrar o ticket primeiro.
  const emManutencao = statusRaw === 'manutencao' || statusRaw === 'manutenção'
  const botaoManutencaoLabel = emManutencao
    ? '<i class="fas fa-check-circle"></i> Liberar'
    : '<i class="fas fa-tools"></i> Manutenção'

  tbody.insertAdjacentHTML(
    'beforeend',
    `
      <tr>
        <td class="fw-bold">${sanitizar(numero)}</td>
        <td class="text-capitalize">${sanitizar(tipo)}</td>
        <td>
          <span class="badge-status ${statusInfo.badgeClass}">
            <i class="fas ${statusInfo.icon}" aria-hidden="true"></i> ${statusInfo.texto}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="editarVaga('${vaga.id}')">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button class="btn btn-sm btn-outline-warning me-1" onclick="alternarManutencaoVaga('${vaga.id}')" title="Colocar em manutenção ou liberar a vaga">
            ${botaoManutencaoLabel}
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="excluirVaga('${vaga.id}')">
            <i class="fas fa-trash"></i> Excluir
          </button>
        </td>
      </tr>
    `
  )
}

function renderizarTabelaVagas (vagas) {
  if (paginadorVagas) {
    paginadorVagas.definirItens(vagas || [])
    return
  }

  // Fallback sem paginação (não deveria ocorrer — só se o módulo de
  // paginação não tiver sido carregado nesta página).
  const tbody = document.getElementById('tbody-vagas')
  if (!tbody) return
  tbody.innerHTML = ''
  ;(vagas || []).forEach(vaga => renderLinhaVaga(vaga, tbody))
}

/* ==========================================================================
   5. TABELA DE TARIFAS
   ========================================================================== */

const paginadorTarifas =
  typeof criarPaginador === 'function'
    ? criarPaginador({
        idSufixo: 'tarifas',
        tbodyId: 'tbody-tarifas',
        colspanVazio: 3,
        textoVazio: 'Nenhuma tarifa cadastrada.',
        renderLinha: renderLinhaTarifa
      })
    : null

function renderLinhaTarifa (tarifa, tbody) {
  const nome = tarifa.categoria || tarifa.tipo || tarifa.nome || 'Geral'
  const valor = Number(tarifa.valorHora || tarifa.valor || 0)
    .toFixed(2)
    .replace('.', ',')

  tbody.insertAdjacentHTML(
    'beforeend',
    `
        <tr>
          <td class="fw-bold">${sanitizar(nome)}</td>
          <td>R$ ${valor} / h</td>
          <td>
            <button class="btn btn-sm btn-outline-primary me-1" onclick="editarTarifa('${tarifa.id}')">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="excluirTarifa('${tarifa.id}')">
              <i class="fas fa-trash"></i> Excluir
            </button>
          </td>
        </tr>
      `
  )
}

function renderizarTabelaTarifas (tarifas) {
  if (paginadorTarifas) {
    paginadorTarifas.definirItens(tarifas || [])
    return
  }

  const tbody = document.getElementById('tbody-tarifas')
  if (!tbody) return
  tbody.innerHTML = ''
  ;(tarifas || []).forEach(tarifa => renderLinhaTarifa(tarifa, tbody))
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

// Verifica se já existe outra vaga cadastrada com o mesmo código/número
function verificarDuplicidadeVaga (codigo, idAtual) {
  const codigoClean = (codigo || '').trim().toUpperCase()
  return todasVagas.some(
    v =>
      String(v.id) !== String(idAtual) &&
      String(v.codigo || v.numero || '')
        .trim()
        .toUpperCase() === codigoClean
  )
}

// Atalho da tabela de Gestão de Vagas: colocar em manutenção / liberar sem
// precisar ir até o card no Mapa Visual. Reaproveita a mesma regra de
// negócio (bloqueia se houver ticket aberto) usada em abrirOpcoesVaga.
function alternarManutencaoVaga (vagaId) {
  const vaga = todasVagas.find(v => String(v.id) === String(vagaId))
  if (vaga) abrirOpcoesVaga(vaga)
}

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

  const codigoAtualSanitizado = sanitizar(vaga.codigo || vaga.numero || vaga.id)
  const statusAtual = (vaga.status || 'livre').toLowerCase()

  const { value: formValues } = await Swal.fire({
    title: 'Editar Vaga',
    html: `
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Código/Número da Vaga</label>
        <input id="swal-input-codigo" class="form-control" value="${codigoAtualSanitizado}">
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Tipo</label>
        <select id="swal-input-tipo" class="form-select">
          <option value="comum" ${
            vaga.tipo === 'comum' ? 'selected' : ''
          }>Comum</option>
          <option value="coberta" ${
            vaga.tipo === 'coberta' ? 'selected' : ''
          }>Coberta</option>
          <option value="mensalista" ${
            vaga.tipo === 'mensalista' ? 'selected' : ''
          }>Mensalista</option>
        </select>
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Status</label>
        <select id="swal-input-status" class="form-select">
          <option value="livre" ${
            statusAtual === 'livre' ? 'selected' : ''
          }>Livre</option>
          <option value="manutencao" ${
            statusAtual.startsWith('manuten') ? 'selected' : ''
          }>Manutenção</option>
        </select>
        <div class="form-text">O status "Ocupada" é definido automaticamente pelo sistema.</div>
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
      if (verificarDuplicidadeVaga(codigo, vagaId)) {
        Swal.showValidationMessage(
          'Já existe outra vaga cadastrada com este código.'
        )
        return false
      }
      return {
        codigo,
        tipo: document.getElementById('swal-input-tipo').value,
        status: document.getElementById('swal-input-status').value
      }
    }
  })

  if (formValues) {
    try {
      await ApiService.updateVaga(vagaId, formValues)
      toastSucesso('Vaga atualizada!')
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

async function editarTarifa (tarifaId) {
  const tarifa = todasTarifas.find(t => String(t.id) === String(tarifaId))
  if (!tarifa) return

  const categoriaAtual = sanitizar(
    tarifa.categoria || tarifa.tipo || tarifa.nome || 'Geral'
  )
  const valorAtual = Number(tarifa.valorHora || tarifa.valor || 0)

  const { value: formValues } = await Swal.fire({
    title: 'Editar Tarifa',
    html: `
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Categoria / Nome</label>
        <input id="swal-input-categoria" class="form-control" value="${categoriaAtual}" placeholder="Ex: Carro, Moto, PCD">
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Valor da Hora (R$)</label>
        <input id="swal-input-valor" type="number" step="0.50" min="0" class="form-control" value="${valorAtual}">
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Salvar',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const categoria = document
        .getElementById('swal-input-categoria')
        .value.trim()
      const valorHora = Number(
        document.getElementById('swal-input-valor').value
      )

      if (!categoria) {
        Swal.showValidationMessage('Informe a categoria/nome da tarifa.')
        return false
      }
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
      toastSucesso('Tarifa atualizada!')
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
        toastSucesso('Vaga excluída com sucesso!')
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
        toastSucesso('Tarifa excluída com sucesso!')
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
window.alternarManutencaoVaga = alternarManutencaoVaga
window.excluirVaga = excluirVaga
window.editarTarifa = editarTarifa
window.excluirTarifa = excluirTarifa
window.cadastrarNovaTarifa = cadastrarNovaTarifa
window.abrirModalNovaTarifa = abrirModalNovaTarifa
window.abrirModalNovaVaga = abrirModalNovaVaga
window.aplicarFiltrosTabelaVagas = aplicarFiltrosTabelaVagas
window.limparFiltrosTabelaVagas = limparFiltrosTabelaVagas
