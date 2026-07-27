/**
 * Main JS - Inicialização e Utilidades Globais do ParkGestão
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializa Tooltips do Bootstrap em botões/elementos com data-bs-toggle="tooltip"
  //    (nenhuma página usa isso ainda — fica pronto para quando alguém precisar).
  const tooltipTriggerList = Array.from(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  )
  tooltipTriggerList.forEach(tooltipTriggerEl => {
    new bootstrap.Tooltip(tooltipTriggerEl)
  })

  // 2. Destaca automaticamente o link da página atual na Navbar
  marcarLinkNavegacaoAtivo()

  // 3. Atalho de teclado de acessibilidade: Alt + A foca no Skip Link.
  //    ATENÇÃO: Alt+letra é o atalho de acesso ao menu clássico do Firefox/IE
  //    no Windows (abre Arquivo/Editar/Exibir) em alguns modos de teclado.
  //    Testar nos navegadores-alvo; se houver conflito, trocar a combinação
  //    (ex.: Alt+Shift+A) é mais seguro.
  document.addEventListener('keydown', e => {
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault()
      const skipLink = document.querySelector('.skip-link')
      if (skipLink) {
        skipLink.focus()
      }
    }
  })
})

/**
 * Destaca a opção ativa na barra de navegação comparando a URL resolvida de
 * cada link com a URL atual da página — em vez de comparação de texto
 * (endsWith), que falha em casos de borda como "/" vs "/index.html" ou
 * links relativos vindos de subpastas (paginas/).
 */
function marcarLinkNavegacaoAtivo () {
  const pathAtual = normalizarPath(window.location.pathname)
  const navLinks = document.querySelectorAll('.navbar-nav .nav-link')

  navLinks.forEach(link => {
    const href = link.getAttribute('href')
    if (!href || href.startsWith('#')) return

    const pathDoLink = normalizarPath(
      new URL(href, window.location.href).pathname
    )
    const ehAtivo = pathDoLink === pathAtual

    link.classList.toggle('active', ehAtivo)
    if (ehAtivo) {
      link.setAttribute('aria-current', 'page')
    } else {
      link.removeAttribute('aria-current')
    }
  })
}

/**
 * Normaliza um pathname para comparação: trata "/index.html" e "/" como
 * equivalentes e remove barra final, evitando falsos negativos entre a raiz
 * do site e o arquivo index.html explícito.
 */
function normalizarPath (pathname) {
  let p = pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '')
  return p === '' ? '/' : p
}
