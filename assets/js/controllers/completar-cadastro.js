/**
 * Lógica da Página de Conclusão de Cadastro
 * Exibida só para contas criadas no primeiro login via Google (sem CPF).
 * Preenche o CPF, atualiza a sessão com o usuário/token novos devolvidos
 * pelo backend (ver PATCH /usuarios/:id em server/controllers/usuarios.js)
 * e libera o acesso ao restante do sistema.
 */

document.addEventListener('DOMContentLoaded', () => {
  ligarMascaraCpf('completar-cpf')

  document
    .getElementById('form-completar-cadastro')
    ?.addEventListener('submit', tratarCompletarCadastro)

  document
    .getElementById('btn-sair-completar-cadastro')
    ?.addEventListener('click', () => {
      AuthService.logout()
      window.location.href = 'login.html'
    })
})

async function tratarCompletarCadastro (e) {
  e.preventDefault()

  const cpf = document.getElementById('completar-cpf').value.trim()
  const btn = document.getElementById('btn-submit-completar-cadastro')

  if (!validarEstruturaCpf(cpf)) {
    Swal.fire({
      icon: 'warning',
      title: 'CPF inválido',
      text: 'Informe um CPF com 11 dígitos.'
    })
    return
  }

  const sessao = AuthService.getSessao()
  if (!sessao) {
    window.location.href = 'login.html'
    return
  }

  btn.disabled = true
  try {
    const usuarioAtualizado = await ApiService.updateUsuario(sessao.id, { cpf })

    // A resposta traz um token novo (sem o claim cpfPendente) — sem isso a
    // sessão continuaria bloqueada nas rotas de negócio até expirar.
    AuthService.salvarSessao(
      { ...sessao, ...usuarioAtualizado },
      usuarioAtualizado.token
    )

    await Swal.fire({
      icon: 'success',
      title: 'Cadastro concluído!',
      text: 'Seu CPF foi salvo. Você já pode usar o ParkGestão normalmente.',
      confirmButtonText: 'Continuar'
    })

    window.location.href = '../index.html'
  } catch (erro) {
    Swal.fire({
      icon: 'error',
      title: 'Não foi possível salvar',
      text: erro.message || 'Tente novamente em instantes.'
    })
  } finally {
    btn.disabled = false
  }
}
