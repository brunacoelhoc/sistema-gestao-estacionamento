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

  // 1b. Dropdowns do Bootstrap (ex.: botões "Exportar"): força o Popper a
  //     posicionar o menu com `strategy: fixed`, relativa à viewport, em vez
  //     de `absolute` (padrão). Isso evita que o menu apareça "atrás" do
  //     card seguinte por causa de contextos de empilhamento CSS locais —
  //     `fixed` ignora esse aninhamento e sempre desenha por cima.
  const dropdownTriggerList = Array.from(
    document.querySelectorAll('[data-bs-toggle="dropdown"]')
  )
  dropdownTriggerList.forEach(dropdownTriggerEl => {
    new bootstrap.Dropdown(dropdownTriggerEl, {
      popperConfig: defaultConfig => ({ ...defaultConfig, strategy: 'fixed' })
    })
  })

  // 2. Destaca automaticamente o link da página atual na Navbar
  marcarLinkNavegacaoAtivo()

  // 2c. Revela cards e blocos de conteúdo com uma pequena animação conforme
  //     a rolagem os traz para a tela (mais imersivo). Ver detalhes em
  //     inicializarScrollReveal().
  inicializarScrollReveal()

  // 2b. Preenche o menu do usuário logado (avatar, nome, Meu Perfil, Sair)
  if (typeof inicializarMenuUsuario === 'function') {
    inicializarMenuUsuario()
  }

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

  // 4. Indicador de status do servidor (bolinha + texto na navbar, presente
  //    em todas as páginas). Antes disto, o indicador ficava travado para
  //    sempre em "Verificando servidor…" pois nada chamava checkHealth().
  verificarStatusServidor()
  setInterval(verificarStatusServidor, 20000)
})

/**
 * Consulta a saúde da API (Express) e atualiza a bolinha + o texto de
 * TODOS os indicadores de status presentes na página (a navbar tem um, o
 * rodapé tem outro — por isso a busca é por classe, não por id único).
 */
async function verificarStatusServidor () {
  const dots = document.querySelectorAll('.js-api-status-dot')
  const textos = document.querySelectorAll('.js-api-status-text')
  if (dots.length === 0 && textos.length === 0) return

  if (typeof ApiService === 'undefined' || !ApiService.checkHealth) return

  const online = await ApiService.checkHealth()

  dots.forEach(dot => {
    dot.classList.remove('bg-secondary', 'bg-success', 'bg-danger', 'pulse-dot')
    dot.classList.add(online ? 'bg-success' : 'bg-danger')
    if (online) dot.classList.add('pulse-dot')
  })

  textos.forEach(texto => {
    texto.textContent = online ? 'Servidor online' : 'Servidor offline'
  })
}

/**
 * Verifica se a animação deve ser suprimida por acessibilidade: respeita
 * tanto a preferência do sistema operacional (prefers-reduced-motion) quanto
 * o toggle manual "Animação Off" da barra de acessibilidade
 * (.reduce-motion, controlado por accessibility.js).
 */
function deveReduzirMovimento () {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.body.classList.contains('reduce-motion')
  )
}
window.deveReduzirMovimento = deveReduzirMovimento

/**
 * Anima a entrada de cards e blocos de conteúdo (KPIs, gráficos, tabelas)
 * com um leve fade + deslocamento vertical conforme a rolagem os traz para
 * a área visível, usando IntersectionObserver — mais leve que rodar isso no
 * scroll diretamente. Cada card só revela uma vez (não "pisca" ao rolar de
 * volta) e ganha um pequeno atraso em cascata conforme a posição dentro do
 * próprio grupo (linha do grid), para um efeito mais orgânico.
 */
function inicializarScrollReveal () {
  // Filhos diretos de #main-content já são revelados por
  // inicializarAnimacoesGsap() (ver gsap-init.js) na entrada da página — um
  // segundo sistema de fade aqui, disputando opacity/transform do mesmo
  // elemento, é o que fazia cards como "Desempenho" ou "Funcionários
  // Cadastrados" (ambos filhos diretos de #main-content e .card) sumirem
  // de vez em quando: dependendo da ordem de execução entre o GSAP e o
  // IntersectionObserver, o elemento ficava com opacity:0 preso.
  const mainContent = document.getElementById('main-content')
  const alvos = Array.from(
    document.querySelectorAll(
      '.card-kpi, .kpi-card, .metrics-chart-card, .metrics-kpi-card, .vaga-card, .card'
    )
  ).filter(el => !el.closest('.modal, .swal2-container') && el.parentElement !== mainContent)

  if (alvos.length === 0) return

  // Sem IntersectionObserver (navegador muito antigo) ou com "reduzir
  // movimento" ativo: mostra tudo direto, sem animação.
  if (typeof IntersectionObserver === 'undefined' || deveReduzirMovimento()) {
    alvos.forEach(el => el.classList.add('scroll-reveal-visible'))
    return
  }

  alvos.forEach(el => {
    el.classList.add('scroll-reveal')
    const posicaoNoGrupo = Array.from(el.parentElement?.children || []).indexOf(
      el
    )
    el.style.transitionDelay = `${Math.min(Math.max(posicaoNoGrupo, 0), 4) * 60}ms`
  })

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('scroll-reveal-visible')
        obs.unobserve(entry.target)
      })
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  )

  alvos.forEach(el => observer.observe(el))
}
window.inicializarScrollReveal = inicializarScrollReveal

/**
 * Destaca a opção ativa na barra de navegação comparando a URL resolvida de
 * cada link com a URL atual da página — em vez de comparação de texto
 * (endsWith), que falha em casos de borda como "/" vs "/index.html" ou
 * links relativos vindos de subpastas (views/).
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
  const p = pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '')
  return p === '' ? '/' : p
}
