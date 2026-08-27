/**
 * Módulo de Autenticação (AuthService) & Perfil do Usuário
 *
 * O backend (src/auth/) faz hash de senha com bcrypt, emite JWT, verifica a
 * assinatura do login com Google e gera/valida o código de recuperação de
 * senha (enviado por e-mail via src/email/email.service.ts) — nada disso
 * roda no navegador.
 *
 * Login com Google só funciona depois de configurar um Client ID real (ver
 * GOOGLE_CLIENT_ID logo abaixo e GOOGLE_CLIENT_ID em src/auth/auth.service.ts
 * — precisam ser o mesmo valor). Sem isso, o botão nem aparece — ver
 * inicializarBotaoGoogle.
 */

const AUTH_SESSION_KEY = 'parkgestao:session'

// Evita disparar o modal de sessão expirada mais de uma vez quando várias
// chamadas à API falham com 401 ao mesmo tempo (ex.: Promise.all do dashboard).
let tratandoSessaoExpirada = false
const AUTH_SESSAO_EXPIRADA_FLAG = 'parkgestao:sessaoExpirada'

// Prazo máximo (em dias) que uma senha pode ficar sem ser trocada antes de a
// troca se tornar obrigatória no próximo login — política de segurança.
const SENHA_VALIDADE_DIAS = 90

// Para ativar o login com Google: Google Cloud Console > APIs & Services >
// Credentials > Create Credentials > OAuth Client ID > "Web application" >
// adicione a URL onde o site roda em "Authorized JavaScript origins". Cole
// o Client ID gerado AQUI e também em GOOGLE_CLIENT_ID no .env do backend
// (precisa ser o mesmo valor nos dois lugares — Client ID não é segredo).
const GOOGLE_CLIENT_ID = '731583511960-t6igsbn6dhqiu5osf33rj9qvem2aj0sb.apps.googleusercontent.com'
const GOOGLE_LOGIN_CONFIGURADO = !GOOGLE_CLIENT_ID.startsWith('SEU_GOOGLE_CLIENT_ID')

/* ==========================================================================
   FORÇA DE SENHA (usado no Cadastro, "Meu Perfil", reset de senha e
   cadastro de funcionários pelo admin — qualquer lugar que define uma senha
   nova)
   ========================================================================== */

/**
 * Avalia uma senha contra os critérios exigidos (8+ caracteres, maiúscula,
 * minúscula, número e caractere especial) e retorna um resumo pronto para
 * alimentar a barra de progresso (fraca/média/forte).
 */
function avaliarForcaSenha (senha) {
  senha = senha || ''

  const criterios = {
    comprimento: senha.length >= 8,
    maiuscula: /[A-Z]/.test(senha),
    minuscula: /[a-z]/.test(senha),
    numero: /[0-9]/.test(senha),
    especial: /[^A-Za-z0-9]/.test(senha)
  }

  const pontos = Object.values(criterios).filter(Boolean).length
  const valida = Object.values(criterios).every(Boolean)

  let nivel = 'fraca'
  let percent = senha.length === 0 ? 0 : 20
  let classe = 'bg-danger'

  if (senha.length > 0) {
    if (pontos <= 2) {
      nivel = 'fraca'
      percent = 33
      classe = 'bg-danger'
    } else if (pontos <= 4) {
      nivel = 'média'
      percent = 66
      classe = 'bg-warning'
    } else {
      nivel = 'forte'
      percent = 100
      classe = 'bg-success'
    }
  }

  return { criterios, pontos, nivel, percent, classe, valida }
}

/**
 * Liga um input de senha a uma barra de progresso + texto de dica,
 * atualizando em tempo real a cada tecla digitada.
 */
function ligarIndicadorForcaSenha (idInput, idBarra, idTexto) {
  const input = document.getElementById(idInput)
  const barra = document.getElementById(idBarra)
  const texto = document.getElementById(idTexto)
  if (!input || !barra) return

  input.addEventListener('input', () => {
    const resultado = avaliarForcaSenha(input.value)

    barra.style.width = `${resultado.percent}%`
    barra.className = `progress-bar ${resultado.classe}`
    barra.setAttribute('aria-valuenow', String(resultado.percent))

    if (texto) {
      texto.textContent =
        input.value.length === 0
          ? 'Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial.'
          : `Força da senha: ${resultado.nivel}.`
    }
  })
}

/** Mensagem padrão quando a senha não atinge os critérios mínimos. */
const MENSAGEM_SENHA_FRACA =
  'A senha deve ter pelo menos 8 caracteres, com letra maiúscula, letra minúscula, número e caractere especial.'

window.avaliarForcaSenha = avaliarForcaSenha
window.ligarIndicadorForcaSenha = ligarIndicadorForcaSenha
window.MENSAGEM_SENHA_FRACA = MENSAGEM_SENHA_FRACA

/**
 * Gera uma senha temporária aleatória que já atende aos critérios mínimos
 * (maiúscula, minúscula, número e caractere especial) — usada pelo admin no
 * cadastro de funcionários, que devem trocá-la no primeiro acesso.
 */
function gerarSenhaTemporaria () {
  const maiusculas = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const minusculas = 'abcdefghijkmnpqrstuvwxyz'
  const numeros = '23456789'
  const especiais = '!@#$%&*'

  const sorteiaDe = conjunto =>
    conjunto[Math.floor(Math.random() * conjunto.length)]

  let senha =
    sorteiaDe(maiusculas) +
    sorteiaDe(minusculas) +
    sorteiaDe(numeros) +
    sorteiaDe(especiais)

  const todos = maiusculas + minusculas + numeros
  for (let i = 0; i < 6; i++) senha += sorteiaDe(todos)

  // Embaralha para a senha não seguir sempre o mesmo padrão previsível
  return senha
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}
window.gerarSenhaTemporaria = gerarSenhaTemporaria

/* ==========================================================================
   MÁSCARA DE TELEFONE (reaproveitada em Cadastro, Meu Perfil e Funcionários)
   ========================================================================== */
function ligarMascaraTelefone (idInput) {
  const input = document.getElementById(idInput)
  if (!input) return
  input.addEventListener('input', e => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 11)
    value = value.replace(/^(\d{2})(\d)/, '($1) $2')
    value = value.replace(/(\d)(\d{4})$/, '$1-$2')
    e.target.value = value
  })
}
window.ligarMascaraTelefone = ligarMascaraTelefone

/* ==========================================================================
   MÁSCARA E VALIDAÇÃO DE CPF (login por CPF)
   ========================================================================== */
function ligarMascaraCpf (idInput) {
  const input = document.getElementById(idInput)
  if (!input) return
  input.addEventListener('input', e => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 11)
    value = value.replace(/(\d{3})(\d)/, '$1.$2')
    value = value.replace(/(\d{3})(\d)/, '$1.$2')
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    e.target.value = value
  })
}
window.ligarMascaraCpf = ligarMascaraCpf

// Só a estrutura (11 dígitos), sem dígito verificador — mesmo padrão já
// usado no cadastro de mensalistas, ver assets/js/controllers/mensalistas.js.
function validarEstruturaCpf (cpf) {
  return (cpf || '').replace(/\D/g, '').length === 11
}
window.validarEstruturaCpf = validarEstruturaCpf

/* ==========================================================================
   GALERIA DE AVATARES (bichinhos) & AVATAR ENVIADO DO COMPUTADOR
   ========================================================================== */
const GALERIA_AVATARES = [
  { emoji: '🐱', cor: '#fca5a5' },
  { emoji: '🐶', cor: '#fdba74' },
  { emoji: '🦊', cor: '#fcd34d' },
  { emoji: '🐼', cor: '#a5b4fc' },
  { emoji: '🐨', cor: '#94a3b8' },
  { emoji: '🦉', cor: '#c4b5fd' },
  { emoji: '🐰', cor: '#f9a8d4' },
  { emoji: '🐻', cor: '#d6a77a' },
  { emoji: '🐧', cor: '#7dd3fc' },
  { emoji: '🦄', cor: '#f0abfc' },
  { emoji: '🐸', cor: '#86efac' },
  { emoji: '🐵', cor: '#fdba74' }
]

function gerarAvatarSvg (emoji, corFundo) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="32" fill="${corFundo}" />
    <text x="32" y="42" font-size="32" text-anchor="middle">${emoji}</text>
  </svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
window.GALERIA_AVATARES = GALERIA_AVATARES
window.gerarAvatarSvg = gerarAvatarSvg

/**
 * Lê um arquivo de imagem, recorta em quadrado e redimensiona para um
 * avatar pequeno (evita salvar imagens gigantes como base64 no db.json).
 */
function redimensionarImagemParaAvatar (arquivo) {
  return new Promise((resolve, reject) => {
    if (!arquivo.type.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem.'))
      return
    }

    const leitor = new FileReader()
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    leitor.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'))
      img.onload = () => {
        const tamanho = 160
        const canvas = document.createElement('canvas')
        canvas.width = tamanho
        canvas.height = tamanho
        const ctx = canvas.getContext('2d')
        const lado = Math.min(img.width, img.height)
        const sx = (img.width - lado) / 2
        const sy = (img.height - lado) / 2
        ctx.drawImage(img, sx, sy, lado, lado, 0, 0, tamanho, tamanho)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = leitor.result
    }
    leitor.readAsDataURL(arquivo)
  })
}
window.redimensionarImagemParaAvatar = redimensionarImagemParaAvatar

class AuthService {
  // --- SESSÃO ---
  static getSessao () {
    try {
      return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY))
    } catch (erro) {
      return null
    }
  }

  static estaLogado () {
    return Boolean(this.getSessao())
  }

  static ehAdmin () {
    return this.getSessao()?.role === 'admin'
  }

  static ehRhOuAdmin () {
    const role = this.getSessao()?.role
    return role === 'admin' || role === 'rh'
  }

  // Distinto de ehRhOuAdmin: gestor enxerga a lista de funcionários e o
  // desempenho por atendimentos, mas nunca dado de RH (salário, ponto,
  // férias, folha de pagamento de terceiros) — isso continua exclusivo de
  // ehRhOuAdmin().
  static podeGerenciarFuncionarios () {
    const role = this.getSessao()?.role
    return role === 'admin' || role === 'rh' || role === 'gestor'
  }

  // Financeiro só enxerga Métricas/Faturamento (dado operacional/financeiro
  // agregado) — nunca dado de RH de terceiros, isso continua exclusivo de
  // ehRhOuAdmin().
  static ehFinanceiroOuAdmin () {
    const role = this.getSessao()?.role
    return role === 'admin' || role === 'financeiro'
  }

  // Rótulo/classe de badge do papel — usado na navbar, no modal "Meu Perfil"
  // e na tela de Funcionários, pra não repetir o mapa em cada um.
  static rotuloPapel (role) {
    return { admin: 'Admin', rh: 'RH', gestor: 'Gestor', funcionario: 'Funcionário', financeiro: 'Financeiro' }[role] || 'Funcionário'
  }

  static classeBadgePapel (role) {
    return { admin: 'bg-primary', rh: 'bg-info', gestor: 'bg-warning text-dark', funcionario: 'bg-secondary', financeiro: 'bg-success' }[role] || 'bg-secondary'
  }

  static salvarSessao (usuario, token = null) {
    const sessaoAnterior = this.getSessao()
    const sessao = {
      id: usuario.id,
      nome: usuario.nome,
      cpf: usuario.cpf || '',
      email: usuario.email,
      telefone: usuario.telefone || '',
      endereco: usuario.endereco || '',
      dataNascimento: usuario.dataNascimento || null,
      avatar: usuario.avatar || '',
      role: usuario.role || 'funcionario',
      provedor: usuario.provedor || 'local',
      temSenha: usuario.temSenha === true,
      senhaTemporaria: usuario.senhaTemporaria === true,
      senhaAlteradaEm: usuario.senhaAlteradaEm || null,
      // O token só vem no login/registro/Google — em atualizações de perfil
      // (que reaproveitam a sessão atual) mantemos o token já guardado.
      token: token || sessaoAnterior?.token || null,
      loginEm: sessaoAnterior?.loginEm || new Date().toISOString()
    }
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessao))
    return sessao
  }

  static logout () {
    localStorage.removeItem(AUTH_SESSION_KEY)
  }

  /**
   * Chamado pelo ApiService quando o backend responde 401 numa requisição
   * autenticada (token expirado ou inválido). Encerra a sessão local e manda
   * o usuário de volta pro login, em vez de deixar a tela presa repetindo
   * chamadas que vão falhar para sempre.
   *
   * O aviso "sessão expirada" só é mostrado depois de chegar no login (via
   * flag no sessionStorage, mesmo padrão do "biscoito da sorte" em
   * frase-do-dia.js) — mostrar um Swal aqui e já navegar em seguida não dá
   * tempo do usuário ler, e ainda compete com o Swal de erro genérico que a
   * página atual pode disparar no mesmo instante (o catch de
   * loadDashboardData, por exemplo) — como só um modal fica aberto por vez,
   * um fecha o outro e nenhum aviso chega a ser lido.
   */
  static tratarSessaoExpirada () {
    if (tratandoSessaoExpirada || !this.estaLogado()) return
    tratandoSessaoExpirada = true

    this.logout()
    try {
      sessionStorage.setItem(AUTH_SESSAO_EXPIRADA_FLAG, '1')
    } catch (erro) {
      // sessionStorage indisponível: sem problema, só não mostra o aviso.
    }

    // index.html mora na raiz, as demais páginas ficam em /views/ — mesmo
    // cálculo de caminho usado em inicializarMenuUsuario, abaixo.
    const caminhoLogin = window.location.pathname.includes('/views/')
      ? 'login.html'
      : 'views/login.html'
    window.location.href = caminhoLogin
  }

  /**
   * Chamado pela tela de login — mostra o aviso de sessão expirada, se a
   * flag deixada por tratarSessaoExpirada estiver presente, e a apaga (só
   * aparece uma vez, na primeira tela que carregar depois do redirect).
   */
  static mostrarAvisoSessaoExpiradaSeAplicavel () {
    let sinalizado = false
    try {
      sinalizado = sessionStorage.getItem(AUTH_SESSAO_EXPIRADA_FLAG) === '1'
      sessionStorage.removeItem(AUTH_SESSAO_EXPIRADA_FLAG)
    } catch (erro) {
      return
    }
    if (!sinalizado || typeof Swal === 'undefined') return

    Swal.fire({
      icon: 'warning',
      title: 'Sessão expirada',
      text: 'Sua sessão expirou. Faça login novamente para continuar.',
      confirmButtonText: 'Entendi'
    })
  }

  /**
   * Contas criadas no primeiro login via Google (ver POST /auth/google)
   * nascem sem CPF — o CPF só existe hoje como identificador de login local
   * e não vem do perfil do Google. Enquanto não for preenchido (ver
   * views/completar-cadastro.html), a conta fica bloqueada nas rotas de
   * negócio pelo backend (requireProfileComplete).
   */
  static precisaCompletarCadastro (usuario) {
    return !usuario?.cpf
  }

  /**
   * Verifica se a troca de senha é obrigatória para o usuário: senha
   * temporária (definida pelo admin, nunca trocada) ou senha com mais de
   * SENHA_VALIDADE_DIAS dias sem ser alterada (política de segurança).
   * Contas do Google não têm senha local, então nunca são obrigadas.
   */
  static precisaTrocarSenha (usuario) {
    if (!usuario || usuario.provedor === 'google') {
      return { obrigatorio: false, motivo: null }
    }
    if (usuario.senhaTemporaria === true) {
      return { obrigatorio: true, motivo: 'temporaria' }
    }
    if (usuario.senhaAlteradaEm) {
      const dias =
        (Date.now() - new Date(usuario.senhaAlteradaEm).getTime()) /
        (1000 * 60 * 60 * 24)
      if (dias >= SENHA_VALIDADE_DIAS) {
        return { obrigatorio: true, motivo: 'expirada' }
      }
    }
    return { obrigatorio: false, motivo: null }
  }

  // --- LOGIN / CADASTRO (local) ---
  // Login é feito por CPF (identificador único por pessoa) em vez de
  // e-mail — o e-mail continua existindo só como via de recuperação de
  // senha. Contas criadas pelo Google (sem CPF/senha local) não passam por
  // aqui, usam loginComCredencialGoogle. A checagem de CPF/senha agora é
  // feita pelo backend (POST /auth/login, com hash bcrypt), não mais aqui.
  static async login (cpf, senha) {
    const { token, usuario } = await ApiService.login(cpf, senha)

    const sessao = this.salvarSessao(usuario, token)
    sessao.precisaTrocarSenha = this.precisaTrocarSenha(usuario)
    return sessao
  }

  /**
   * Cria a conta, mas NÃO salva sessão automaticamente — quem chama decide
   * se loga na hora ou manda o usuário para a tela de login (ver
   * login.js/tratarCadastro), então o retorno aqui é só o registro criado.
   * A checagem de CPF/e-mail duplicado agora é feita pelo backend
   * (POST /auth/registrar), que não exige sessão — diferente de
   * getUsuarioPorCpf/Email, que precisam de um token de admin.
   */
  static async registrar ({ nome, cpf, email, senha, telefone, aceitouTermos }) {
    if (!nome || !cpf || !email || !telefone || !senha) {
      throw new Error('Todos os campos são obrigatórios para o cadastro.')
    }
    if (!aceitouTermos) {
      throw new Error(
        'É necessário aceitar os Termos de Uso para se cadastrar.'
      )
    }
    if (!avaliarForcaSenha(senha).valida) {
      throw new Error(MENSAGEM_SENHA_FRACA)
    }

    return await ApiService.registrar({ nome, cpf, email, senha, telefone, aceitouTermos })
  }

  // --- LOGIN COM GOOGLE (Google Identity Services) ---
  // O token não é mais decodificado aqui no navegador — ele vai bruto pro
  // backend, que verifica a assinatura com a chave pública do Google antes
  // de confiar em qualquer dado (ver POST /auth/google). Decodificar no
  // cliente e confiar no resultado permitiria forjar nome/e-mail.
  static async loginComCredencialGoogle (credentialResponse) {
    if (!credentialResponse?.credential) {
      throw new Error('Não foi possível ler os dados da conta Google.')
    }

    const { token, usuario } = await ApiService.loginGoogle(credentialResponse.credential)

    return this.salvarSessao(usuario, token)
  }

  /**
   * Inicializa o botão "Entrar com Google" dentro do elemento informado.
   * Chame só depois que o script https://accounts.google.com/gsi/client
   * tiver carregado (ele é `defer`, então isso é seguro dentro de
   * DOMContentLoaded).
   */
  static inicializarBotaoGoogle (idContainer, aoLogar) {
    const container = document.getElementById(idContainer)

    if (!GOOGLE_LOGIN_CONFIGURADO) {
      console.warn(
        '[AuthService] Login com Google desativado: configure GOOGLE_CLIENT_ID (ver comentário acima da constante).'
      )
      if (container) {
        container.innerHTML =
          '<p class="text-muted small mb-0"><i class="fas fa-circle-info me-1" aria-hidden="true"></i>Login com Google indisponível nesta instalação (Client ID não configurado).</p>'
      }
      return
    }

    if (typeof google === 'undefined' || !google.accounts?.id) {
      console.warn('[AuthService] Google Identity Services não carregado.')
      return
    }

    try {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async credentialResponse => {
          try {
            const sessao = await this.loginComCredencialGoogle(
              credentialResponse
            )
            aoLogar?.(sessao)
          } catch (erro) {
            if (typeof Swal !== 'undefined') {
              Swal.fire({
                icon: 'error',
                title: 'Erro ao entrar com Google',
                text: erro.message
              })
            }
          }
        }
      })

      if (container) {
        google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
          locale: 'pt-BR'
        })
      }
    } catch (erro) {
      console.warn('[AuthService] Falha ao inicializar login do Google:', erro)
    }
  }

  // --- RECUPERAÇÃO DE SENHA ---
  // Geração e validação do código de verificação são feitas pelo backend
  // (POST /auth/reset/solicitar e /auth/reset/confirmar) — o código nunca
  // passa pelo navegador fora do e-mail que o usuário recebe.
  static async solicitarResetSenha (email) {
    await ApiService.solicitarResetSenha(email)
  }

  static async confirmarResetSenha (email, codigo, novaSenha) {
    if (!avaliarForcaSenha(novaSenha).valida) {
      throw new Error(MENSAGEM_SENHA_FRACA)
    }

    await ApiService.confirmarResetSenha(email, codigo, novaSenha)
  }

  // --- GUARDAS DE ROTA (usadas depois do guard inline no <head>, como
  //     segunda camada — ex.: se o papel do usuário mudou nesta sessão) ---
  static exigirLogin (caminhoLogin = 'login.html') {
    if (!this.estaLogado()) {
      window.location.replace(caminhoLogin)
      return false
    }
    return true
  }

  static exigirAdmin (caminhoSemAcesso = 'index.html', caminhoLogin = 'login.html') {
    if (!this.exigirLogin(caminhoLogin)) return false
    if (!this.ehAdmin()) {
      window.location.replace(caminhoSemAcesso)
      return false
    }
    return true
  }

  // --- HELPERS DE UI ---
  static iniciais (nome) {
    if (!nome) return '?'
    const partes = nome.trim().split(/\s+/)
    const primeira = partes[0]?.[0] || ''
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
    return (primeira + ultima).toUpperCase()
  }
}

window.AuthService = AuthService

/* ==========================================================================
   MENU DE USUÁRIO NA NAVBAR (avatar, nome, Meu Perfil, Sair)
   ========================================================================== */

function inicializarMenuUsuario () {
  const sessao = AuthService.getSessao()
  if (!sessao) return

  const avatarEl = document.getElementById('user-avatar')
  const nomeEl = document.getElementById('user-nome-navbar')
  const badgePapelEl = document.getElementById('user-role-badge')
  const linkFuncionarios = document.getElementById('link-funcionarios')
  const btnLogout = document.getElementById('btn-logout')
  const btnPerfil = document.getElementById('btn-abrir-perfil')

  if (avatarEl) {
    if (sessao.avatar) {
      // Atribuído via propriedade .src (não innerHTML com string
      // interpolada) para que o valor seja sempre tratado como URL da
      // imagem, nunca como HTML — evita XSS caso algum avatar antigo/externo
      // contenha algo como `x" onerror="...`. A validação de formato em si
      // (só data URI de imagem) é feita no backend, ver
      // src/usuarios/dto/atualizar-usuario.dto.ts.
      avatarEl.textContent = ''
      const img = document.createElement('img')
      img.src = sessao.avatar
      img.alt = ''
      img.className = 'user-avatar-img'
      avatarEl.appendChild(img)
    } else {
      avatarEl.textContent = AuthService.iniciais(sessao.nome)
    }
  }
  if (nomeEl) nomeEl.textContent = sessao.nome

  if (badgePapelEl) {
    badgePapelEl.textContent = AuthService.rotuloPapel(sessao.role)
    badgePapelEl.classList.remove('d-none', 'bg-primary', 'bg-secondary', 'bg-info', 'bg-warning', 'text-dark')
    badgePapelEl.classList.add('d-xl-inline-block', ...AuthService.classeBadgePapel(sessao.role).split(' '))
  }

  if (linkFuncionarios) {
    // RH e gestor também precisam da lista de funcionários (RH gerencia
    // dados de RH; gestor vê desempenho) — só quem não é admin/rh/gestor
    // fica de fora.
    linkFuncionarios.classList.toggle('d-none', !AuthService.podeGerenciarFuncionarios())
  }

  // Métricas (com dados financeiros/receita) só é visível para admin/financeiro.
  const navItemMetricas = document.getElementById('nav-item-metricas')
  if (navItemMetricas) {
    navItemMetricas.classList.toggle('d-none', !AuthService.ehFinanceiroOuAdmin())
  }

  // Faturamento (com dados financeiros de mensalidades) só é visível para admin/financeiro.
  const navItemFaturamento = document.getElementById('nav-item-faturamento')
  if (navItemFaturamento) {
    navItemFaturamento.classList.toggle('d-none', !AuthService.ehFinanceiroOuAdmin())
  }

  // KPI "Faturamento Total" do Dashboard expõe receita agregada — some para quem não é admin/financeiro.
  const kpiCardFaturamento = document.getElementById('kpi-card-faturamento')
  if (kpiCardFaturamento) {
    kpiCardFaturamento.classList.toggle('d-none', !AuthService.ehFinanceiroOuAdmin())
  }

  // index.html mora na raiz do projeto, as demais páginas ficam em /views/
  // — o caminho para o login muda dependendo de onde a página está.
  const caminhoLogin = window.location.pathname.includes('/views/')
    ? 'login.html'
    : 'views/login.html'

  btnLogout?.addEventListener('click', async () => {
    if (typeof Swal === 'undefined') {
      AuthService.logout()
      window.location.href = caminhoLogin
      return
    }

    const result = await Swal.fire({
      title: 'Sair do sistema?',
      text: 'Você precisará entrar novamente para continuar usando o ParkGestão.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, sair',
      cancelButtonText: 'Cancelar'
    })

    if (result.isConfirmed) {
      AuthService.logout()
      window.location.href = caminhoLogin
    }
  })

  btnPerfil?.addEventListener('click', () => abrirModalMeuPerfil())
}

/**
 * Modal "Meu Perfil": avatar (galeria ou upload), nome/CPF(bloqueado)/
 * e-mail/telefone/data de nascimento/endereço (com busca por CEP, igual ao
 * cadastro de Funcionário) e, opcionalmente, a senha do usuário logado.
 * Papel de acesso só aparece para quem já é admin — o backend só aceita
 * mudança de role/ativo vinda de um admin (ver
 * UsuariosService.atualizarPerfil), inclusive na própria conta. Contas via
 * Google nascem sem senha local, mas podem cadastrar uma por aqui (útil
 * para poder trocá-la depois, sem depender do Google) — ver temSenha.
 */
async function abrirModalMeuPerfil () {
  if (typeof Swal === 'undefined' || typeof ApiService === 'undefined') return

  const sessao = AuthService.getSessao()
  if (!sessao) return

  // Só pede a senha atual quando a conta já tem uma senha local cadastrada
  // (qualquer conta local, ou uma conta Google que já cadastrou senha
  // antes). Conta Google sem senha ainda só vê o campo de cadastrar.
  const temSenha = sessao.provedor !== 'google' || sessao.temSenha === true
  const ehAdmin = sessao.role === 'admin'
  let avatarSelecionado = sessao.avatar || ''

  const iniciaisAtuais = AuthService.iniciais(sessao.nome)
  const avatarPreviewHtml = avatarSelecionado
    ? `<img src="${avatarSelecionado}" alt="" class="perfil-avatar-preview-img">`
    : iniciaisAtuais

  const blocoAvatar = `
    <div class="text-center mb-4">
      <div id="perfil-avatar-preview" class="user-avatar-circle-lg mx-auto mb-2">${avatarPreviewHtml}</div>
      <span class="badge rounded-pill ${AuthService.classeBadgePapel(sessao.role)} mb-2">
        <i class="fas ${ehAdmin ? 'fa-user-shield' : 'fa-user'} me-1" aria-hidden="true"></i>${AuthService.rotuloPapel(sessao.role)}
      </span>
      <div class="d-flex justify-content-center gap-2 flex-wrap">
        <button type="button" class="btn btn-sm btn-outline-secondary" id="perfil-btn-galeria">
          <i class="fas fa-icons me-1" aria-hidden="true"></i>Escolher avatar
        </button>
        <label class="btn btn-sm btn-outline-secondary mb-0" for="perfil-avatar-arquivo">
          <i class="fas fa-upload me-1" aria-hidden="true"></i>Enviar foto
        </label>
        <input type="file" id="perfil-avatar-arquivo" accept="image/*" class="d-none">
        ${avatarSelecionado ? '<button type="button" class="btn btn-sm btn-outline-danger" id="perfil-btn-remover-avatar"><i class="fas fa-trash me-1" aria-hidden="true"></i>Remover</button>' : ''}
      </div>
      <div id="perfil-galeria-avatares" class="d-none mt-3 d-flex flex-wrap justify-content-center gap-2"></div>
    </div>
  `

  const blocoPapel = ehAdmin
    ? `
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Papel de acesso</label>
        <select id="perfil-role" class="form-select">
          <option value="funcionario" ${sessao.role === 'funcionario' ? 'selected' : ''}>Funcionário</option>
          <option value="gestor" ${sessao.role === 'gestor' ? 'selected' : ''}>Gestor</option>
          <option value="rh" ${sessao.role === 'rh' ? 'selected' : ''}>RH</option>
          <option value="financeiro" ${sessao.role === 'financeiro' ? 'selected' : ''}>Financeiro</option>
          <option value="admin" ${sessao.role === 'admin' ? 'selected' : ''}>Administrador</option>
        </select>
      </div>
    `
    : ''

  const blocoSenha = `
      ${temSenha
        ? `
      <div class="text-start mb-2">
        <label class="form-label fw-bold">Senha atual <span class="text-muted fw-normal">(só para trocar a senha)</span></label>
        <div class="input-group">
          <input id="perfil-senha-atual" type="password" class="form-control" autocomplete="current-password">
          <button type="button" class="btn btn-outline-secondary" id="perfil-toggle-senha-atual" tabindex="-1" aria-label="Mostrar/ocultar senha atual">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </div>
      `
        : `
      <p class="text-muted small mb-2"><i class="fas fa-circle-info me-1" aria-hidden="true"></i>Sua conta usa login do Google e ainda não tem senha própria. Cadastre uma abaixo para também poder entrar com CPF e senha, e trocá-la sempre que precisar.</p>
      `}
      <div class="text-start mb-3">
        <label class="form-label fw-bold">${temSenha ? 'Nova senha' : 'Cadastrar senha'} <span class="text-muted fw-normal">(opcional)</span></label>
        <div class="input-group">
          <input id="perfil-senha-nova" type="password" class="form-control" autocomplete="new-password" minlength="8">
          <button type="button" class="btn btn-outline-secondary" id="perfil-toggle-senha-nova" tabindex="-1" aria-label="Mostrar/ocultar nova senha">
            <i class="fas fa-eye"></i>
          </button>
        </div>
        <div class="progress mt-2" style="height: 6px;">
          <div id="perfil-senha-forca-barra" class="progress-bar" role="progressbar" style="width: 0%"></div>
        </div>
        <div id="perfil-senha-forca-texto" class="form-text">${temSenha ? 'Deixe em branco para manter a senha atual. Se preencher: mínimo' : 'Mínimo'} de 8 caracteres, com maiúscula, minúscula, número e caractere especial.</div>
      </div>
    `

  const { value: formValues } = await Swal.fire({
    title: 'Meu Perfil',
    width: '650px',
    html: `
      ${blocoAvatar}
      <div class="text-start mb-3">
        <label class="form-label fw-bold">Nome completo</label>
        <input id="perfil-nome" class="form-control" value="${ApiService.sanitizeText(sessao.nome)}">
      </div>
      <div class="row g-2 text-start mb-3">
        <div class="col-6">
          <label class="form-label fw-bold">CPF</label>
          <input class="form-control" value="${ApiService.sanitizeText(sessao.cpf || 'Não informado')}" disabled>
          <div class="form-text">Identificador de login — não muda por aqui.</div>
        </div>
        <div class="col-6">
          <label class="form-label fw-bold">E-mail</label>
          <input id="perfil-email" type="email" class="form-control" value="${ApiService.sanitizeText(sessao.email)}">
          <div class="form-text">Usado para recuperação de senha.</div>
        </div>
      </div>
      <div class="row g-2 text-start mb-3">
        <div class="col-6">
          <label class="form-label fw-bold">Telefone</label>
          <input id="perfil-telefone" class="form-control" value="${ApiService.sanitizeText(sessao.telefone || '')}"
            inputmode="tel" maxlength="15" placeholder="(11) 98765-4321">
        </div>
        <div class="col-6">
          <label class="form-label fw-bold">Data de nascimento</label>
          <input id="perfil-nascimento" type="date" class="form-control"
            max="${new Date().toISOString().slice(0, 10)}"
            value="${(sessao.dataNascimento || '').slice(0, 10)}">
        </div>
      </div>
      ${blocoEnderecoHtml('perfil', desmontarEndereco(sessao.endereco))}
      ${blocoPapel}
      ${blocoSenha}
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Salvar Alterações',
    cancelButtonText: 'Cancelar',
    didOpen: () => {
      ligarMascaraTelefone('perfil-telefone')
      ligarBuscaCep('perfil')

      const preview = document.getElementById('perfil-avatar-preview')
      const atualizarPreview = () => {
        if (!preview) return
        // Mesmo motivo do avatar da navbar (ver inicializarMenuUsuario,
        // acima): .src via propriedade, não interpolado em innerHTML.
        preview.textContent = ''
        if (avatarSelecionado) {
          const img = document.createElement('img')
          img.src = avatarSelecionado
          img.alt = ''
          img.className = 'perfil-avatar-preview-img'
          preview.appendChild(img)
        } else {
          preview.textContent = iniciaisAtuais
        }
      }

      // Galeria de avatares prontos (bichinhos)
      const galeria = document.getElementById('perfil-galeria-avatares')
      if (galeria) {
        galeria.innerHTML = GALERIA_AVATARES.map(av => {
          const src = gerarAvatarSvg(av.emoji, av.cor)
          return `<button type="button" class="avatar-galeria-item" data-avatar="${src}" aria-label="Usar avatar ${av.emoji}"><img src="${src}" alt=""></button>`
        }).join('')

        galeria.querySelectorAll('.avatar-galeria-item').forEach(btn => {
          btn.addEventListener('click', () => {
            avatarSelecionado = btn.getAttribute('data-avatar')
            atualizarPreview()
          })
        })
      }

      document.getElementById('perfil-btn-galeria')?.addEventListener('click', () => {
        galeria?.classList.toggle('d-none')
      })

      document.getElementById('perfil-btn-remover-avatar')?.addEventListener('click', () => {
        avatarSelecionado = ''
        atualizarPreview()
      })

      document
        .getElementById('perfil-avatar-arquivo')
        ?.addEventListener('change', async e => {
          const arquivo = e.target.files?.[0]
          if (!arquivo) return
          try {
            avatarSelecionado = await redimensionarImagemParaAvatar(arquivo)
            atualizarPreview()
          } catch (erro) {
            Swal.showValidationMessage(erro.message)
          }
        })

      ligarIndicadorForcaSenha(
        'perfil-senha-nova',
        'perfil-senha-forca-barra',
        'perfil-senha-forca-texto'
      )

      const ligarOlhoMagico = (idInput, idBotao) => {
        const input = document.getElementById(idInput)
        const botao = document.getElementById(idBotao)
        botao?.addEventListener('click', () => {
          const mostrar = input.type === 'password'
          input.type = mostrar ? 'text' : 'password'
          botao.innerHTML = mostrar
            ? '<i class="fas fa-eye-slash"></i>'
            : '<i class="fas fa-eye"></i>'
        })
      }
      ligarOlhoMagico('perfil-senha-atual', 'perfil-toggle-senha-atual')
      ligarOlhoMagico('perfil-senha-nova', 'perfil-toggle-senha-nova')
    },
    preConfirm: async () => {
      const nome = document.getElementById('perfil-nome').value.trim()
      const email = document.getElementById('perfil-email').value.trim()
      const telefone = document.getElementById('perfil-telefone').value.trim()
      const dataNascimento = document.getElementById('perfil-nascimento').value
      const endereco = montarEnderecoFinal('perfil')

      if (!nome || !email || !telefone) {
        Swal.showValidationMessage('Nome, e-mail e telefone são obrigatórios.')
        return false
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        Swal.showValidationMessage('Informe um e-mail válido.')
        return false
      }

      // Unicidade de e-mail e conferência da senha atual agora são
      // validadas pelo backend (PATCH /usuarios/:id) — getUsuarioPorEmail e
      // ApiService.getUsuarios() exigem sessão de admin, e quem está aqui
      // pode ser um funcionário comum editando o próprio perfil.
      const payload = { nome, email, telefone, dataNascimento, endereco, avatar: avatarSelecionado }

      // Só existe quando ehAdmin (ver blocoPapel) — o backend ignora role
      // vindo de quem não é admin de qualquer forma, mas nem renderizamos o
      // campo pra quem não pode usá-lo.
      const selectRole = document.getElementById('perfil-role')
      if (selectRole) payload.role = selectRole.value

      const senhaAtual = document.getElementById('perfil-senha-atual')?.value || ''
      const senhaNova = document.getElementById('perfil-senha-nova')?.value || ''

      if (senhaAtual || senhaNova) {
        // Só exige a senha atual quando a conta já tinha uma (temSenha) —
        // conta Google cadastrando a primeira senha não tem o que conferir.
        if (temSenha && (!senhaAtual || !senhaNova)) {
          Swal.showValidationMessage(
            'Preencha a senha atual e a nova senha para alterá-la.'
          )
          return false
        }
        if (!senhaNova) {
          Swal.showValidationMessage('Informe a nova senha.')
          return false
        }
        if (!avaliarForcaSenha(senhaNova).valida) {
          Swal.showValidationMessage(MENSAGEM_SENHA_FRACA)
          return false
        }

        payload.senha = senhaNova
        if (senhaAtual) payload.senhaAtual = senhaAtual
      }

      return payload
    }
  })

  if (!formValues) return

  try {
    const { senhaAtual, senha, ...dadosParaSessao } = formValues
    if (senha) dadosParaSessao.temSenha = true
    await ApiService.updateUsuario(sessao.id, formValues)
    AuthService.salvarSessao({ ...sessao, ...dadosParaSessao })
    inicializarMenuUsuario()

    if (typeof toastSucesso === 'function') {
      toastSucesso('Perfil atualizado!')
    }
  } catch (erro) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao atualizar perfil',
      text: erro.message || 'Comportamento inesperado. Tente novamente.'
    })
  }
}

window.abrirModalMeuPerfil = abrirModalMeuPerfil
window.inicializarMenuUsuario = inicializarMenuUsuario

/**
 * Modal bloqueante (sem botão de cancelar/fechar) de troca obrigatória de
 * senha, exibido logo após o login quando a senha é temporária (definida
 * pelo admin no cadastro) ou já passou de SENHA_VALIDADE_DIAS dias sem ser
 * trocada. Só é resolvida quando uma nova senha válida é salva.
 */
async function abrirModalTrocaSenhaObrigatoria (sessao, motivo) {
  if (typeof Swal === 'undefined' || typeof ApiService === 'undefined') return

  const mensagem =
    motivo === 'temporaria'
      ? 'Sua senha atual é temporária, definida por um administrador. Por segurança, defina agora uma senha permanente só sua.'
      : `Já se passaram ${SENHA_VALIDADE_DIAS} dias desde a última troca da sua senha. Por segurança, defina uma nova senha para continuar.`

  const { value: novaSenha } = await Swal.fire({
    title: 'Troca de senha obrigatória',
    html: `
      <p class="text-start text-muted mb-3">${mensagem}</p>
      <div class="text-start mb-2">
        <label class="form-label fw-bold">Nova senha</label>
        <input id="troca-senha-nova" type="password" class="form-control" minlength="8" autocomplete="new-password">
        <div class="progress mt-2" style="height: 6px;">
          <div id="troca-senha-forca-barra" class="progress-bar" role="progressbar" style="width: 0%"></div>
        </div>
        <div id="troca-senha-forca-texto" class="form-text">Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial.</div>
      </div>
      <div class="text-start">
        <label class="form-label fw-bold">Confirmar nova senha</label>
        <input id="troca-senha-confirmar" type="password" class="form-control" minlength="8" autocomplete="new-password">
      </div>
    `,
    icon: 'warning',
    focusConfirm: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showCancelButton: false,
    showCloseButton: false,
    confirmButtonText: 'Definir nova senha',
    didOpen: () => {
      ligarIndicadorForcaSenha(
        'troca-senha-nova',
        'troca-senha-forca-barra',
        'troca-senha-forca-texto'
      )
    },
    preConfirm: () => {
      const nova = document.getElementById('troca-senha-nova').value
      const confirmar = document.getElementById('troca-senha-confirmar').value

      if (!nova || !confirmar) {
        Swal.showValidationMessage('Preencha a nova senha nos dois campos.')
        return false
      }
      if (!avaliarForcaSenha(nova).valida) {
        Swal.showValidationMessage(MENSAGEM_SENHA_FRACA)
        return false
      }
      if (nova !== confirmar) {
        Swal.showValidationMessage('As senhas informadas não conferem.')
        return false
      }
      return nova
    }
  })

  const senhaAlteradaEm = new Date().toISOString()
  await ApiService.updateUsuario(sessao.id, {
    senha: novaSenha,
    senhaTemporaria: false,
    senhaAlteradaEm
  })

  AuthService.salvarSessao({
    ...sessao,
    senhaTemporaria: false,
    senhaAlteradaEm
  })

  await Swal.fire({
    icon: 'success',
    title: 'Senha atualizada!',
    text: 'Sua nova senha já está ativa.',
    confirmButtonText: 'Continuar'
  })
}
window.abrirModalTrocaSenhaObrigatoria = abrirModalTrocaSenhaObrigatoria
