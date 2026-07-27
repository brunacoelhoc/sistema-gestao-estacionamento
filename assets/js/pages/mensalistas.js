/**
 * Lógica da Página de Gestão de Mensalistas
 * CRUD completo com conformidade LGPD e filtros.
 */

let mensalistasCache = []
let modalMensalistaBS = null

document.addEventListener('DOMContentLoaded', async () => {
  const modalEl = document.getElementById('modalMensalista')
  if (modalEl) {
    modalMensalistaBS = new bootstrap.Modal(modalEl)
  }

  await carregarMensalistas()

  // Evento do formulário de cadastro/edição
  document
    .getElementById('form-mensalista')
    ?.addEventListener('submit', salvarMensalista)

  // Busca em tempo real
  document
    .getElementById('input-busca-mensalista')
    ?.addEventListener('input', e => {
      filtrarMensalistas(e.target.value)
    })

  // Limpa o modal ao fechar
  modalEl?.addEventListener('hidden.bs.modal', resetFormulario)
})

// Busca a lista de mensalistas da API
async function carregarMensalistas () {
  try {
    mensalistasCache = await ApiService.getMensalistas()
    renderizarTabelaMensalistas(mensalistasCache)
  } catch (error) {
    console.error('Erro ao carregar mensalistas:', error)
    Swal.fire({
      icon: 'error',
      title: 'Erro de Conexão',
      text: 'Não foi possível carregar a lista de mensalistas.'
    })
  }
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
          <i class="fas fa-search me-2"></i>Nenhum mensalista encontrado.
        </td>
      </tr>
    `
    return
  }

  lista.forEach(m => {
    const tr = document.createElement('tr')

    // Aplicando mascaramento LGPD no CPF
    const cpfMascarado =
      typeof LGPDModule !== 'undefined'
        ? LGPDModule.maskCPF(m.cpf)
        : ApiService.sanitizeText(m.cpf)

    const isAtivo = m.status === 'Ativo'
    const statusBadge = isAtivo
      ? '<span class="badge bg-success-subtle text-success border border-success"><i class="fas fa-check-circle me-1"></i>Ativo</span>'
      : '<span class="badge bg-danger-subtle text-danger border border-danger"><i class="fas fa-times-circle me-1"></i>Inativo</span>'

    tr.innerHTML = `
      <td class="fw-bold">${ApiService.sanitizeText(m.nome)}</td>
      <td><code>${cpfMascarado}</code></td>
      <td>${ApiService.sanitizeText(m.telefone)}</td>
      <td><span class="badge bg-dark text-white">${ApiService.sanitizeText(
        m.placa
      )}</span></td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editarMensalista('${
          m.id
        }')" title="Editar Mensalista" aria-label="Editar ${ApiService.sanitizeText(
      m.nome
    )}">
          <i class="fas fa-edit" aria-hidden="true"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="excluirMensalista('${
          m.id
        }')" title="Remover Mensalista" aria-label="Excluir ${ApiService.sanitizeText(
      m.nome
    )}">
          <i class="fas fa-trash-alt" aria-hidden="true"></i>
        </button>
      </td>
    `

    tbody.appendChild(tr)
  })
}

// Submissão do formulário (Criar / Editar)
async function salvarMensalista (e) {
  e.preventDefault()

  const id = document.getElementById('mensalista-id').value
  const nome = document.getElementById('mensalista-nome').value.trim()
  const cpf = document.getElementById('mensalista-cpf').value.trim()
  const telefone = document.getElementById('mensalista-telefone').value.trim()
  const placa = document
    .getElementById('mensalista-placa')
    .value.trim()
    .toUpperCase()
  const status = document.getElementById('mensalista-status').value

  // Validação simples de CPF via LGPDModule se disponível
  if (typeof LGPDModule !== 'undefined' && !LGPDModule.validateCPF(cpf)) {
    Swal.fire({
      icon: 'warning',
      title: 'CPF Inválido',
      text: 'Por favor, insira um CPF válido para prosseguir com o cadastro em conformidade.'
    })
    return
  }

  const dadosMensalista = { nome, cpf, telefone, placa, status }

  try {
    if (id) {
      await ApiService.updateMensalista(id, dadosMensalista)
      Swal.fire({
        icon: 'success',
        title: 'Atualizado!',
        text: 'Mensalista atualizado com sucesso.',
        timer: 1500,
        showConfirmButton: false
      })
    } else {
      await ApiService.createMensalista(dadosMensalista)
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
  }
}

// Prepara o modal para edição
function editarMensalista (id) {
  const m = mensalistasCache.find(item => item.id == id)
  if (!m) return

  document.getElementById('mensalista-id').value = m.id
  document.getElementById('mensalista-nome').value = m.nome
  document.getElementById('mensalista-cpf').value = m.cpf
  document.getElementById('mensalista-telefone').value = m.telefone
  document.getElementById('mensalista-placa').value = m.placa
  document.getElementById('mensalista-status').value = m.status

  document.getElementById('modalMensalistaLabel').innerHTML =
    '<i class="fas fa-user-edit text-primary me-2"></i>Editar Mensalista'
  modalMensalistaBS.show()
}

// Exclui um mensalista
async function excluirMensalista (id) {
  const result = await Swal.fire({
    title: 'Excluir Mensalista?',
    text: 'Esta ação removerá permanentemente o cadastro do sistema.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Sim, excluir',
    cancelButtonText: 'Cancelar'
  })

  if (result.isConfirmed) {
    try {
      await ApiService.deleteMensalista(id)
      Swal.fire({
        icon: 'success',
        title: 'Excluído!',
        text: 'Registro removido com sucesso.',
        timer: 1500,
        showConfirmButton: false
      })
      await carregarMensalistas()
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Erro ao Excluir',
        text: error.message
      })
    }
  }
}

// Filtra a tabela localmente
function filtrarMensalistas (termo) {
  const termoLower = termo.toLowerCase().trim()
  if (!termoLower) {
    renderizarTabelaMensalistas(mensalistasCache)
    return
  }

  const filtrados = mensalistasCache.filter(
    m =>
      m.nome.toLowerCase().includes(termoLower) ||
      m.placa.toLowerCase().includes(termoLower) ||
      m.cpf.includes(termoLower)
  )

  renderizarTabelaMensalistas(filtrados)
}

// Limpa os campos do formulário
function resetFormulario () {
  document.getElementById('form-mensalista')?.reset()
  document.getElementById('mensalista-id').value = ''
  document.getElementById('modalMensalistaLabel').innerHTML =
    '<i class="fas fa-user-plus text-primary me-2"></i>Cadastrar Mensalista'
}
