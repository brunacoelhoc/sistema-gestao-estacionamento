/**
 * Lógica da Página de Gestão de Funcionários (área administrativa)
 * CRUD (sem exclusão física, só inativação) dos usuários do sistema.
 */

let funcionariosCache = []

// Formata uma data para o padrão brasileiro dd/mm/aaaa. Aceita tanto o
// yyyy-mm-dd puro de <input type="date"> quanto o ISO completo com timestamp
// que a API devolve (ex.: "1998-04-12T00:00:00.000Z") — usar só os 10
// primeiros caracteres evita tanto o timestamp "vazar" para dentro da data
// exibida quanto o deslocamento de dia que new Date(iso) + toLocaleDateString
// causaria ao converter a meia-noite UTC para o fuso local. Retorna "-" se
// não houver data.
function formatarDataBr (dataIso) {
  if (!dataIso) return '-'
  const partes = String(dataIso).slice(0, 10).split('-')
  if (partes.length !== 3) return '-'
  const [ano, mes, dia] = partes
  return `${dia}/${mes}/${ano}`
}

// Máscara simples de CEP (00000-000)
function ligarMascaraCep (idInput) {
  const input = document.getElementById(idInput)
  if (!input) return
  input.addEventListener('input', e => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 8)
    value = value.replace(/(\d{5})(\d)/, '$1-$2')
    e.target.value = value
  })
}

// Busca o endereço pelo CEP (ViaCEP) e preenche rua/bairro/cidade/estado
// automaticamente, deixando para a pessoa só completar número e complemento.
async function buscarEnderecoPorCep (idCep, prefixo) {
  const inputCep = document.getElementById(idCep)
  const cep = (inputCep?.value || '').replace(/\D/g, '')
  const elRua = document.getElementById(`${prefixo}-rua`)
  const elBairro = document.getElementById(`${prefixo}-bairro`)
  const elCidade = document.getElementById(`${prefixo}-cidade`)
  const elEstado = document.getElementById(`${prefixo}-estado`)
  const elStatus = document.getElementById(`${prefixo}-cep-status`)

  if (cep.length !== 8) {
    if (elStatus) elStatus.textContent = ''
    return
  }

  if (elStatus) {
    elStatus.textContent = 'Buscando endereço...'
    elStatus.className = 'form-text text-muted'
  }

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
    const dados = await resposta.json()

    if (dados.erro) {
      if (elStatus) {
        elStatus.textContent = 'CEP não encontrado. Preencha o endereço manualmente.'
        elStatus.className = 'form-text text-warning'
      }
      return
    }

    if (elRua) elRua.value = dados.logradouro || ''
    if (elBairro) elBairro.value = dados.bairro || ''
    if (elCidade) elCidade.value = dados.localidade || ''
    if (elEstado) elEstado.value = dados.uf || ''

    if (elStatus) {
      elStatus.textContent = 'Endereço encontrado. Confira e complete o número.'
      elStatus.className = 'form-text text-success'
    }

    document.getElementById(`${prefixo}-numero`)?.focus()
  } catch (erro) {
    if (elStatus) {
      elStatus.textContent = 'Não foi possível buscar o CEP agora. Preencha o endereço manualmente.'
      elStatus.className = 'form-text text-warning'
    }
  }
}

// Monta a string final de endereço (mesmo formato já usado no cadastro:
// "Rua, número (complemento) - Bairro, Cidade - UF") a partir dos campos
// separados preenchidos via busca de CEP.
function montarEnderecoFinal (prefixo) {
  const rua = document.getElementById(`${prefixo}-rua`)?.value.trim() || ''
  const numero = document.getElementById(`${prefixo}-numero`)?.value.trim() || ''
  const complemento =
    document.getElementById(`${prefixo}-complemento`)?.value.trim() || ''
  const bairro = document.getElementById(`${prefixo}-bairro`)?.value.trim() || ''
  const cidade = document.getElementById(`${prefixo}-cidade`)?.value.trim() || ''
  const estado = document.getElementById(`${prefixo}-estado`)?.value.trim() || ''

  if (!rua && !numero && !bairro && !cidade && !estado) return ''

  const numeroComplemento = complemento ? `${numero} (${complemento})` : numero
  return `${rua}, ${numeroComplemento} - ${bairro}, ${cidade} - ${estado}`
}

// Bloco HTML reutilizável de CEP/endereço (cadastro e edição de funcionário)
function blocoEnderecoHtml (prefixo, valores = {}) {
  return `
    <div class="text-start mb-3">
      <label class="form-label fw-bold">CEP</label>
      <div class="input-group">
        <input id="${prefixo}-cep" class="form-control" inputmode="numeric" maxlength="9"
          placeholder="00000-000" value="${valores.cep || ''}">
        <button type="button" class="btn btn-outline-secondary" id="${prefixo}-btn-buscar-cep">
          <i class="fas fa-search me-1" aria-hidden="true"></i>Buscar
        </button>
      </div>
      <div id="${prefixo}-cep-status" class="form-text">Digite o CEP para preencher rua, bairro, cidade e estado automaticamente.</div>
    </div>
    <div class="row g-2 text-start mb-3">
      <div class="col-8">
        <label class="form-label fw-bold">Rua</label>
        <input id="${prefixo}-rua" class="form-control" value="${valores.rua || ''}">
      </div>
      <div class="col-4">
        <label class="form-label fw-bold">Número</label>
        <input id="${prefixo}-numero" class="form-control" value="${valores.numero || ''}">
      </div>
    </div>
    <div class="row g-2 text-start mb-3">
      <div class="col-6">
        <label class="form-label fw-bold">Complemento <span class="text-muted fw-normal">(opcional)</span></label>
        <input id="${prefixo}-complemento" class="form-control" value="${valores.complemento || ''}">
      </div>
      <div class="col-6">
        <label class="form-label fw-bold">Bairro</label>
        <input id="${prefixo}-bairro" class="form-control" value="${valores.bairro || ''}">
      </div>
    </div>
    <div class="row g-2 text-start mb-3">
      <div class="col-8">
        <label class="form-label fw-bold">Cidade</label>
        <input id="${prefixo}-cidade" class="form-control" value="${valores.cidade || ''}">
      </div>
      <div class="col-4">
        <label class="form-label fw-bold">Estado (UF)</label>
        <input id="${prefixo}-estado" class="form-control" maxlength="2" value="${valores.estado || ''}">
      </div>
    </div>
  `
}

// Liga a máscara de CEP e a busca automática (ao completar 8 dígitos ou ao
// clicar em "Buscar") para um bloco de endereço já renderizado no DOM.
function ligarBuscaCep (prefixo) {
  ligarMascaraCep(`${prefixo}-cep`)
  const inputCep = document.getElementById(`${prefixo}-cep`)
  inputCep?.addEventListener('blur', () => buscarEnderecoPorCep(`${prefixo}-cep`, prefixo))
  document
    .getElementById(`${prefixo}-btn-buscar-cep`)
    ?.addEventListener('click', () => buscarEnderecoPorCep(`${prefixo}-cep`, prefixo))
}

// Separa uma string de endereço já salva no formato "Rua, número (compl) -
// Bairro, Cidade - UF" de volta em campos, para pré-preencher a edição.
function desmontarEndereco (enderecoCompleto) {
  const vazio = { rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' }
  if (!enderecoCompleto) return vazio

  // Formato salvo: "Rua, número (complemento) - Bairro, Cidade - UF"
  const partes = enderecoCompleto.split(' - ')
  if (partes.length < 3) return { ...vazio, rua: enderecoCompleto }

  const [ruaNumero, bairroCidade, estado] = partes
  const matchRuaNumero = ruaNumero.match(/^(.*),\s*(.*)$/)
  const rua = matchRuaNumero ? matchRuaNumero[1].trim() : ruaNumero.trim()
  const numeroBruto = matchRuaNumero ? matchRuaNumero[2].trim() : ''
  const matchComplemento = numeroBruto.match(/^(.*)\((.*)\)$/)
  const numero = matchComplemento ? matchComplemento[1].trim() : numeroBruto
  const complemento = matchComplemento ? matchComplemento[2].trim() : ''

  const matchBairroCidade = bairroCidade.match(/^(.*),\s*(.*)$/)
  const bairro = matchBairroCidade
    ? matchBairroCidade[1].trim()
    : bairroCidade.trim()
  const cidade = matchBairroCidade ? matchBairroCidade[2].trim() : ''

  return { rua, numero, complemento, bairro, cidade, estado: (estado || '').trim() }
}

document.addEventListener('DOMContentLoaded', async () => {
  await carregarFuncionarios()

  document
    .getElementById('btn-novo-funcionario')
    ?.addEventListener('click', abrirModalNovoFuncionario)

  document
    .getElementById('input-busca-funcionario')
    ?.addEventListener('input', aplicarFiltros)

  document
    .getElementById('filtro-status-funcionario')
    ?.addEventListener('change', aplicarFiltros)

  document.getElementById('btn-retry-page')?.addEventListener('click', () => {
    carregarFuncionarios()
  })
})

async function carregarFuncionarios () {
  const pageError = document.getElementById('page-error')
  const pageErrorText = document.getElementById('page-error-text')
  const tbody = document.getElementById('tbody-funcionarios')

  pageError?.classList.add('d-none')
  tbody?.setAttribute('aria-busy', 'true')

  try {
    funcionariosCache = await ApiService.getUsuarios()
    aplicarFiltros()
  } catch (error) {
    console.error('Erro ao carregar funcionários:', error)

    // Sessão expirada (401) já é tratada por AuthService.tratarSessaoExpirada
    // — logout + redirect pro login já disparados a essa altura.
    if (typeof AuthService !== 'undefined' && !AuthService.estaLogado()) {
      return
    }

    if (pageError && pageErrorText) {
      pageErrorText.textContent =
        'Não foi possível carregar os funcionários. Verifique sua conexão e tente novamente.'
      pageError.classList.remove('d-none')
    }

    Swal.fire({
      icon: 'error',
      title: 'Erro de Conexão',
      text: 'Não foi possível carregar a lista de funcionários.'
    })
  } finally {
    tbody?.setAttribute('aria-busy', 'false')
  }
}

function aplicarFiltros () {
  const termo = (
    document.getElementById('input-busca-funcionario')?.value || ''
  )
    .toLowerCase()
    .trim()
  const statusFiltro =
    document.getElementById('filtro-status-funcionario')?.value || 'TODOS'

  let filtrados = funcionariosCache

  if (statusFiltro === 'ativo') {
    filtrados = filtrados.filter(u => u.ativo === true)
  } else if (statusFiltro === 'inativo') {
    filtrados = filtrados.filter(u => u.ativo !== true)
  }

  if (termo) {
    filtrados = filtrados.filter(
      u =>
        (u.nome || '').toLowerCase().includes(termo) ||
        (u.email || '').toLowerCase().includes(termo)
    )
  }

  renderizarTabelaFuncionarios(filtrados)
}

const paginadorFuncionarios =
  typeof criarPaginador === 'function'
    ? criarPaginador({
      idSufixo: 'funcionarios',
      tbodyId: 'tbody-funcionarios',
      colspanVazio: 8,
      textoVazio:
          '<i class="fas fa-search me-2" aria-hidden="true"></i>Nenhum funcionário encontrado.',
      renderLinha: renderLinhaFuncionario,
      aposRenderizar: ligarBotoesLinhaFuncionario
    })
    : null

function renderizarTabelaFuncionarios (lista) {
  if (paginadorFuncionarios) {
    paginadorFuncionarios.definirItens(lista || [])
    return
  }

  const tbody = document.getElementById('tbody-funcionarios')
  if (!tbody) return
  tbody.innerHTML = ''
  ;(lista || []).forEach(u => renderLinhaFuncionario(u, tbody))
  ligarBotoesLinhaFuncionario(tbody)
}

function renderLinhaFuncionario (u, tbody) {
  const sessao = AuthService.getSessao()
  const tr = document.createElement('tr')

  const ativo = u.ativo === true
  const statusBadge = ativo
    ? '<span class="badge-status status-ativo"><i class="fas fa-check-circle me-1" aria-hidden="true"></i>Ativo</span>'
    : '<span class="badge-status status-inativo"><i class="fas fa-ban me-1" aria-hidden="true"></i>Inativo</span>'

  const papelBadge =
    u.role === 'admin'
      ? '<span class="badge bg-primary">Admin</span>'
      : '<span class="badge bg-secondary">Funcionário</span>'

  const ehVoceMesmo = sessao && String(sessao.id) === String(u.id)

  const btnToggleLabel = ativo ? 'Inativar' : 'Reativar'
  const btnToggleIcon = ativo ? 'fa-user-slash' : 'fa-user-check'
  const btnToggleClasse = ativo ? 'btn-outline-danger' : 'btn-outline-success'

  const aniversarioFormatado = formatarDataBr(u.dataNascimento)

  tr.innerHTML = `
      <td class="fw-bold">${ApiService.sanitizeText(u.nome)}</td>
      <td>${ApiService.sanitizeText(u.cpf || '-')}</td>
      <td>${ApiService.sanitizeText(u.email)}</td>
      <td>${ApiService.sanitizeText(u.telefone || '-')}</td>
      <td>${aniversarioFormatado}</td>
      <td>${papelBadge}</td>
      <td>${statusBadge}</td>
      <td>
        <button type="button" class="btn btn-sm btn-outline-primary me-1 btn-editar-funcionario"
          data-id="${u.id}" title="Editar Funcionário" aria-label="Editar ${ApiService.sanitizeText(u.nome)}">
          <i class="fas fa-edit" aria-hidden="true"></i>
        </button>
        <button type="button" class="btn btn-sm ${btnToggleClasse} btn-toggle-ativo-funcionario"
          data-id="${u.id}" title="${btnToggleLabel} Funcionário"
          aria-label="${btnToggleLabel} ${ApiService.sanitizeText(u.nome)}" ${ehVoceMesmo ? 'disabled' : ''}>
          <i class="fas ${btnToggleIcon} me-1" aria-hidden="true"></i>${btnToggleLabel}
        </button>
      </td>
    `
  tbody.appendChild(tr)
}

function ligarBotoesLinhaFuncionario (tbody) {
  tbody.querySelectorAll('.btn-editar-funcionario').forEach(btn => {
    btn.addEventListener('click', () =>
      abrirModalEditarFuncionario(btn.getAttribute('data-id'))
    )
  })
  tbody.querySelectorAll('.btn-toggle-ativo-funcionario').forEach(btn => {
    btn.addEventListener('click', () =>
      alternarAtivoFuncionario(btn.getAttribute('data-id'))
    )
  })
}

async function abrirModalNovoFuncionario () {
  let senhaTemporariaAtual = gerarSenhaTemporaria()

  const { value: formValues } = await Swal.fire({
    title: 'Novo Funcionário',
    html: `
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Nome completo <span class="text-danger">*</span></label>
        <input id="swal-func-nome" class="form-control">
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">CPF <span class="text-danger">*</span></label>
        <input id="swal-func-cpf" class="form-control" inputmode="numeric" maxlength="14"
          placeholder="000.000.000-00">
        <div class="form-text">Usado pelo funcionário para entrar no sistema.</div>
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">E-mail <span class="text-danger">*</span></label>
        <input id="swal-func-email" type="email" class="form-control">
        <div class="form-text">Usado para recuperação de senha.</div>
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Telefone <span class="text-danger">*</span></label>
        <input id="swal-func-telefone" class="form-control" inputmode="tel" maxlength="15"
          placeholder="(11) 98765-4321">
      </div>
      ${blocoEnderecoHtml('swal-func')}
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Data de nascimento <span class="text-danger">*</span></label>
        <input id="swal-func-nascimento" type="date" class="form-control" max="${new Date().toISOString().slice(0, 10)}">
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Papel de acesso <span class="text-danger">*</span></label>
        <select id="swal-func-role" class="form-select">
          <option value="funcionario" selected>Funcionário</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Senha temporária <span class="text-danger">*</span></label>
        <div class="input-group">
          <input id="swal-func-senha" class="form-control" readonly value="${senhaTemporariaAtual}">
          <button type="button" class="btn btn-outline-secondary" id="swal-func-btn-gerar-senha" title="Gerar outra senha">
            <i class="fas fa-rotate" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-outline-secondary" id="swal-func-btn-copiar-senha" title="Copiar senha">
            <i class="fas fa-copy" aria-hidden="true"></i>
          </button>
        </div>
        <div class="form-text">
          Gerada automaticamente. O funcionário será obrigado a trocá-la por uma senha
          permanente no primeiro acesso, e a trocar novamente a cada ${SENHA_VALIDADE_DIAS} dias.
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Cadastrar',
    cancelButtonText: 'Cancelar',
    didOpen: () => {
      ligarMascaraCpf('swal-func-cpf')
      ligarMascaraTelefone('swal-func-telefone')
      ligarBuscaCep('swal-func')

      document
        .getElementById('swal-func-btn-gerar-senha')
        ?.addEventListener('click', () => {
          senhaTemporariaAtual = gerarSenhaTemporaria()
          document.getElementById('swal-func-senha').value = senhaTemporariaAtual
        })
      document
        .getElementById('swal-func-btn-copiar-senha')
        ?.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(senhaTemporariaAtual)
            toastSucesso('Senha copiada!')
          } catch (erro) {
            /* Clipboard indisponível (ex.: contexto não seguro) — sem ação. */
          }
        })
    },
    preConfirm: async () => {
      const nome = document.getElementById('swal-func-nome').value.trim()
      if (!nome) {
        Swal.showValidationMessage('Informe o nome completo do funcionário.')
        return false
      }

      const cpf = document.getElementById('swal-func-cpf').value.trim()
      if (!cpf) {
        Swal.showValidationMessage('Informe o CPF do funcionário.')
        return false
      }
      if (!validarEstruturaCpf(cpf)) {
        Swal.showValidationMessage('Informe um CPF com 11 dígitos.')
        return false
      }

      const email = document.getElementById('swal-func-email').value.trim()
      if (!email) {
        Swal.showValidationMessage('Informe o e-mail do funcionário.')
        return false
      }

      const telefone = document.getElementById('swal-func-telefone').value.trim()
      if (!telefone) {
        Swal.showValidationMessage('Informe o telefone do funcionário.')
        return false
      }

      const cep = document.getElementById('swal-func-cep').value.trim()
      const rua = document.getElementById('swal-func-rua').value.trim()
      const numero = document.getElementById('swal-func-numero').value.trim()
      const bairro = document.getElementById('swal-func-bairro').value.trim()
      const cidade = document.getElementById('swal-func-cidade').value.trim()
      const estado = document.getElementById('swal-func-estado').value.trim()
      if (!cep || !rua || !numero || !bairro || !cidade || !estado) {
        Swal.showValidationMessage(
          'Preencha o endereço completo (CEP, rua, número, bairro, cidade e estado).'
        )
        return false
      }

      const dataNascimento = document.getElementById('swal-func-nascimento').value
      if (!dataNascimento) {
        Swal.showValidationMessage('Informe a data de nascimento.')
        return false
      }

      const role = document.getElementById('swal-func-role').value
      const senha = senhaTemporariaAtual

      const cpfExistente = await ApiService.getUsuarioPorCpf(cpf)
      if (cpfExistente) {
        Swal.showValidationMessage(
          'Já existe um usuário cadastrado com este CPF.'
        )
        return false
      }
      const emailExistente = await ApiService.getUsuarioPorEmail(email)
      if (emailExistente) {
        Swal.showValidationMessage(
          'Já existe um usuário cadastrado com este e-mail.'
        )
        return false
      }

      return {
        nome,
        cpf,
        email,
        telefone,
        endereco: montarEnderecoFinal('swal-func'),
        cep,
        dataNascimento,
        role,
        senha,
        senhaTemporaria: true,
        senhaAlteradaEm: null,
        ativo: true,
        aceitouTermos: true,
        provedor: 'local'
      }
    }
  })

  if (!formValues) return

  try {
    await ApiService.createUsuario(formValues)
    toastSucesso('Funcionário cadastrado!')
    await carregarFuncionarios()
  } catch (error) {
    console.error('Erro ao cadastrar funcionário:', error)
    Swal.fire({
      icon: 'error',
      title: 'Erro ao cadastrar',
      text: 'Comportamento inesperado. Tente novamente.'
    })
  }
}

async function abrirModalEditarFuncionario (id) {
  const usuario = funcionariosCache.find(u => String(u.id) === String(id))
  if (!usuario) return

  const enderecoAtual = desmontarEndereco(usuario.endereco)
  enderecoAtual.cep = usuario.cep || ''

  const { value: formValues } = await Swal.fire({
    title: 'Editar Funcionário',
    html: `
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Nome completo <span class="text-danger">*</span></label>
        <input id="swal-func-nome" class="form-control" value="${ApiService.sanitizeText(usuario.nome)}">
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">CPF <span class="text-danger">*</span></label>
        <input id="swal-func-cpf" class="form-control" inputmode="numeric" maxlength="14"
          value="${ApiService.sanitizeText(usuario.cpf || '')}">
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">E-mail <span class="text-danger">*</span></label>
        <input id="swal-func-email" type="email" class="form-control" value="${ApiService.sanitizeText(usuario.email)}">
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Telefone <span class="text-danger">*</span></label>
        <input id="swal-func-telefone" class="form-control" inputmode="tel" maxlength="15"
          value="${ApiService.sanitizeText(usuario.telefone || '')}">
      </div>
      ${blocoEnderecoHtml('swal-func', enderecoAtual)}
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Data de nascimento <span class="text-danger">*</span></label>
        <input id="swal-func-nascimento" type="date" class="form-control"
          max="${new Date().toISOString().slice(0, 10)}" value="${(usuario.dataNascimento || '').slice(0, 10)}">
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Papel de acesso <span class="text-danger">*</span></label>
        <select id="swal-func-role" class="form-select">
          <option value="funcionario" ${usuario.role !== 'admin' ? 'selected' : ''}>Funcionário</option>
          <option value="admin" ${usuario.role === 'admin' ? 'selected' : ''}>Administrador</option>
        </select>
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Nova senha <span class="text-muted fw-normal">(opcional)</span></label>
        <input id="swal-func-senha" type="password" class="form-control" minlength="8">
        <div class="progress mt-2" style="height: 6px;">
          <div id="swal-func-senha-forca-barra" class="progress-bar" role="progressbar" style="width: 0%"></div>
        </div>
        <div id="swal-func-senha-forca-texto" class="form-text">Deixe em branco para manter a senha atual. Se preencher: mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial. O funcionário será obrigado a trocá-la no próximo acesso.</div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Salvar',
    cancelButtonText: 'Cancelar',
    didOpen: () => {
      ligarMascaraCpf('swal-func-cpf')
      ligarMascaraTelefone('swal-func-telefone')
      ligarBuscaCep('swal-func')
      ligarIndicadorForcaSenha(
        'swal-func-senha',
        'swal-func-senha-forca-barra',
        'swal-func-senha-forca-texto'
      )
    },
    preConfirm: async () => {
      const nome = document.getElementById('swal-func-nome').value.trim()
      if (!nome) {
        Swal.showValidationMessage('Informe o nome completo do funcionário.')
        return false
      }

      const cpf = document.getElementById('swal-func-cpf').value.trim()
      if (!cpf) {
        Swal.showValidationMessage('Informe o CPF do funcionário.')
        return false
      }
      if (!validarEstruturaCpf(cpf)) {
        Swal.showValidationMessage('Informe um CPF com 11 dígitos.')
        return false
      }

      const email = document.getElementById('swal-func-email').value.trim()
      if (!email) {
        Swal.showValidationMessage('Informe o e-mail do funcionário.')
        return false
      }

      const telefone = document.getElementById('swal-func-telefone').value.trim()
      if (!telefone) {
        Swal.showValidationMessage('Informe o telefone do funcionário.')
        return false
      }

      const cep = document.getElementById('swal-func-cep').value.trim()
      const rua = document.getElementById('swal-func-rua').value.trim()
      const numero = document.getElementById('swal-func-numero').value.trim()
      const bairro = document.getElementById('swal-func-bairro').value.trim()
      const cidade = document.getElementById('swal-func-cidade').value.trim()
      const estado = document.getElementById('swal-func-estado').value.trim()
      if (!cep || !rua || !numero || !bairro || !cidade || !estado) {
        Swal.showValidationMessage(
          'Preencha o endereço completo (CEP, rua, número, bairro, cidade e estado).'
        )
        return false
      }

      const dataNascimento = document.getElementById('swal-func-nascimento').value
      if (!dataNascimento) {
        Swal.showValidationMessage('Informe a data de nascimento.')
        return false
      }

      const role = document.getElementById('swal-func-role').value
      const senha = document.getElementById('swal-func-senha').value

      if (senha && !avaliarForcaSenha(senha).valida) {
        Swal.showValidationMessage(MENSAGEM_SENHA_FRACA)
        return false
      }

      if (cpf.replace(/\D/g, '') !== (usuario.cpf || '').replace(/\D/g, '')) {
        const cpfExistente = await ApiService.getUsuarioPorCpf(cpf)
        if (cpfExistente && String(cpfExistente.id) !== String(usuario.id)) {
          Swal.showValidationMessage('Já existe outro usuário com este CPF.')
          return false
        }
      }
      if (email.toLowerCase() !== usuario.email.toLowerCase()) {
        const existente = await ApiService.getUsuarioPorEmail(email)
        if (existente && String(existente.id) !== String(usuario.id)) {
          Swal.showValidationMessage('Já existe outro usuário com este e-mail.')
          return false
        }
      }

      const payload = {
        nome,
        cpf,
        email,
        telefone,
        endereco: montarEnderecoFinal('swal-func'),
        cep,
        dataNascimento,
        role
      }
      // Senha redefinida pelo admin: força a troca no próximo acesso, mesma
      // regra do cadastro inicial.
      if (senha) {
        payload.senha = senha
        payload.senhaTemporaria = true
        payload.senhaAlteradaEm = null
      }
      return payload
    }
  })

  if (!formValues) return

  try {
    await ApiService.updateUsuario(id, formValues)

    // Se o admin editou os próprios dados, atualiza também a sessão e o menu.
    const sessao = AuthService.getSessao()
    if (sessao && String(sessao.id) === String(id)) {
      AuthService.salvarSessao({ ...sessao, ...formValues })
      if (typeof inicializarMenuUsuario === 'function') inicializarMenuUsuario()
    }

    toastSucesso('Funcionário atualizado!')
    await carregarFuncionarios()
  } catch (error) {
    console.error('Erro ao atualizar funcionário:', error)
    Swal.fire({
      icon: 'error',
      title: 'Erro ao atualizar',
      text: 'Comportamento inesperado. Tente novamente.'
    })
  }
}

async function alternarAtivoFuncionario (id) {
  const usuario = funcionariosCache.find(u => String(u.id) === String(id))
  if (!usuario) return

  const sessao = AuthService.getSessao()
  if (sessao && String(sessao.id) === String(id)) {
    Swal.fire({
      icon: 'warning',
      title: 'Ação bloqueada',
      text: 'Você não pode inativar a própria conta.'
    })
    return
  }

  const ativoAtual = usuario.ativo === true
  const acao = ativoAtual ? 'inativar' : 'reativar'

  const result = await Swal.fire({
    title: ativoAtual ? 'Inativar funcionário?' : 'Reativar funcionário?',
    html: ativoAtual
      ? `O funcionário <strong>${ApiService.sanitizeText(
          usuario.nome
        )}</strong> perderá o acesso ao sistema até ser reativado.`
      : `O funcionário <strong>${ApiService.sanitizeText(
          usuario.nome
        )}</strong> voltará a ter acesso ao sistema.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: ativoAtual ? 'Sim, inativar' : 'Sim, reativar',
    cancelButtonText: 'Cancelar'
  })

  if (!result.isConfirmed) return

  try {
    await ApiService.updateUsuario(id, { ativo: !ativoAtual })
    toastSucesso(
      ativoAtual ? 'Funcionário inativado.' : 'Funcionário reativado.'
    )
    await carregarFuncionarios()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: `Erro ao ${acao}`,
      text: error.message || 'Comportamento inesperado. Tente novamente.'
    })
  }
}
