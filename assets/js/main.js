/**
 * Main JS - Inicialização e Utilidades Globais do ParkGestão
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializa Tooltips do Bootstrap em botões/elementos com data-bs-toggle="tooltip"
  const tooltipTriggerList = Array.from(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  )
  tooltipTriggerList.forEach(tooltipTriggerEl => {
    new bootstrap.Tooltip(tooltipTriggerEl)
  })

  // 2. Destaca automaticamente o link da página atual na Navbar
  marcarLinkNavegacaoAtivo()

  // 3. Suporte a atalhos de teclado de acessibilidade (Alt + A para focar no Skip Link)
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
 * Destaca a opção ativa na barra de navegação baseando-se na URL atual
 */
function marcarLinkNavegacaoAtivo () {
  const pathAtual = window.location.pathname
  const navLinks = document.querySelectorAll('.navbar-nav .nav-link')

  navLinks.forEach(link => {
    const href = link.getAttribute('href')
    if (!href) return

    if (
      pathAtual.endsWith(href) ||
      (href === '../index.html' && pathAtual.endsWith('/'))
    ) {
      link.classList.add('active')
      link.setAttribute('aria-current', 'page')
    }
  })
}
