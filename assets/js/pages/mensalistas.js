/**
 * Lógica da Página de Gestão de Mensalistas
 * CRUD (sem exclusão física) com conformidade LGPD e filtros.
 */

let mensalistasCache = []
let modalMensalistaBS = null

document.addEventListener('DOMContentLoaded', async () => {
  const modalEl = document.getElementById('modalMensalista')
  if (modalEl) {
    modalMensalistaBS = new bootstrap.Modal(modalEl)
  }

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

// Aplica busca por texto + filtro de status juntos
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
    filtrados = filtrados.filter(
      m =>
        (m.nome || '').toLowerCase().includes(termo) ||
        (m.placa || '').toLowerCase().includes(termo) ||
        (m.cpf || '').includes(termo)
    )
  }

  renderizarTabelaMensalistas(filtrados)
}

// Mascara um CPF no formato 000.000.000-00 -> ***.***.**0-00, preservando só
// os últimos dígitos. Usada como fallback caso o LGPDModule não tenha
// carregado — por segurança/LGPD, o padrão é ESCONDER o dado (falhar
// fechado), nunca mostrar o CPF completo por acidente.
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
      ? '<span class="badge-status status-ativo"><i class="fas fa-check-circle" aria-hidden="true"></i> Ativo</span>'
      : '<span class="badge-status status-inativo"><i class="fas fa-ban" aria-hidden="true"></i> Inativo</span>'

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
          <i class="fas ${btnToggleIcon}" aria-hidden="true"></i> ${btnToggleLabel}
        </button>
      </td>
    `
    // NOTA: propositalmente não existe botão de excluir nesta tela — a spec
    // exige que mensalistas sejam apenas inativados/reativados, nunca
    // apagados fisicamente, para preservar o histórico de tickets.

    tbody.appendChild(tr)
  })

  // Eventos vinculados após o render (evita onclick inline no HTML gerado)
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

// Verifica duplicidade de CPF/placa, ignorando o próprio registro em edição
function verificarDuplicidade (cpf, placa, idAtual) {
  const cpfDuplicado = mensalistasCache.some(
    m => m.id !== idAtual && m.cpf === cpf
  )
  const placaDuplicada = mensalistasCache.some(
    m =>
      m.id !== idAtual && (m.placa || '').toUpperCase() === placa.toUpperCase()
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

  // Validação nativa (required + pattern de CPF/placa já definidos no HTML)
  if (!form.checkValidity()) {
    form.classList.add('was-validated')
    return
  }

  const id = document.getElementById('mensalista-id').value || null
  const nome = document.getElementById('mensalista-nome').value.trim()
  const cpf = document.getElementById('mensalista-cpf').value.trim()
  const telefone = document.getElementById('mensalista-telefone').value.trim()
  const placa = document
    .getElementById('mensalista-placa')
    .value.trim()
    .toUpperCase()

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
  btnSalvar.disabled = true // anti duplo-clique

  try {
    if (id) {
      // Edição: nunca envia "ativo" — esse campo só muda pelo botão da listagem.
      await ApiService.updateMensalista(id, { nome, cpf, telefone, placa })
      Swal.fire({
        icon: 'success',
        title: 'Atualizado!',
        text: 'Mensalista atualizado com sucesso.',
        timer: 1500,
        showConfirmButton: false
      })
    } else {
      // Criação: todo mensalista novo começa ativo, por padrão do sistema.
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

// Prepara o modal para edição (nome/CPF/placa/telefone apenas — status não é editável aqui)
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

// Inativa ou reativa um mensalista (nunca exclui fisicamente)
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
    confirmButtonColor: ativoAtual ? '#3d0c13' : '#0e3a2f', // $color-alerta-text / $color-sucesso-text
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
