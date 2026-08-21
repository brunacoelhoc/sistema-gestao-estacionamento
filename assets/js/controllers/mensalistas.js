/**
 * Lógica da Página de Gestão de Mensalistas
 * CRUD (sem exclusão física) com conformidade LGPD, validações e filtros.
 */

let mensalistasCache = []
let mensalistasFiltradosAtual = []
let modalMensalistaBS = null

document.addEventListener('DOMContentLoaded', async () => {
  const modalEl = document.getElementById('modalMensalista')
  if (modalEl) {
    modalMensalistaBS = new bootstrap.Modal(modalEl)
  }

  // Inicializa máscaras e eventos dos inputs
  initInputMasks()

  await carregarMensalistas()

  document
    .getElementById('form-mensalista')
    ?.addEventListener('submit', salvarMensalista)

  document
    .getElementById('input-busca-mensalista')
    ?.addEventListener('input', aplicarFiltros)

  document
    .getElementById('filtro-status-mensalista')
    ?.addEventListener('change', aplicarFiltros)

  document.getElementById('btn-retry-page')?.addEventListener('click', () => {
    carregarMensalistas()
  })

  // Exportação (CSV/Excel) respeitando a busca/filtro de status atuais
  document
    .getElementById('btn-exportar-mensalistas-csv')
    ?.addEventListener('click', () => exportarMensalistas('csv'))
  document
    .getElementById('btn-exportar-mensalistas-excel')
    ?.addEventListener('click', () => exportarMensalistas('excel'))

  modalEl?.addEventListener('hidden.bs.modal', resetFormulario)
})

// Monta as linhas "achatadas" a partir da lista já filtrada pela busca/
// status ativos na tela, e delega para o exportador genérico (CSV/Excel).
// O CPF sai mascarado no arquivo, mesma regra de exibição usada na tabela.
function exportarMensalistas (formato) {
  const colunas = [
    { chave: 'nome', rotulo: 'Nome' },
    { chave: 'cpf', rotulo: 'CPF' },
    { chave: 'telefone', rotulo: 'Telefone' },
    { chave: 'placa', rotulo: 'Placa' },
    { chave: 'mensalidade', rotulo: 'Mensalidade (R$)' },
    { chave: 'status', rotulo: 'Status' }
  ]

  const linhas = mensalistasFiltradosAtual.map(m => ({
    nome: m.nome,
    cpf:
      typeof LGPDModule !== 'undefined' &&
      typeof LGPDModule.maskCPF === 'function'
        ? LGPDModule.maskCPF(m.cpf)
        : mascararCpfFallback(m.cpf),
    telefone: m.telefone || '-',
    placa: m.placa,
    mensalidade: Number(m.valorMensalidade || 0).toFixed(2).replace('.', ','),
    status: m.ativo === true ? 'Ativo' : 'Inativo'
  }))

  if (formato === 'excel') {
    exportarParaExcel(
      'mensalistas-parkgestao.xlsx',
      'Mensalistas',
      colunas,
      linhas
    )
  } else {
    exportarParaCSV('mensalistas-parkgestao.csv', colunas, linhas)
  }
}

// Aplica máscaras e tratamento de input em tempo real
function initInputMasks () {
  const cpfInput = document.getElementById('mensalista-cpf')
  const placaInput = document.getElementById('mensalista-placa')
  const telInput = document.getElementById('mensalista-telefone')

  cpfInput?.addEventListener('input', e => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 11) value = value.slice(0, 11)
    value = value.replace(/(\d{3})(\d)/, '$1.$2')
    value = value.replace(/(\d{3})(\d)/, '$1.$2')
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    e.target.value = value
  })

  telInput?.addEventListener('input', e => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 11) value = value.slice(0, 11)
    value = value.replace(/^(\d{2})(\d)/g, '($1) $2')
    value = value.replace(/(\d)(\d{4})$/, '$1-$2')
    e.target.value = value
  })

  placaInput?.addEventListener('input', e => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (value.length > 7) value = value.slice(0, 7)
    e.target.value = value
  })
}

// Validação de CPF: apenas estrutura (11 dígitos numéricos preenchidos via
// máscara), sem cálculo de dígito verificador — conforme especificação.
function validarCPF (cpf) {
  const cleanCPF = (cpf || '').replace(/\D/g, '')
  return cleanCPF.length === 11
}

// Algoritmo de Validação de Placa (Mercosul ou Padrão Antigo)
function validarPlaca (placa) {
  const cleanPlaca = (placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const regexAntigo = /^[A-Z]{3}[0-9]{4}$/
  const regexMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/
  return regexAntigo.test(cleanPlaca) || regexMercosul.test(cleanPlaca)
}

// Busca a lista de mensalistas da API
async function carregarMensalistas () {
  const pageError = document.getElementById('page-error')
  const pageErrorText = document.getElementById('page-error-text')
  const tbody = document.getElementById('tbody-mensalistas')

  pageError?.classList.add('d-none')
  tbody?.setAttribute('aria-busy', 'true')

  try {
    mensalistasCache = await ApiService.getMensalistas()
    aplicarFiltros()
  } catch (error) {
    console.error('Erro ao carregar mensalistas:', error)

    // Sessão expirada (401) já é tratada por AuthService.tratarSessaoExpirada
    // — logout + redirect pro login já disparados a essa altura.
    if (typeof AuthService !== 'undefined' && !AuthService.estaLogado()) {
      return
    }

    if (pageError && pageErrorText) {
      pageErrorText.textContent =
        'Não foi possível carregar os mensalistas. Verifique sua conexão e tente novamente.'
      pageError.classList.remove('d-none')
    }

    Swal.fire({
      icon: 'error',
      title: 'Erro de Conexão',
      text: 'Não foi possível carregar a lista de mensalistas.'
    })
  } finally {
    tbody?.setAttribute('aria-busy', 'false')
  }
}

// Aplica busca por texto + filtro de status
function aplicarFiltros () {
  const termo = (document.getElementById('input-busca-mensalista')?.value || '')
    .toLowerCase()
    .trim()
  const statusFiltro =
    document.getElementById('filtro-status-mensalista')?.value || 'TODOS'

  let filtrados = mensalistasCache

  if (statusFiltro === 'ativo') {
    filtrados = filtrados.filter(m => m.ativo === true)
  } else if (statusFiltro === 'inativo') {
    filtrados = filtrados.filter(m => m.ativo !== true)
  }

  if (termo) {
    const termoClean = termo.replace(/\D/g, '')
    filtrados = filtrados.filter(
      m =>
        (m.nome || '').toLowerCase().includes(termo) ||
        (m.placa || '').toLowerCase().includes(termo) ||
        (m.cpf || '').includes(termo) ||
        (termoClean && (m.cpf || '').replace(/\D/g, '').includes(termoClean))
    )
  }

  mensalistasFiltradosAtual = filtrados
  renderizarTabelaMensalistas(filtrados)
}

// Mascara CPF para LGPD (ex: ***.***.**0-00)
function mascararCpfFallback (cpf) {
  if (!cpf) return ''
  const digitos = cpf.replace(/\D/g, '')
  if (digitos.length < 4) return '***.***.***-**'
  return `***.***.**${digitos.slice(-4, -2)}-${digitos.slice(-2)}`
}

// Renderiza a tabela de mensalistas
const paginadorMensalistas =
  typeof criarPaginador === 'function'
    ? criarPaginador({
      idSufixo: 'mensalistas',
      tbodyId: 'tbody-mensalistas',
      colspanVazio: 7,
      textoVazio:
          '<i class="fas fa-search me-2" aria-hidden="true"></i>Nenhum mensalista encontrado.',
      renderLinha: renderLinhaMensalista,
      aposRenderizar: ligarBotoesLinhaMensalista
    })
    : null

function renderLinhaMensalista (m, tbody) {
  const tr = document.createElement('tr')

  const cpfMascarado =
    typeof LGPDModule !== 'undefined' &&
    typeof LGPDModule.maskCPF === 'function'
      ? LGPDModule.maskCPF(m.cpf)
      : mascararCpfFallback(m.cpf)

  const ativo = m.ativo === true
  const statusBadge = ativo
    ? '<span class="badge-status status-ativo"><i class="fas fa-check-circle me-1" aria-hidden="true"></i>Ativo</span>'
    : '<span class="badge-status status-inativo"><i class="fas fa-ban me-1" aria-hidden="true"></i>Inativo</span>'

  const btnToggleLabel = ativo ? 'Inativar' : 'Reativar'
  const btnToggleIcon = ativo ? 'fa-user-slash' : 'fa-user-check'
  const btnToggleClasse = ativo ? 'btn-outline-danger' : 'btn-outline-success'

  tr.innerHTML = `
      <td class="fw-bold">${ApiService.sanitizeText(m.nome)}</td>
      <td><code>${ApiService.sanitizeText(cpfMascarado)}</code></td>
      <td>${ApiService.sanitizeText(m.telefone || '-')}</td>
      <td><span class="badge bg-dark text-white">${ApiService.sanitizeText(
        m.placa
      )}</span></td>
      <td>R$ ${Number(m.valorMensalidade || 0).toFixed(2).replace('.', ',')}</td>
      <td>${statusBadge}</td>
      <td>
        <button type="button" class="btn btn-sm btn-outline-primary me-1 btn-editar-mensalista"
          data-id="${
            m.id
          }" title="Editar Mensalista" aria-label="Editar ${ApiService.sanitizeText(
    m.nome
  )}">
          <i class="fas fa-edit" aria-hidden="true"></i>
        </button>
        <button type="button" class="btn btn-sm ${btnToggleClasse} btn-toggle-ativo-mensalista"
          data-id="${m.id}" title="${btnToggleLabel} Mensalista"
          aria-label="${btnToggleLabel} ${ApiService.sanitizeText(m.nome)}">
          <i class="fas ${btnToggleIcon} me-1" aria-hidden="true"></i>${btnToggleLabel}
        </button>
        <button type="button" class="btn btn-sm btn-outline-info ms-1 btn-cobrancas-mensalista"
          data-id="${m.id}" title="Ver cobranças" aria-label="Ver cobranças de ${ApiService.sanitizeText(m.nome)}">
          <i class="fas fa-file-invoice-dollar" aria-hidden="true"></i>
        </button>
      </td>
    `
  tbody.appendChild(tr)
}

function ligarBotoesLinhaMensalista (tbody) {
  tbody.querySelectorAll('.btn-editar-mensalista').forEach(btn => {
    btn.addEventListener('click', () =>
      editarMensalista(btn.getAttribute('data-id'))
    )
  })
  tbody.querySelectorAll('.btn-toggle-ativo-mensalista').forEach(btn => {
    btn.addEventListener('click', () =>
      alternarAtivoMensalista(btn.getAttribute('data-id'))
    )
  })
  tbody.querySelectorAll('.btn-cobrancas-mensalista').forEach(btn => {
    btn.addEventListener('click', () =>
      abrirCobrancasMensalista(btn.getAttribute('data-id'))
    )
  })
}

function renderizarTabelaMensalistas (lista) {
  if (paginadorMensalistas) {
    paginadorMensalistas.definirItens(lista || [])
    return
  }

  const tbody = document.getElementById('tbody-mensalistas')
  if (!tbody) return
  tbody.innerHTML = ''
  ;(lista || []).forEach(m => renderLinhaMensalista(m, tbody))
  ligarBotoesLinhaMensalista(tbody)
}

// Verifica duplicidade de CPF e Placa
function verificarDuplicidade (cpf, placa, idAtual) {
  const cpfClean = (cpf || '').replace(/\D/g, '')
  const placaClean = (placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

  const cpfDuplicado = mensalistasCache.some(
    m =>
      String(m.id) !== String(idAtual) &&
      (m.cpf || '').replace(/\D/g, '') === cpfClean
  )
  const placaDuplicada = mensalistasCache.some(
    m =>
      String(m.id) !== String(idAtual) &&
      (m.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === placaClean
  )

  if (cpfDuplicado) return 'Este CPF já está cadastrado para outro mensalista.'
  if (placaDuplicada) { return 'Esta placa já está cadastrada para outro mensalista.' }
  return null
}

// Submissão do formulário (Criar / Editar)
async function salvarMensalista (e) {
  e.preventDefault()

  const id = document.getElementById('mensalista-id').value || null
  const nome = document.getElementById('mensalista-nome').value.trim()
  const cpf = document.getElementById('mensalista-cpf').value.trim()
  const telefone = document.getElementById('mensalista-telefone').value.trim()
  const placa = document
    .getElementById('mensalista-placa')
    .value.trim()
    .toUpperCase()
  const valorMensalidade = Number(
    document.getElementById('mensalista-valor-mensalidade').value
  )

  // 1. Validação do Nome Completo (NOVA VALIDAÇÃO)
  if (!nome) {
    const inputNome = document.getElementById('mensalista-nome')
    inputNome?.classList.add('is-invalid')
    inputNome?.focus()

    Swal.fire({
      icon: 'warning',
      title: 'Nome Obrigatório',
      text: 'Por favor, informe o nome completo do mensalista antes de salvar.'
    })
    return
  } else {
    document.getElementById('mensalista-nome')?.classList.remove('is-invalid')
  }

  // 2. Validação de CPF
  if (!validarCPF(cpf)) {
    Swal.fire({
      icon: 'warning',
      title: 'CPF Inválido',
      text: 'O CPF informado é inválido. Por favor, verifique os dígitos e tente novamente.'
    })
    return
  }

  // 3. Validação de Telefone (obrigatório)
  if ((telefone || '').replace(/\D/g, '').length < 10) {
    Swal.fire({
      icon: 'warning',
      title: 'Telefone Obrigatório',
      text: 'Informe um telefone válido com DDD para o mensalista.'
    })
    return
  }

  // 4. Validação de Placa
  if (!validarPlaca(placa)) {
    Swal.fire({
      icon: 'warning',
      title: 'Placa Inválida',
      text: 'Formato de placa inválido. Utilize o formato Mercosul (ABC1D23) ou antigo (ABC1234).'
    })
    return
  }

  // 5. Validação da Mensalidade
  if (!valorMensalidade || valorMensalidade <= 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Mensalidade Obrigatória',
      text: 'Informe o valor da mensalidade (maior que zero) antes de salvar.'
    })
    return
  }

  // 6. Validação de Duplicidade
  const erroDuplicidade = verificarDuplicidade(cpf, placa, id)
  if (erroDuplicidade) {
    Swal.fire({
      icon: 'warning',
      title: 'Dado duplicado',
      text: erroDuplicidade
    })
    return
  }

  const btnSalvar = document.getElementById('btn-salvar-mensalista')
  btnSalvar.disabled = true

  try {
    if (id) {
      await ApiService.updateMensalista(id, {
        nome,
        cpf,
        telefone,
        placa,
        valorMensalidade
      })
      toastSucesso('Mensalista atualizado com sucesso.')
    } else {
      await ApiService.createMensalista({
        nome,
        cpf,
        telefone,
        placa,
        valorMensalidade,
        ativo: true
      })
      toastSucesso('Novo mensalista adicionado com sucesso.')
    }

    modalMensalistaBS.hide()
    resetFormulario()
    await carregarMensalistas()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao Salvar',
      text: error.message || 'Ocorreu um erro ao tentar salvar os dados.'
    })
  } finally {
    btnSalvar.disabled = false
  }
}

// Prepara o modal para edição
function editarMensalista (id) {
  const m = mensalistasCache.find(item => String(item.id) === String(id))
  if (!m) return

  document.getElementById('mensalista-id').value = m.id
  document.getElementById('mensalista-nome').value = m.nome
  document.getElementById('mensalista-cpf').value = m.cpf
  document.getElementById('mensalista-telefone').value = m.telefone || ''
  document.getElementById('mensalista-placa').value = m.placa
  document.getElementById('mensalista-valor-mensalidade').value =
    m.valorMensalidade || ''

  document.getElementById('modalMensalistaLabel').innerHTML =
    '<i class="fas fa-user-edit text-primary me-2" aria-hidden="true"></i>Editar Mensalista'
  modalMensalistaBS.show()
}

// Inativa ou reativa um mensalista
async function alternarAtivoMensalista (id) {
  const m = mensalistasCache.find(item => String(item.id) === String(id))
  if (!m) return

  const ativoAtual = m.ativo === true
  const acao = ativoAtual ? 'inativar' : 'reativar'

  const result = await Swal.fire({
    title: ativoAtual ? 'Inativar mensalista?' : 'Reativar mensalista?',
    html: ativoAtual
      ? `O mensalista <strong>${ApiService.sanitizeText(
          m.nome
        )}</strong> ficará inativo. A placa dele não poderá mais ser usada para abrir tickets como mensalista, o histórico é mantido, e a mensalidade deste mês é fechada agora com valor proporcional aos dias em que ele esteve ativo.`
      : `O mensalista <strong>${ApiService.sanitizeText(
          m.nome
        )}</strong> voltará a ficar ativo e a mensalidade deste mês volta a valer o valor cheio.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: ativoAtual ? '#3d0c13' : '#0e3a2f',
    cancelButtonColor: '#6c757d',
    confirmButtonText: ativoAtual ? 'Sim, inativar' : 'Sim, reativar',
    cancelButtonText: 'Cancelar'
  })

  if (!result.isConfirmed) return

  try {
    await ApiService.updateMensalista(id, { ativo: !ativoAtual })
    toastSucesso(
      ativoAtual ? 'Mensalista inativado.' : 'Mensalista reativado.'
    )
    await carregarMensalistas()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: `Erro ao ${acao}`,
      text: error.message
    })
  }
}

// Formata a referência do ciclo ("2026-08") como "08/2026"
function formatarReferenciaMensalidade (referencia) {
  const [ano, mes] = String(referencia || '').split('-')
  return ano && mes ? `${mes}/${ano}` : referencia || '-'
}

function formatarDataMensalidade (iso) {
  if (!iso) return '-'
  const data = new Date(iso)
  return isNaN(data) ? '-' : data.toLocaleDateString('pt-BR')
}

const ROTULO_STATUS_MENSALIDADE = {
  pendente: 'Pendente',
  paga: 'Paga',
  cancelada: 'Cancelada'
}

// badge-status (assets/scss/_components.scss) não tem uma classe .status-paga
// / .status-cancelada própria — reaproveita as classes já existentes
// (status-pago tem a cor "info", status-cancelado tem a cor de alerta).
const CLASSE_STATUS_MENSALIDADE = {
  pendente: 'status-pendente',
  paga: 'status-pago',
  cancelada: 'status-cancelado'
}

// Monta as linhas da tabela de cobranças exibida no modal "Ver cobranças".
// Ciclos pendentes ganham um botão para marcar como paga; os demais só
// mostram o status.
function montarLinhasCobrancas (mensalidades) {
  if (!mensalidades.length) {
    return '<tr><td colspan="5" class="text-center text-muted py-3">Nenhuma cobrança registrada ainda.</td></tr>'
  }

  return mensalidades
    .map(mv => {
      const acao =
        mv.status === 'pendente'
          ? `<button type="button" class="btn btn-sm btn-outline-success btn-marcar-paga" data-id="${mv.id}">
               <i class="fas fa-check me-1" aria-hidden="true"></i>Marcar como paga
             </button>`
          : '-'

      const diasTexto = mv.diasCobrados === mv.diasNoMes
        ? 'Ciclo completo (30 dias)'
        : `${mv.diasCobrados}/${mv.diasNoMes} dias (ciclo antigo, proporcional)`

      return `
        <tr>
          <td>${formatarReferenciaMensalidade(mv.referencia)}</td>
          <td>${formatarDataMensalidade(mv.dataInicio)} a ${formatarDataMensalidade(mv.dataFim)}</td>
          <td>${diasTexto}</td>
          <td>R$ ${Number(mv.valor || 0).toFixed(2).replace('.', ',')}</td>
          <td><span class="badge-status ${CLASSE_STATUS_MENSALIDADE[mv.status] || ''}">${ROTULO_STATUS_MENSALIDADE[mv.status] || mv.status}</span></td>
          <td>${acao}</td>
        </tr>
      `
    })
    .join('')
}

// Abre o modal com o histórico de ciclos de mensalidade (Mensalidade) do
// mensalista — ele não paga por ticket, paga um ciclo de 30 dias corridos,
// cobrado de uma vez na primeira entrada sem ciclo vigente (ver
// server/services/mensalidade.js).
async function abrirCobrancasMensalista (id) {
  const m = mensalistasCache.find(item => String(item.id) === String(id))
  if (!m) return

  let mensalidades = []
  try {
    mensalidades = await ApiService.getMensalidades(id)
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao carregar cobranças',
      text: error.message
    })
    return
  }

  Swal.fire({
    title: `Cobranças de ${ApiService.sanitizeText(m.nome)}`,
    width: '48rem',
    html: `
      <div class="table-responsive text-start">
        <table class="table table-sm align-middle">
          <thead>
            <tr>
              <th scope="col">Referência</th>
              <th scope="col">Ciclo (30 dias)</th>
              <th scope="col">Dias cobrados</th>
              <th scope="col">Valor</th>
              <th scope="col">Status</th>
              <th scope="col">Ação</th>
            </tr>
          </thead>
          <tbody id="tbody-cobrancas-mensalista">${montarLinhasCobrancas(mensalidades)}</tbody>
        </table>
      </div>
    `,
    showConfirmButton: true,
    confirmButtonText: 'Fechar',
    didOpen: () => {
      Swal.getHtmlContainer()
        ?.querySelectorAll('.btn-marcar-paga')
        .forEach(btn => {
          btn.addEventListener('click', () =>
            marcarMensalidadePaga(btn.getAttribute('data-id'), id)
          )
        })
    }
  })
}

// Marca um ciclo como pago e recarrega a tabela dentro do próprio modal
// aberto, sem precisar fechar e reabrir.
async function marcarMensalidadePaga (mensalidadeId, mensalistaId) {
  try {
    await ApiService.updateMensalidade(mensalidadeId, 'paga')
    const mensalidades = await ApiService.getMensalidades(mensalistaId)
    const tbody = document.getElementById('tbody-cobrancas-mensalista')
    if (tbody) {
      tbody.innerHTML = montarLinhasCobrancas(mensalidades)
      tbody.querySelectorAll('.btn-marcar-paga').forEach(btn => {
        btn.addEventListener('click', () =>
          marcarMensalidadePaga(btn.getAttribute('data-id'), mensalistaId)
        )
      })
    }
    toastSucesso('Cobrança marcada como paga.')
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao atualizar cobrança',
      text: error.message
    })
  }
}

// Limpa os campos do formulário
function resetFormulario () {
  const form = document.getElementById('form-mensalista')
  form?.reset()
  form?.classList.remove('was-validated')
  document.getElementById('mensalista-id').value = ''
  document.getElementById('modalMensalistaLabel').innerHTML =
    '<i class="fas fa-user-plus text-primary me-2" aria-hidden="true"></i>Cadastrar Mensalista'
}
