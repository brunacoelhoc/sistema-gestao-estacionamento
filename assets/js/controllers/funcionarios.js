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

// ligarMascaraCep, buscarEnderecoPorCep, montarEnderecoFinal,
// blocoEnderecoHtml, ligarBuscaCep e desmontarEndereco agora moram em
// assets/js/modules/endereco.js — compartilhadas com o modal "Meu Perfil"
// (ver abrirModalMeuPerfil em auth.js).

document.addEventListener('DOMContentLoaded', async () => {
  aplicarRestricoesPorPapel()
  await Promise.all([carregarFuncionarios(), carregarDesempenho()])

  document
    .getElementById('btn-novo-funcionario')
    ?.addEventListener('click', abrirModalNovoFuncionario)

  document
    .getElementById('btn-gerenciar-trilha-carreira')
    ?.addEventListener('click', abrirModalTrilhaCarreira)

  document
    .getElementById('input-busca-funcionario')
    ?.addEventListener('input', aplicarFiltros)

  document
    .getElementById('filtro-status-funcionario')
    ?.addEventListener('change', aplicarFiltros)

  document.getElementById('btn-retry-page')?.addEventListener('click', () => {
    carregarFuncionarios()
  })

  document
    .getElementById('input-desempenho-referencia')
    ?.addEventListener('change', evento => carregarDesempenho(evento.target.value))
})

// Gestor só gerencia (lista + desempenho), nunca cria conta nem mexe em
// dado de RH/salário — isso continua exclusivo de admin/rh (já reforçado
// pelo backend; aqui é só pra não oferecer um botão que resultaria em 403).
function aplicarRestricoesPorPapel () {
  if (typeof AuthService === 'undefined' || AuthService.ehRhOuAdmin()) return
  document.getElementById('btn-novo-funcionario')?.classList.add('d-none')
  document.getElementById('btn-gerenciar-trilha-carreira')?.classList.add('d-none')
}

async function carregarDesempenho (referencia) {
  const tbody = document.getElementById('tbody-desempenho')
  if (!tbody) return
  tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Carregando...</td></tr>'

  try {
    const ranking = await ApiService.getDesempenho(referencia)
    if (!ranking || ranking.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Nenhum atendimento registrado ainda.</td></tr>'
      return
    }
    tbody.innerHTML = ranking.map((item, indice) => `
      <tr>
        <td>${indice + 1}º</td>
        <td>${ApiService.sanitizeText(item.nome)}</td>
        <td>${item.totalAtendimentos}</td>
      </tr>
    `).join('')
  } catch (error) {
    console.error('Erro ao carregar desempenho:', error)
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger py-3">Não foi possível carregar o desempenho.</td></tr>'
  }
}

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

  const papelBadge = `<span class="badge ${AuthService.classeBadgePapel(u.role)}">${AuthService.rotuloPapel(u.role)}</span>`

  const ehVoceMesmo = sessao && String(sessao.id) === String(u.id)

  const btnToggleLabel = ativo ? 'Inativar' : 'Reativar'
  const btnToggleIcon = ativo ? 'fa-user-slash' : 'fa-user-check'
  const btnToggleClasse = ativo ? 'btn-outline-danger' : 'btn-outline-success'

  const aniversarioFormatado = formatarDataBr(u.dataNascimento)

  // Gestor só lista (pra gerenciamento/desempenho) — nunca edita conta nem
  // vê/mexe em dado de RH, então as ações somem pra ele (o backend já
  // recusaria com 403; isto só evita oferecer um botão que não funciona).
  const podeEditarDados = AuthService.ehRhOuAdmin()
  const acoes = podeEditarDados
    ? `
        <button type="button" class="btn btn-sm btn-outline-primary me-1 btn-editar-funcionario"
          data-id="${u.id}" title="Editar Funcionário" aria-label="Editar ${ApiService.sanitizeText(u.nome)}">
          <i class="fas fa-edit" aria-hidden="true"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary me-1 btn-dados-rh-funcionario"
          data-id="${u.id}" title="Dados de RH" aria-label="Dados de RH de ${ApiService.sanitizeText(u.nome)}">
          <i class="fas fa-id-card" aria-hidden="true"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary me-1 btn-pdi-funcionario"
          data-id="${u.id}" title="PDI — Plano de Desenvolvimento Individual" aria-label="PDI de ${ApiService.sanitizeText(u.nome)}">
          <i class="fas fa-diagram-project" aria-hidden="true"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary me-1 btn-contrato-funcionario"
          data-id="${u.id}" title="Contrato de Trabalho" aria-label="Contrato de trabalho de ${ApiService.sanitizeText(u.nome)}">
          <i class="fas fa-file-signature" aria-hidden="true"></i>
        </button>
        <button type="button" class="btn btn-sm ${btnToggleClasse} btn-toggle-ativo-funcionario"
          data-id="${u.id}" title="${btnToggleLabel} Funcionário"
          aria-label="${btnToggleLabel} ${ApiService.sanitizeText(u.nome)}" ${ehVoceMesmo ? 'disabled' : ''}>
          <i class="fas ${btnToggleIcon} me-1" aria-hidden="true"></i>${btnToggleLabel}
        </button>
      `
    : '<span class="text-muted text-xs">Somente visualização</span>'

  tr.innerHTML = `
      <td class="fw-bold">${ApiService.sanitizeText(u.nome)}</td>
      <td>${ApiService.sanitizeText(u.cpf || '-')}</td>
      <td>${ApiService.sanitizeText(u.email)}</td>
      <td>${ApiService.sanitizeText(u.telefone || '-')}</td>
      <td>${aniversarioFormatado}</td>
      <td>${papelBadge}</td>
      <td>${statusBadge}</td>
      <td>${acoes}</td>
    `
  tbody.appendChild(tr)
}

function ligarBotoesLinhaFuncionario (tbody) {
  tbody.querySelectorAll('.btn-editar-funcionario').forEach(btn => {
    btn.addEventListener('click', () =>
      abrirModalEditarFuncionario(btn.getAttribute('data-id'))
    )
  })
  tbody.querySelectorAll('.btn-dados-rh-funcionario').forEach(btn => {
    btn.addEventListener('click', () =>
      abrirModalDadosRh(btn.getAttribute('data-id'))
    )
  })
  tbody.querySelectorAll('.btn-pdi-funcionario').forEach(btn => {
    btn.addEventListener('click', () =>
      abrirModalPdi(btn.getAttribute('data-id'))
    )
  })
  tbody.querySelectorAll('.btn-contrato-funcionario').forEach(btn => {
    btn.addEventListener('click', () =>
      abrirModalContratoTrabalho(btn.getAttribute('data-id'))
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
    width: '650px',
    html: `
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Nome completo <span class="text-danger">*</span></label>
        <input id="swal-func-nome" class="form-control">
      </div>
      <div class="row g-2 text-start mb-3">
        <div class="col-6">
          <label class="form-label fw-bold">CPF <span class="text-danger">*</span></label>
          <input id="swal-func-cpf" class="form-control" inputmode="numeric" maxlength="14"
            placeholder="000.000.000-00">
          <div class="form-text">Usado para entrar no sistema.</div>
        </div>
        <div class="col-6">
          <label class="form-label fw-bold">E-mail <span class="text-danger">*</span></label>
          <input id="swal-func-email" type="email" class="form-control">
          <div class="form-text">Usado para recuperação de senha.</div>
        </div>
      </div>
      <div class="row g-2 text-start mb-3">
        <div class="col-6">
          <label class="form-label fw-bold">Telefone <span class="text-danger">*</span></label>
          <input id="swal-func-telefone" class="form-control" inputmode="tel" maxlength="15"
            placeholder="(11) 98765-4321">
        </div>
        <div class="col-6">
          <label class="form-label fw-bold">Data de nascimento <span class="text-danger">*</span></label>
          <input id="swal-func-nascimento" type="date" class="form-control" max="${new Date().toISOString().slice(0, 10)}">
        </div>
      </div>
      ${blocoEnderecoHtml('swal-func')}
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Papel de acesso <span class="text-danger">*</span></label>
        <select id="swal-func-role" class="form-select">
          <option value="funcionario" selected>Funcionário</option>
          <option value="gestor">Gestor</option>
          <option value="rh">RH</option>
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
      text: error.message || 'Comportamento inesperado. Tente novamente.'
    })
  }
}

async function abrirModalEditarFuncionario (id) {
  const usuarioCache = funcionariosCache.find(u => String(u.id) === String(id))
  if (!usuarioCache) return

  // A listagem só traz o CPF mascarado — busca o registro completo pra
  // preencher o campo de edição com o valor real.
  const usuario = (await ApiService.getUsuarioPorId(id)) || usuarioCache

  const enderecoAtual = desmontarEndereco(usuario.endereco)
  enderecoAtual.cep = usuario.cep || ''

  const { value: formValues } = await Swal.fire({
    title: 'Editar Funcionário',
    width: '650px',
    html: `
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Nome completo <span class="text-danger">*</span></label>
        <input id="swal-func-nome" class="form-control" value="${ApiService.sanitizeText(usuario.nome)}">
      </div>
      <div class="row g-2 text-start mb-3">
        <div class="col-6">
          <label class="form-label fw-bold">CPF <span class="text-danger">*</span></label>
          <input id="swal-func-cpf" class="form-control" inputmode="numeric" maxlength="14"
            value="${ApiService.sanitizeText(usuario.cpf || '')}">
        </div>
        <div class="col-6">
          <label class="form-label fw-bold">E-mail <span class="text-danger">*</span></label>
          <input id="swal-func-email" type="email" class="form-control" value="${ApiService.sanitizeText(usuario.email)}">
        </div>
      </div>
      <div class="row g-2 text-start mb-3">
        <div class="col-6">
          <label class="form-label fw-bold">Telefone <span class="text-danger">*</span></label>
          <input id="swal-func-telefone" class="form-control" inputmode="tel" maxlength="15"
            value="${ApiService.sanitizeText(usuario.telefone || '')}">
        </div>
        <div class="col-6">
          <label class="form-label fw-bold">Data de nascimento <span class="text-danger">*</span></label>
          <input id="swal-func-nascimento" type="date" class="form-control"
            max="${new Date().toISOString().slice(0, 10)}" value="${(usuario.dataNascimento || '').slice(0, 10)}">
        </div>
      </div>
      ${blocoEnderecoHtml('swal-func', enderecoAtual)}
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Papel de acesso <span class="text-danger">*</span></label>
        <select id="swal-func-role" class="form-select">
          <option value="funcionario" ${usuario.role === 'funcionario' ? 'selected' : ''}>Funcionário</option>
          <option value="gestor" ${usuario.role === 'gestor' ? 'selected' : ''}>Gestor</option>
          <option value="rh" ${usuario.role === 'rh' ? 'selected' : ''}>RH</option>
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
        const cpfDuplicado = await ApiService.getUsuarioPorCpf(cpf, usuario.id)
        if (cpfDuplicado) {
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

const DIAS_SEMANA_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

// Percentuais de bônus por desempenho aceitos no modal "Dados de RH" — ver
// item 3 do pedido: select fechado (não texto livre) porque a política de
// bônus da empresa só tem essas três faixas.
const PERCENTUAIS_BONUS_DESEMPENHO = [5, 10, 15]

// Direitos/deveres/tarefas padrão por papel: funcionário, gestor e RH têm,
// cada um, o mesmo texto entre si (é política da empresa, não algo que varia
// pessoa a pessoa) — servem só de ponto de partida ao abrir o modal pela
// primeira vez para alguém; o RH pode editar livremente depois se um caso
// específico precisar fugir do padrão. "admin" cai no mesmo texto de
// funcionário — não foi pedido um quarto padrão e este papel raramente tem
// PerfilRH cadastrado.
const DEFAULTS_PERFIL_RH_POR_PAPEL = {
  funcionario: {
    direitos: [
      'Vale-Refeição (VR) de no mínimo R$ 45,00 por dia trabalhado.',
      'Vale-Alimentação (VA) de no mínimo R$ 1.000,00 fixo por mês.',
      'Plano de saúde subsidiado em 100% pela empresa, sem desconto em folha.',
      'Plano odontológico sem desconto em folha.',
      'TotalPass sem desconto em folha.',
      'Folga remunerada no dia do aniversário.',
      'Recesso remunerado de uma semana no final do ano, com escala revezada.',
      'Apoio à saúde mental com terapia e psicólogos, em parceria com a empresa.',
      '60 dias de férias por ano, com pelo menos 90 dias de antecedência para solicitar.',
      'Hora extra paga com 100% de adicional em dias fora da escala autorizados pelo RH.'
    ].join('\n'),
    deveres: [
      'Cumprir os dias e horários de escala definidos pelo RH.',
      'Registrar entrada e saída no ponto eletrônico todos os dias trabalhados.',
      'Solicitar autorização prévia do RH antes de trabalhar fora da escala.',
      'Zelar pelos equipamentos e sistemas do estacionamento.',
      'Seguir os protocolos de atendimento e segurança da ParkGestão.'
    ].join('\n'),
    tarefas: [
      'Emitir e conferir tickets de entrada e saída de veículos.',
      'Operar a cancela e orientar clientes nas vagas disponíveis.',
      'Conferir o fechamento de caixa ao final do turno.',
      'Reportar ocorrências e manutenções necessárias ao supervisor.'
    ].join('\n')
  },
  gestor: {
    direitos: [
      'Todos os benefícios da operação (VR, VA, plano de saúde e odontológico 100% subsidiados, TotalPass), sem desconto em folha.',
      'Folga remunerada no dia do aniversário.',
      'Recesso remunerado de uma semana no final do ano.',
      'Apoio à saúde mental com terapia e psicólogos, em parceria com a empresa.',
      '60 dias de férias por ano, com pelo menos 90 dias de antecedência para solicitar.',
      'Autonomia para aprovar justificativas de ponto e trabalho extra da equipe sob sua gestão.'
    ].join('\n'),
    deveres: [
      'Acompanhar a escala e o desempenho da equipe sob sua gestão.',
      'Aprovar ou recusar solicitações de trabalho extra e justificativas de ponto da equipe.',
      'Zelar pelo cumprimento dos protocolos de atendimento e segurança da ParkGestão.',
      'Escalar ao RH qualquer conflito ou ocorrência que fuja da rotina operacional.'
    ].join('\n'),
    tarefas: [
      'Definir e ajustar escalas da equipe em conjunto com o RH.',
      'Acompanhar indicadores de desempenho por atendimento da equipe.',
      'Aprovar solicitações de trabalho extra e justificativas de ponto.',
      'Servir de ponto de contato entre a equipe operacional e o RH/administração.'
    ].join('\n')
  },
  rh: {
    direitos: [
      'Todos os benefícios da operação (VR, VA, plano de saúde e odontológico 100% subsidiados, TotalPass), sem desconto em folha.',
      'Folga remunerada no dia do aniversário.',
      'Recesso remunerado de uma semana no final do ano.',
      'Apoio à saúde mental com terapia e psicólogos, em parceria com a empresa.',
      '60 dias de férias por ano, com pelo menos 90 dias de antecedência para solicitar.',
      'Acesso a dados de RH de todos os funcionários (salário, escala, dados bancários) para exercício da função.'
    ].join('\n'),
    deveres: [
      'Manter os dados de RH dos funcionários atualizados e corretos.',
      'Tratar dado sensível (salário, dados bancários, saúde) com sigilo.',
      'Gerar e revisar folhas de ponto e holerites dentro do prazo mensal.',
      'Zelar pelo cumprimento da LGPD no tratamento de dados pessoais.'
    ].join('\n'),
    tarefas: [
      'Cadastrar e manter atualizados os dados de RH dos funcionários.',
      'Aprovar ou recusar solicitações de férias e trabalho extra.',
      'Gerar folhas de ponto mensais e holerites para assinatura.',
      'Definir cargos, trilha de carreira e PDI dos funcionários.'
    ].join('\n')
  }
}

// Gera o texto de "Observações sobre benefícios" a partir do percentual de
// bônus escolhido — item 3 do pedido: evita digitação manual, sempre em
// sincronia com o percentual e o salário-base atuais.
function gerarObservacaoBonus (percentual, salarioBase) {
  if (!percentual) return ''
  const valor = (Number(salarioBase) || 0) * (percentual / 100)
  return `Bônus de ${percentual}% do salário-base (${formatarMoedaBrRh(valor)}), mediante atingimento de metas.`
}

function formatarMoedaBrRh (valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Cadastro/edição do PerfilRH (cargo, salário, escala, dados bancários
// simulados) de um funcionário — separado do modal "Editar Funcionário"
// porque é outro recurso no backend (GET/PATCH /rh-perfil/:usuarioId),
// alimentado só por RH/admin.
async function abrirModalDadosRh (id) {
  const usuarioCache = funcionariosCache.find(u => String(u.id) === String(id))
  if (!usuarioCache) return

  let perfil = null
  try {
    perfil = await ApiService.getPerfilRh(id)
  } catch (error) {
    console.error('Erro ao buscar perfil de RH:', error)
  }

  let etapasCarreira = []
  try {
    etapasCarreira = await ApiService.getEtapasCarreira()
  } catch (error) {
    console.error('Erro ao buscar trilha de carreira:', error)
  }

  let cargosRh = []
  try {
    cargosRh = await ApiService.getCargosRh()
  } catch (error) {
    console.error('Erro ao buscar catálogo de cargos:', error)
  }

  // Se o cargo já cadastrado não está (mais) no catálogo — ex.: perfil
  // antigo com um cargo digitado só naquela vez — inclui ele na lista pra
  // não "sumir" a seleção atual do select.
  const cargoAtual = perfil?.cargo || ''
  if (cargoAtual && !cargosRh.some(c => c.cargo === cargoAtual)) {
    cargosRh = [{ cargo: cargoAtual, vagaOrigem: perfil?.vagaOrigem || null }, ...cargosRh]
  }
  const NOVO_CARGO = '__novo__'
  const opcoesCargo = cargosRh.map(c => `
      <option value="${ApiService.sanitizeText(c.cargo)}" ${c.cargo === cargoAtual ? 'selected' : ''}>
        ${ApiService.sanitizeText(c.cargo)}
      </option>
    `).join('') +
    `<option value="${NOVO_CARGO}" ${cargoAtual ? '' : 'selected'}>+ Cadastrar novo cargo</option>`

  const defaultsPapel = DEFAULTS_PERFIL_RH_POR_PAPEL[usuarioCache.role] || DEFAULTS_PERFIL_RH_POR_PAPEL.funcionario

  // Faixa de bônus atual: casa o bonusDesempenho já gravado (valor em R$)
  // com o percentual mais próximo do salário-base — perfis antigos podem ter
  // um valor livre que não bate exatamente com 5/10/15%.
  const percentualBonusAtual = (() => {
    if (!perfil?.bonusDesempenho || !perfil?.salarioBase) return ''
    const percentualCalculado = (Number(perfil.bonusDesempenho) / Number(perfil.salarioBase)) * 100
    const maisProximo = PERCENTUAIS_BONUS_DESEMPENHO.reduce((atual, candidato) =>
      Math.abs(candidato - percentualCalculado) < Math.abs(atual - percentualCalculado) ? candidato : atual
    , PERCENTUAIS_BONUS_DESEMPENHO[0])
    return Math.abs(maisProximo - percentualCalculado) <= 1 ? maisProximo : ''
  })()

  const opcoesEtapaCarreira = ['<option value="">Sem etapa atribuída</option>']
    .concat((etapasCarreira || []).map(etapa => `
      <option value="${etapa.id}" ${perfil?.etapaCarreiraAtualId === etapa.id ? 'selected' : ''}>
        ${ApiService.sanitizeText(etapa.titulo)}
      </option>
    `))
    .join('')

  const diasSelecionados = new Set(perfil?.diasEscala ?? [1, 2, 3, 4])

  const opcoesGestor = ['<option value="">Sem gestor definido</option>']
    .concat(funcionariosCache
      .filter(u => String(u.id) !== String(id))
      .map(u => `
        <option value="${u.id}" ${perfil?.gestorId === u.id ? 'selected' : ''}>
          ${ApiService.sanitizeText(u.nome)}
        </option>
      `))
    .join('')

  const checkboxesDias = DIAS_SEMANA_LABELS.map((label, indice) => `
    <div class="form-check form-check-inline">
      <input class="form-check-input dados-rh-dia" type="checkbox" id="swal-rh-dia-${indice}"
        value="${indice}" ${diasSelecionados.has(indice) ? 'checked' : ''}>
      <label class="form-check-label" for="swal-rh-dia-${indice}">${label}</label>
    </div>
  `).join('')

  const { value: formValues } = await Swal.fire({
    title: `Dados de RH — ${ApiService.sanitizeText(usuarioCache.nome)}`,
    width: '650px',
    html: `
      <div class="row g-2 text-start mb-3">
        <div class="col-8">
          <label class="form-label fw-bold" for="swal-rh-cargo-select">Cargo <span class="text-danger">*</span></label>
          <select id="swal-rh-cargo-select" class="form-select">${opcoesCargo}</select>
          <input id="swal-rh-cargo-novo" class="form-control mt-2 d-none" placeholder="Nome do novo cargo">
        </div>
        <div class="col-4">
          <label class="form-label fw-bold">Salário-base (R$) <span class="text-danger">*</span></label>
          <input id="swal-rh-salario" type="number" min="0" step="0.01" class="form-control"
            value="${perfil?.salarioBase ?? ''}">
        </div>
      </div>
      <div class="row g-2 text-start mb-3">
        <div class="col-4">
          <label class="form-label fw-bold">Modalidade <span class="text-danger">*</span></label>
          <select id="swal-rh-tipo-contrato" class="form-select">
            <option value="clt" ${(perfil?.tipoContrato ?? 'clt') === 'clt' ? 'selected' : ''}>CLT</option>
            <option value="pj" ${perfil?.tipoContrato === 'pj' ? 'selected' : ''}>PJ</option>
          </select>
        </div>
        <div class="col-8">
          <label class="form-label fw-bold" for="swal-rh-vaga-origem">Vaga de origem</label>
          <input id="swal-rh-vaga-origem" class="form-control"
            placeholder="Ex.: Auxiliar de Estacionamento — Turno Noturno"
            value="${ApiService.sanitizeText(perfil?.vagaOrigem || '')}">
          <div class="form-text">Reaproveitada automaticamente quando o cargo escolhido já existe.</div>
        </div>
      </div>
      <div class="row g-2 text-start mb-3">
        <div class="col-6">
          <label class="form-label fw-bold">Data de admissão <span class="text-danger">*</span></label>
          <input id="swal-rh-admissao" type="date" class="form-control"
            value="${(perfil?.dataAdmissao || '').slice(0, 10)}">
        </div>
        <div class="col-6">
          <label class="form-label fw-bold">Horas por dia <span class="text-danger">*</span></label>
          <input id="swal-rh-horas" type="number" min="1" max="12" class="form-control"
            value="${perfil?.horasPorDia ?? 6}">
        </div>
      </div>
      <div class="row g-2 text-start mb-3">
        <div class="col-6">
          <label class="form-label fw-bold">Horário de entrada previsto <span class="text-danger">*</span></label>
          <input id="swal-rh-hora-inicio" type="time" class="form-control"
            value="${perfil?.horaInicioEscala || '08:00'}">
        </div>
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold d-block">Dias de escala <span class="text-danger">*</span></label>
        <div class="form-text mb-1">Selecione exatamente 4 dias fixos por semana.</div>
        ${checkboxesDias}
      </div>
      <div class="row g-2 text-start mb-1">
        <div class="col-4">
          <label class="form-label fw-bold">Banco <span class="text-danger">*</span></label>
          <input id="swal-rh-banco" class="form-control" value="${ApiService.sanitizeText(perfil?.bancoNome || '')}">
        </div>
        <div class="col-4">
          <label class="form-label fw-bold">Agência <span class="text-danger">*</span></label>
          <input id="swal-rh-agencia" class="form-control" value="${ApiService.sanitizeText(perfil?.agencia || '')}">
        </div>
        <div class="col-4">
          <label class="form-label fw-bold">Conta <span class="text-danger">*</span></label>
          <input id="swal-rh-conta" class="form-control" value="${ApiService.sanitizeText(perfil?.contaBancaria || '')}">
        </div>
      </div>
      <div class="form-text text-start mb-3">Dados bancários são simulados — usados só para o fluxo de folha de pagamento se comportar como real, sem integrar nenhum banco de fato.</div>

      <div class="row g-2 text-start mb-3">
        <div class="col-6">
          <label class="form-label fw-bold" for="swal-rh-vale">Vale-transporte / vale-combustível</label>
          <select id="swal-rh-vale" class="form-select">
            <option value="nenhum" ${(perfil?.tipoValeTransporte ?? 'nenhum') === 'nenhum' ? 'selected' : ''}>Nenhum</option>
            <option value="vale_transporte" ${perfil?.tipoValeTransporte === 'vale_transporte' ? 'selected' : ''}>Vale-transporte</option>
            <option value="vale_combustivel" ${perfil?.tipoValeTransporte === 'vale_combustivel' ? 'selected' : ''}>Vale-combustível</option>
          </select>
        </div>
        <div class="col-6">
          <label class="form-label fw-bold" for="swal-rh-bonus-percentual">Bônus por desempenho</label>
          <select id="swal-rh-bonus-percentual" class="form-select">
            <option value="" ${percentualBonusAtual === '' ? 'selected' : ''}>Nenhum</option>
            ${PERCENTUAIS_BONUS_DESEMPENHO.map(p => `
              <option value="${p}" ${percentualBonusAtual === p ? 'selected' : ''}>${p}% do salário-base, se atingir a meta</option>
            `).join('')}
          </select>
        </div>
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold" for="swal-rh-obs-beneficios">Observações sobre benefícios</label>
        <textarea id="swal-rh-obs-beneficios" class="form-control" rows="2" readonly
          placeholder="Preenchida automaticamente ao escolher um percentual de bônus.">${ApiService.sanitizeText(perfil?.observacoesBeneficios || gerarObservacaoBonus(percentualBonusAtual, perfil?.salarioBase))}</textarea>
      </div>

      <hr class="my-3">
      <div class="text-start mb-3">
        <label class="form-label fw-bold" for="swal-rh-gestor">Responde diretamente a</label>
        <select id="swal-rh-gestor" class="form-select">${opcoesGestor}</select>
        <div class="form-text">Define a hierarquia exibida ao funcionário na aba "Dados do RH".</div>
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold" for="swal-rh-etapa-carreira">Etapa atual na trilha de carreira</label>
        <select id="swal-rh-etapa-carreira" class="form-select">${opcoesEtapaCarreira}</select>
        <div class="form-text">Gerencie o catálogo de etapas pelo botão "Trilha de Carreira", no topo da página.</div>
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold" for="swal-rh-direitos">Direitos</label>
        <textarea id="swal-rh-direitos" class="form-control" rows="3" placeholder="Um item por linha">${ApiService.sanitizeText(perfil?.direitos || defaultsPapel.direitos)}</textarea>
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold" for="swal-rh-deveres">Deveres</label>
        <textarea id="swal-rh-deveres" class="form-control" rows="3" placeholder="Um item por linha">${ApiService.sanitizeText(perfil?.deveres || defaultsPapel.deveres)}</textarea>
      </div>
      <div class="text-start mb-1">
        <label class="form-label fw-bold" for="swal-rh-tarefas">Tarefas do cargo</label>
        <textarea id="swal-rh-tarefas" class="form-control" rows="3" placeholder="Um item por linha">${ApiService.sanitizeText(perfil?.tarefas || defaultsPapel.tarefas)}</textarea>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Salvar',
    cancelButtonText: 'Cancelar',
    didOpen: () => {
      const selectCargo = document.getElementById('swal-rh-cargo-select')
      const inputCargoNovo = document.getElementById('swal-rh-cargo-novo')
      const inputVagaOrigem = document.getElementById('swal-rh-vaga-origem')
      const selectBonus = document.getElementById('swal-rh-bonus-percentual')
      const inputSalario = document.getElementById('swal-rh-salario')
      const textareaObsBeneficios = document.getElementById('swal-rh-obs-beneficios')

      // Cargo: alterna entre o <select> de cargos já cadastrados e o campo
      // livre de "novo cargo" — e, ao escolher um cargo já existente, puxa
      // e trava (readonly) a vaga de origem dele (item 2 do pedido).
      const aplicarSelecaoCargo = () => {
        const ehNovo = selectCargo.value === NOVO_CARGO
        inputCargoNovo.classList.toggle('d-none', !ehNovo)
        if (ehNovo) {
          inputVagaOrigem.value = ''
          inputVagaOrigem.readOnly = false
          inputVagaOrigem.placeholder = 'Ex.: Auxiliar de Estacionamento — Turno Noturno'
        } else {
          const cargoSelecionado = cargosRh.find(c => c.cargo === selectCargo.value)
          inputVagaOrigem.value = cargoSelecionado?.vagaOrigem || ''
          inputVagaOrigem.readOnly = true
          inputVagaOrigem.placeholder = cargoSelecionado?.vagaOrigem
            ? ''
            : 'Nenhuma vaga de origem registrada ainda para este cargo.'
        }
      }
      selectCargo.addEventListener('change', aplicarSelecaoCargo)
      aplicarSelecaoCargo()

      // Bônus: recalcula o texto de observações sempre que o percentual ou
      // o salário-base mudam — nunca digitado manualmente (item 3).
      const atualizarObsBeneficios = () => {
        textareaObsBeneficios.value = gerarObservacaoBonus(selectBonus.value, inputSalario.value)
      }
      selectBonus.addEventListener('change', atualizarObsBeneficios)
      inputSalario.addEventListener('input', atualizarObsBeneficios)
    },
    preConfirm: () => {
      const selectCargo = document.getElementById('swal-rh-cargo-select')
      const cargo = selectCargo.value === NOVO_CARGO
        ? document.getElementById('swal-rh-cargo-novo').value.trim()
        : selectCargo.value
      if (!cargo) {
        Swal.showValidationMessage('Informe o cargo.')
        return false
      }

      const salarioBase = Number(document.getElementById('swal-rh-salario').value)
      if (!salarioBase || salarioBase < 0) {
        Swal.showValidationMessage('Informe um salário-base válido.')
        return false
      }

      const dataAdmissao = document.getElementById('swal-rh-admissao').value
      if (!dataAdmissao) {
        Swal.showValidationMessage('Informe a data de admissão.')
        return false
      }

      const horasPorDia = Number(document.getElementById('swal-rh-horas').value)
      if (!horasPorDia || horasPorDia < 1 || horasPorDia > 12) {
        Swal.showValidationMessage('Informe um valor de 1 a 12 horas por dia.')
        return false
      }

      const horaInicioEscala = document.getElementById('swal-rh-hora-inicio').value
      if (!horaInicioEscala) {
        Swal.showValidationMessage('Informe o horário de entrada previsto.')
        return false
      }

      const diasEscala = Array.from(document.querySelectorAll('.dados-rh-dia:checked'))
        .map(el => Number(el.value))
      if (diasEscala.length !== 4) {
        Swal.showValidationMessage('Selecione exatamente 4 dias de escala.')
        return false
      }

      const bancoNome = document.getElementById('swal-rh-banco').value.trim()
      const agencia = document.getElementById('swal-rh-agencia').value.trim()
      const contaBancaria = document.getElementById('swal-rh-conta').value.trim()
      if (!bancoNome || !agencia || !contaBancaria) {
        Swal.showValidationMessage('Preencha os dados bancários (banco, agência e conta).')
        return false
      }

      const tipoContrato = document.getElementById('swal-rh-tipo-contrato').value
      const vagaOrigem = document.getElementById('swal-rh-vaga-origem').value.trim()
      const gestorId = document.getElementById('swal-rh-gestor').value || null
      const etapaCarreiraAtualId = document.getElementById('swal-rh-etapa-carreira').value || null
      const direitos = document.getElementById('swal-rh-direitos').value.trim()
      const deveres = document.getElementById('swal-rh-deveres').value.trim()
      const tarefas = document.getElementById('swal-rh-tarefas').value.trim()
      const tipoValeTransporte = document.getElementById('swal-rh-vale').value
      const percentualBonus = document.getElementById('swal-rh-bonus-percentual').value
      const bonusDesempenho = percentualBonus === '' ? null : Math.round(salarioBase * (Number(percentualBonus) / 100) * 100) / 100
      const observacoesBeneficios = document.getElementById('swal-rh-obs-beneficios').value.trim()

      return {
        cargo,
        salarioBase,
        tipoContrato,
        vagaOrigem,
        dataAdmissao,
        horasPorDia,
        horaInicioEscala,
        diasEscala,
        bancoNome,
        agencia,
        contaBancaria,
        gestorId,
        etapaCarreiraAtualId,
        direitos,
        deveres,
        tarefas,
        tipoValeTransporte,
        bonusDesempenho,
        observacoesBeneficios
      }
    }
  })

  if (!formValues) return

  try {
    await ApiService.definirPerfilRh(id, formValues)
    toastSucesso('Dados de RH salvos!')
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao salvar dados de RH',
      text: error.message || 'Comportamento inesperado. Tente novamente.'
    })
  }
}

// --- TRILHA DE CARREIRA (catálogo global) ---

async function abrirModalTrilhaCarreira () {
  let etapas = []
  try {
    etapas = await ApiService.getEtapasCarreira()
  } catch (error) {
    console.error('Erro ao buscar trilha de carreira:', error)
  }

  const linhasHtml = etapas.length === 0
    ? '<p class="text-muted text-center py-2">Nenhuma etapa cadastrada ainda.</p>'
    : etapas.map(etapa => `
        <div class="d-flex align-items-start gap-2 p-2 border rounded mb-2 text-start">
          <span class="badge bg-secondary mt-1">${etapa.ordem}º</span>
          <div class="flex-grow-1">
            <strong>${ApiService.sanitizeText(etapa.titulo)}</strong>
            ${etapa.faixaSalarial ? ` <span class="badge bg-light text-dark border">${ApiService.sanitizeText(etapa.faixaSalarial)}</span>` : ''}
            <p class="text-muted text-xs mb-0">${ApiService.sanitizeText(etapa.descricao)}</p>
          </div>
          <button type="button" class="btn btn-sm btn-outline-primary btn-trilha-editar" data-id="${etapa.id}" title="Editar">
            <i class="fas fa-edit" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger btn-trilha-remover" data-id="${etapa.id}" title="Remover">
            <i class="fas fa-trash" aria-hidden="true"></i>
          </button>
        </div>
      `).join('')

  await Swal.fire({
    title: 'Trilha de Carreira',
    width: '650px',
    html: `
      <p class="text-muted text-xs text-start">Catálogo global de etapas, usado na aba "Dados do RH" de cada funcionário para mostrar onde ele está hoje e até onde pode chegar.</p>
      <div id="trilha-lista" style="max-height: 340px; overflow-y: auto;">${linhasHtml}</div>
      <button type="button" class="btn btn-sm btn-outline-primary mt-2" id="btn-trilha-nova-etapa">
        <i class="fas fa-plus me-1" aria-hidden="true"></i>Nova Etapa
      </button>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    didOpen: () => {
      document.getElementById('btn-trilha-nova-etapa')?.addEventListener('click', async () => {
        await abrirModalEditarEtapaCarreira(null)
        await abrirModalTrilhaCarreira()
      })
      document.querySelectorAll('.btn-trilha-editar').forEach(btn => {
        btn.addEventListener('click', async () => {
          const etapa = etapas.find(e => e.id === btn.getAttribute('data-id'))
          await abrirModalEditarEtapaCarreira(etapa)
          await abrirModalTrilhaCarreira()
        })
      })
      document.querySelectorAll('.btn-trilha-remover').forEach(btn => {
        btn.addEventListener('click', async () => {
          await removerEtapaCarreiraConfirmando(btn.getAttribute('data-id'))
          await abrirModalTrilhaCarreira()
        })
      })
    }
  })
}

async function abrirModalEditarEtapaCarreira (etapa) {
  const { value: formValues } = await Swal.fire({
    title: etapa ? 'Editar Etapa de Carreira' : 'Nova Etapa de Carreira',
    width: '550px',
    html: `
      <div class="row g-2 text-start mb-3">
        <div class="col-4">
          <label class="form-label fw-bold">Ordem <span class="text-danger">*</span></label>
          <input id="swal-etapa-ordem" type="number" min="1" class="form-control" value="${etapa?.ordem ?? ''}">
        </div>
        <div class="col-8">
          <label class="form-label fw-bold">Título <span class="text-danger">*</span></label>
          <input id="swal-etapa-titulo" class="form-control" value="${ApiService.sanitizeText(etapa?.titulo || '')}">
        </div>
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Faixa salarial de referência</label>
        <input id="swal-etapa-faixa" class="form-control" placeholder="Ex.: R$ 2.500 - R$ 3.000"
          value="${ApiService.sanitizeText(etapa?.faixaSalarial || '')}">
      </div>
      <div class="text-start mb-1">
        <label class="form-label fw-bold">Descrição <span class="text-danger">*</span></label>
        <textarea id="swal-etapa-descricao" class="form-control" rows="3">${ApiService.sanitizeText(etapa?.descricao || '')}</textarea>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Salvar',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const ordem = Number(document.getElementById('swal-etapa-ordem').value)
      if (!ordem || ordem < 1) {
        Swal.showValidationMessage('Informe uma ordem válida.')
        return false
      }
      const titulo = document.getElementById('swal-etapa-titulo').value.trim()
      if (!titulo) {
        Swal.showValidationMessage('Informe o título.')
        return false
      }
      const descricao = document.getElementById('swal-etapa-descricao').value.trim()
      if (!descricao) {
        Swal.showValidationMessage('Informe a descrição.')
        return false
      }
      const faixaSalarial = document.getElementById('swal-etapa-faixa').value.trim()
      return { ordem, titulo, faixaSalarial, descricao }
    }
  })

  if (!formValues) return

  try {
    if (etapa) {
      await ApiService.atualizarEtapaCarreira(etapa.id, formValues)
    } else {
      await ApiService.criarEtapaCarreira(formValues)
    }
    toastSucesso(etapa ? 'Etapa atualizada!' : 'Etapa criada!')
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao salvar etapa',
      text: error.message || 'Comportamento inesperado. Tente novamente.'
    })
  }
}

async function removerEtapaCarreiraConfirmando (id) {
  const result = await Swal.fire({
    title: 'Remover etapa de carreira?',
    text: 'Esta ação não pode ser desfeita.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Remover',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc3545'
  })
  if (!result.isConfirmed) return

  try {
    await ApiService.removerEtapaCarreira(id)
    toastSucesso('Etapa removida!')
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao remover etapa',
      text: error.message || 'Comportamento inesperado. Tente novamente.'
    })
  }
}

// --- PDI (Plano de Desenvolvimento Individual) de um funcionário ---

async function abrirModalPdi (id) {
  const usuarioCache = funcionariosCache.find(u => String(u.id) === String(id))
  if (!usuarioCache) return

  let itens = []
  try {
    itens = await ApiService.getPdi(id)
  } catch (error) {
    console.error('Erro ao buscar PDI:', error)
  }

  const concluidos = itens.filter(i => i.status === 'concluido').length
  const percentual = itens.length ? Math.round((concluidos / itens.length) * 100) : 0

  const linhasHtml = itens.length === 0
    ? '<p class="text-muted text-center py-2">Nenhum item de PDI cadastrado ainda.</p>'
    : itens.map((item, indice) => {
      const concluido = item.status === 'concluido'
      return `
        <div class="d-flex align-items-start gap-2 p-2 border rounded mb-2 text-start ${concluido ? 'bg-success bg-opacity-10' : ''}">
          <div class="flex-grow-1">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <strong>${ApiService.sanitizeText(item.titulo)}</strong>
              <span class="badge ${concluido ? 'bg-success' : 'bg-secondary'}">${concluido ? 'Concluído' : 'Pendente'}</span>
            </div>
            ${item.descricao ? `<p class="text-muted text-xs mb-0 mt-1">${ApiService.sanitizeText(item.descricao)}</p>` : ''}
          </div>
          <div class="d-flex flex-column gap-1">
            <button type="button" class="btn btn-sm btn-outline-secondary btn-pdi-mover" data-id="${item.id}"
              data-direcao="cima" title="Mover para cima" ${indice === 0 ? 'disabled' : ''}>
              <i class="fas fa-arrow-up" aria-hidden="true"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary btn-pdi-mover" data-id="${item.id}"
              data-direcao="baixo" title="Mover para baixo" ${indice === itens.length - 1 ? 'disabled' : ''}>
              <i class="fas fa-arrow-down" aria-hidden="true"></i>
            </button>
          </div>
          <div class="d-flex flex-column gap-1">
            <button type="button" class="btn btn-sm ${concluido ? 'btn-outline-warning' : 'btn-outline-success'} btn-pdi-toggle"
              data-id="${item.id}" data-concluido="${concluido}" title="${concluido ? 'Reabrir' : 'Concluir'}">
              <i class="fas ${concluido ? 'fa-rotate-left' : 'fa-check'}" aria-hidden="true"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger btn-pdi-remover" data-id="${item.id}" title="Remover">
              <i class="fas fa-trash" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      `
    }).join('')

  await Swal.fire({
    title: `PDI — ${ApiService.sanitizeText(usuarioCache.nome)}`,
    width: '650px',
    html: `
      <p class="text-muted text-xs text-start">${concluidos} de ${itens.length} etapas concluídas (${percentual}%). Marcar como concluído deve refletir só o que já foi de fato cumprido pelo funcionário.</p>
      <div class="progress mb-3" style="height: 8px;">
        <div class="progress-bar bg-success" style="width: ${percentual}%"></div>
      </div>
      <div id="pdi-lista" style="max-height: 300px; overflow-y: auto;">${linhasHtml}</div>
      <hr>
      <div class="text-start">
        <label class="form-label fw-bold">Novo item</label>
        <input id="swal-pdi-titulo" class="form-control mb-2" placeholder="Título">
        <textarea id="swal-pdi-descricao" class="form-control mb-2" rows="2" placeholder="Descrição (opcional)"></textarea>
        <button type="button" class="btn btn-sm btn-primary" id="btn-pdi-adicionar">
          <i class="fas fa-plus me-1" aria-hidden="true"></i>Adicionar item
        </button>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    didOpen: () => {
      document.getElementById('btn-pdi-adicionar')?.addEventListener('click', async () => {
        const titulo = document.getElementById('swal-pdi-titulo').value.trim()
        if (!titulo) {
          Swal.showValidationMessage('Informe o título do item.')
          return
        }
        const descricao = document.getElementById('swal-pdi-descricao').value.trim()
        try {
          await ApiService.criarItemPdi(id, { titulo, descricao })
          await abrirModalPdi(id)
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'Erro ao adicionar item',
            text: error.message || 'Comportamento inesperado. Tente novamente.'
          })
        }
      })

      document.querySelectorAll('.btn-pdi-mover').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await ApiService.moverItemPdi(btn.getAttribute('data-id'), btn.getAttribute('data-direcao'))
            await abrirModalPdi(id)
          } catch (error) {
            Swal.fire({
              icon: 'error',
              title: 'Erro ao mover item',
              text: error.message || 'Comportamento inesperado. Tente novamente.'
            })
          }
        })
      })

      document.querySelectorAll('.btn-pdi-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
          const concluidoAtual = btn.getAttribute('data-concluido') === 'true'
          try {
            if (concluidoAtual) {
              await ApiService.reabrirItemPdi(btn.getAttribute('data-id'))
            } else {
              await ApiService.concluirItemPdi(btn.getAttribute('data-id'))
            }
            await abrirModalPdi(id)
          } catch (error) {
            Swal.fire({
              icon: 'error',
              title: 'Erro ao atualizar item',
              text: error.message || 'Comportamento inesperado. Tente novamente.'
            })
          }
        })
      })

      document.querySelectorAll('.btn-pdi-remover').forEach(btn => {
        btn.addEventListener('click', async () => {
          const result = await Swal.fire({
            title: 'Remover item do PDI?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Remover',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc3545'
          })
          if (!result.isConfirmed) return

          try {
            await ApiService.removerItemPdi(btn.getAttribute('data-id'))
            await abrirModalPdi(id)
          } catch (error) {
            Swal.fire({
              icon: 'error',
              title: 'Erro ao remover item',
              text: error.message || 'Comportamento inesperado. Tente novamente.'
            })
          }
        })
      })
    }
  })
}

// --- CONTRATO DE TRABALHO (versionado, assinado) de um funcionário ---
// Só RH/admin gera uma nova versão (o backend também reforça isso); só o
// próprio funcionário assina, por isso este modal não tem botão de assinar —
// ele só gera e, depois de assinado pelo funcionário, baixa o PDF.
async function abrirModalContratoTrabalho (id) {
  const usuarioCache = funcionariosCache.find(u => String(u.id) === String(id))
  if (!usuarioCache) return

  let contratos = []
  try {
    contratos = await ApiService.getContratosTrabalho(id)
  } catch (error) {
    console.error('Erro ao buscar contratos de trabalho:', error)
  }

  const linhasHtml = contratos.length === 0
    ? '<p class="text-muted text-center py-2">Nenhuma versão gerada ainda.</p>'
    : contratos.map(c => `
      <div class="d-flex align-items-center justify-content-between p-2 border rounded mb-2 text-start">
        <div>
          <strong>Versão ${c.numeroVersao}</strong>
          <span class="badge ${c.status === 'assinado' ? 'bg-success' : 'bg-warning text-dark'} ms-2">${c.status === 'assinado' ? 'Assinado' : 'Aguardando assinatura'}</span>
          <div class="text-muted text-xs">Gerado em ${formatarDataBr(c.geradoEm)}</div>
        </div>
        ${c.status === 'assinado'
          ? `<button type="button" class="btn btn-sm btn-outline-primary btn-contrato-baixar" data-id="${c.id}"><i class="fas fa-download" aria-hidden="true"></i></button>`
          : '<span class="text-muted text-xs">Aguardando o funcionário assinar</span>'}
      </div>
    `).join('')

  await Swal.fire({
    title: `Contrato de Trabalho — ${ApiService.sanitizeText(usuarioCache.nome)}`,
    width: '600px',
    html: `
      <div id="contrato-lista" class="mb-3" style="max-height: 320px; overflow-y: auto;">${linhasHtml}</div>
      <button type="button" class="btn btn-primary" id="btn-gerar-nova-versao-contrato">
        <i class="fas fa-plus me-1" aria-hidden="true"></i>Gerar nova versão de contrato
      </button>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    didOpen: () => {
      document.getElementById('btn-gerar-nova-versao-contrato')?.addEventListener('click', async () => {
        try {
          await ApiService.gerarContratoTrabalho(id)
          toastSucesso('Nova versão do contrato gerada e enviada para a caixa de notificações do funcionário!')
          await abrirModalContratoTrabalho(id)
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'Não foi possível gerar a nova versão',
            text: error.message || 'Comportamento inesperado. Tente novamente.'
          })
        }
      })

      document.querySelectorAll('.btn-contrato-baixar').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const blob = await ApiService.baixarPdfContratoTrabalho(btn.getAttribute('data-id'))
            baixarArquivoExportado(blob, 'contrato-de-trabalho.pdf', 'application/pdf')
          } catch (error) {
            Swal.fire({
              icon: 'error',
              title: 'Não foi possível baixar o PDF',
              text: error.message || 'Comportamento inesperado. Tente novamente.'
            })
          }
        })
      })
    }
  })
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
