/**
 * Lógica da Página de Login
 * Alterna entre Entrar/Cadastrar, olho mágico de senha, recuperação de
 * senha (simulada) e inicialização do botão "Entrar com Google".
 */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof AuthService !== 'undefined') {
    AuthService.mostrarAvisoSessaoExpiradaSeAplicavel()
  }

  ligarOlhoMagico('login-senha', 'btn-toggle-login-senha')
  ligarOlhoMagico('cadastro-senha', 'btn-toggle-cadastro-senha')
  ligarOlhoMagico('cadastro-confirmar-senha', 'btn-toggle-cadastro-confirmar-senha')

  ligarMascaraCpf('login-cpf')
  ligarMascaraCpf('cadastro-cpf')
  ligarMascaraTelefone('cadastro-telefone')
  ligarIndicadorForcaSenha(
    'cadastro-senha',
    'cadastro-senha-forca-barra',
    'cadastro-senha-forca-texto'
  )

  document.getElementById('form-login')?.addEventListener('submit', tratarLogin)
  document
    .getElementById('form-cadastro')
    ?.addEventListener('submit', tratarCadastro)
  document
    .getElementById('btn-esqueci-senha')
    ?.addEventListener('click', iniciarFluxoResetSenha)

  if (typeof AuthService !== 'undefined') {
    AuthService.inicializarBotaoGoogle('google-signin-button', sessao => {
      // Primeiro login via Google não vem com CPF (o Google não fornece
      // esse dado) — antes de liberar o Dashboard, manda para a tela de
      // conclusão de cadastro. Logins seguintes da mesma conta já têm CPF
      // salvo e pulam direto para o Dashboard.
      if (AuthService.precisaCompletarCadastro(sessao)) {
        window.location.href = 'completar-cadastro.html'
        return
      }
      marcarParaMostrarFraseNoProximoCarregamento()
      window.location.href = '../index.html'
    })
  }
})

// Alterna type="password"/"text" de um input e o ícone do botão associado
function ligarOlhoMagico (idInput, idBotao) {
  const input = document.getElementById(idInput)
  const botao = document.getElementById(idBotao)
  if (!input || !botao) return

  botao.addEventListener('click', () => {
    const mostrar = input.type === 'password'
    input.type = mostrar ? 'text' : 'password'
    botao.innerHTML = mostrar
      ? '<i class="fas fa-eye-slash"></i>'
      : '<i class="fas fa-eye"></i>'
    botao.setAttribute(
      'aria-label',
      mostrar ? 'Ocultar senha' : 'Mostrar senha'
    )
  })
}

async function tratarLogin (e) {
  e.preventDefault()

  const cpf = document.getElementById('login-cpf').value.trim()
  const senha = document.getElementById('login-senha').value
  const btn = document.getElementById('btn-submit-login')

  if (!validarEstruturaCpf(cpf)) {
    Swal.fire({
      icon: 'warning',
      title: 'CPF inválido',
      text: 'Informe um CPF com 11 dígitos.'
    })
    return
  }

  btn.disabled = true
  try {
    const sessao = await AuthService.login(cpf, senha)

    if (sessao.precisaTrocarSenha?.obrigatorio) {
      await abrirModalTrocaSenhaObrigatoria(
        sessao,
        sessao.precisaTrocarSenha.motivo
      )
    }

    marcarParaMostrarFraseNoProximoCarregamento()
    window.location.href = '../index.html'
  } catch (erro) {
    Swal.fire({
      icon: 'error',
      title: 'Não foi possível entrar',
      text: erro.message || 'Verifique seus dados e tente novamente.'
    })
  } finally {
    btn.disabled = false
  }
}

async function tratarCadastro (e) {
  e.preventDefault()

  const nome = document.getElementById('cadastro-nome').value.trim()
  const cpf = document.getElementById('cadastro-cpf').value.trim()
  const email = document.getElementById('cadastro-email').value.trim()
  const telefone = document.getElementById('cadastro-telefone').value.trim()
  const senha = document.getElementById('cadastro-senha').value
  const confirmarSenha = document.getElementById(
    'cadastro-confirmar-senha'
  ).value
  const aceitouTermos = document.getElementById('cadastro-termos').checked
  const btn = document.getElementById('btn-submit-cadastro')

  if (!nome || !cpf || !email || !telefone || !senha || !confirmarSenha) {
    Swal.fire({
      icon: 'warning',
      title: 'Campos obrigatórios',
      text: 'Preencha nome, CPF, e-mail, telefone e senha para se cadastrar.'
    })
    return
  }
  if (!validarEstruturaCpf(cpf)) {
    Swal.fire({
      icon: 'warning',
      title: 'CPF inválido',
      text: 'Informe um CPF com 11 dígitos.'
    })
    return
  }
  if (!avaliarForcaSenha(senha).valida) {
    Swal.fire({
      icon: 'warning',
      title: 'Senha fraca',
      text: MENSAGEM_SENHA_FRACA
    })
    return
  }
  if (senha !== confirmarSenha) {
    Swal.fire({
      icon: 'warning',
      title: 'Senhas não conferem',
      text: 'A confirmação de senha precisa ser igual à senha digitada.'
    })
    return
  }
  if (!aceitouTermos) {
    Swal.fire({
      icon: 'warning',
      title: 'Termos de Uso',
      text: 'É necessário aceitar os Termos de Uso e a Política de Privacidade para se cadastrar.'
    })
    return
  }

  btn.disabled = true
  try {
    const { token, usuario } = await AuthService.registrar({
      nome,
      cpf,
      email,
      senha,
      telefone,
      aceitouTermos
    })

    const result = await Swal.fire({
      icon: 'success',
      title: 'Cadastro realizado!',
      text: 'Sua conta foi criada com sucesso. Deseja entrar agora?',
      showCancelButton: true,
      confirmButtonText: 'Entrar agora',
      cancelButtonText: 'Voltar para o login'
    })

    if (result.isConfirmed) {
      AuthService.salvarSessao(usuario, token)
      marcarParaMostrarFraseNoProximoCarregamento()
      window.location.href = '../index.html'
    } else {
      document.getElementById('form-cadastro').reset()
      document
        .getElementById('cadastro-senha-forca-barra')
        ?.style.setProperty('width', '0%')
      bootstrap.Tab.getOrCreateInstance(
        document.getElementById('tab-entrar-btn')
      ).show()
    }
  } catch (erro) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao cadastrar',
      text: erro.message || 'Comportamento inesperado. Tente novamente.'
    })
  } finally {
    btn.disabled = false
  }
}

/**
 * Fluxo de recuperação de senha em 2 etapas via SweetAlert2: o código de
 * verificação é gerado pelo backend e enviado por e-mail de verdade (ver
 * src/email/email.service.ts) — aqui só coletamos o e-mail e, depois, o
 * código que o usuário recebeu.
 */
async function iniciarFluxoResetSenha () {
  const { value: email } = await Swal.fire({
    title: 'Recuperar senha',
    input: 'email',
    inputLabel: 'Informe o e-mail da sua conta',
    inputPlaceholder: 'voce@exemplo.com.br',
    showCancelButton: true,
    confirmButtonText: 'Enviar código',
    cancelButtonText: 'Cancelar',
    inputValidator: valor => {
      if (!valor) return 'Informe um e-mail.'
    }
  })

  if (!email) return

  try {
    await AuthService.solicitarResetSenha(email)
  } catch (erro) {
    Swal.fire({ icon: 'error', title: 'Não foi possível continuar', text: erro.message })
    return
  }

  await Swal.fire({
    icon: 'success',
    title: 'Código enviado!',
    html: `
      <p class="mb-1">Enviamos um código de verificação para <strong>${ApiService.sanitizeText(email)}</strong>.</p>
      <p class="text-muted text-xs mb-0">Confira sua caixa de entrada (e o spam). Válido por 15 minutos.</p>
    `,
    confirmButtonText: 'Já recebi o código'
  })

  const { value: formValues } = await Swal.fire({
    title: 'Nova senha',
    html: `
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Código de verificação</label>
        <input id="swal-reset-codigo" class="form-control" inputmode="numeric" maxlength="6">
      </div>
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Nova senha</label>
        <input id="swal-reset-senha" type="password" class="form-control" minlength="8">
        <div class="progress mt-2" style="height: 6px;">
          <div id="swal-reset-senha-forca-barra" class="progress-bar" role="progressbar" style="width: 0%"></div>
        </div>
        <div id="swal-reset-senha-forca-texto" class="form-text">Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial.</div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Redefinir senha',
    cancelButtonText: 'Cancelar',
    didOpen: () => {
      ligarIndicadorForcaSenha(
        'swal-reset-senha',
        'swal-reset-senha-forca-barra',
        'swal-reset-senha-forca-texto'
      )
    },
    preConfirm: () => {
      const codigoDigitado = document
        .getElementById('swal-reset-codigo')
        .value.trim()
      const novaSenha = document.getElementById('swal-reset-senha').value

      if (!codigoDigitado || !novaSenha) {
        Swal.showValidationMessage('Preencha o código e a nova senha.')
        return false
      }
      if (!avaliarForcaSenha(novaSenha).valida) {
        Swal.showValidationMessage(MENSAGEM_SENHA_FRACA)
        return false
      }

      return { codigoDigitado, novaSenha }
    }
  })

  if (!formValues) return

  try {
    await AuthService.confirmarResetSenha(
      email,
      formValues.codigoDigitado,
      formValues.novaSenha
    )
    toastSucesso('Senha redefinida! Você já pode entrar com a nova senha.')
  } catch (erro) {
    Swal.fire({ icon: 'error', title: 'Não foi possível redefinir', text: erro.message })
  }
}
