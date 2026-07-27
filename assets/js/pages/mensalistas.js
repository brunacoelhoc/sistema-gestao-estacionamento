/**
 * Lógica da Página de Gestão de Mensalistas
 * CRUD (sem exclusão física) com conformidade LGPD, validações e filtros.
 */

let mensalistasCache = []
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

  modalEl?.addEventListener('hidden.bs.modal', resetFormulario)
})

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

// Algoritmo de Validação Real de CPF (Compatível com Máscara e Validação de DV)
function validarCPF (cpf) {
  // Remove pontos, hífens e qualquer caractere não numérico
  const cleanCPF = (cpf || '').replace(/\D/g, '')

  // 1. Verifica se tem exatamente 11 dígitos numéricos
  if (cleanCPF.length !== 11) return false

  // 2. Elimina CPFs com dígitos repetidos (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false

  // 3. Validação matemática do 1º Dígito Verificador
  let soma = 0
  let resto

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cleanCPF.substring(9, 10))) return false

  // 4. Validação matemática do 2º Dígito Verificador
  soma = 0
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cleanCPF.substring(10, 11))) return false

  return true
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
function renderizarTabelaMensalistas (lista) {
  const tbody = document.getElementById('tbody-mensalistas')
  if (!tbody) return

  tbody.innerHTML = ''

  if (!lista || lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-muted">
          <i class="fas fa-search me-2" aria-hidden="true"></i>Nenhum mensalista encontrado.
        </td>
      </tr>
    `
    return
  }

  lista.forEach(m => {
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
      </td>
    `
    tbody.appendChild(tr)
  })

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
  if (placaDuplicada)
    return 'Esta placa já está cadastrada para outro mensalista.'
  return null
}

// Submissão do formulário (Criar / Editar)
async function salvarMensalista (e) {
  e.preventDefault()
  const form = e.target

  const id = document.getElementById('mensalista-id').value || null
  const nome = document.getElementById('mensalista-nome').value.trim()
  const cpf = document.getElementById('mensalista-cpf').value.trim()
  const telefone = document.getElementById('mensalista-telefone').value.trim()
  const placa = document
    .getElementById('mensalista-placa')
    .value.trim()
    .toUpperCase()

  // Validação de CPF
  if (!validarCPF(cpf)) {
    Swal.fire({
      icon: 'warning',
      title: 'CPF Inválido',
      text: 'O CPF informado é inválido. Por favor, verifique os dígitos e tente novamente.'
    })
    return
  }

  // Validação de Placa
  if (!validarPlaca(placa)) {
    Swal.fire({
      icon: 'warning',
      title: 'Placa Inválida',
      text: 'Formato de placa inválido. Utilize o formato Mercosul (ABC1D23) ou antigo (ABC1234).'
    })
    return
  }

  // Validação de Duplicidade
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
      await ApiService.updateMensalista(id, { nome, cpf, telefone, placa })
      Swal.fire({
        icon: 'success',
        title: 'Atualizado!',
        text: 'Mensalista atualizado com sucesso.',
        timer: 1500,
        showConfirmButton: false
      })
    } else {
      await ApiService.createMensalista({
        nome,
        cpf,
        telefone,
        placa,
        ativo: true
      })
      Swal.fire({
        icon: 'success',
        title: 'Cadastrado!',
        text: 'Novo mensalista adicionado com sucesso.',
        timer: 1500,
        showConfirmButton: false
      })
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
        )}</strong> ficará inativo. A placa dele não poderá mais ser usada para abrir tickets como mensalista, mas o histórico é mantido.`
      : `O mensalista <strong>${ApiService.sanitizeText(
          m.nome
        )}</strong> voltará a ficar ativo.`,
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
    Swal.fire({
      icon: 'success',
      title: ativoAtual ? 'Mensalista inativado.' : 'Mensalista reativado.',
      timer: 1500,
      showConfirmButton: false
    })
    await carregarMensalistas()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: `Erro ao ${acao}`,
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
