/**
 * Bloco de endereço com busca automática por CEP (ViaCEP), reutilizado em
 * qualquer formulário que precise capturar um endereço completo — cadastro/
 * edição de funcionário (Funcionários) e "Meu Perfil" (qualquer página, via
 * auth.js). Precisa carregar antes de auth.js e funcionarios.js.
 */

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

// Bloco HTML reutilizável de CEP/endereço (cadastro e edição de funcionário,
// e "Meu Perfil")
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
