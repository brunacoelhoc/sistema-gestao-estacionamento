/**
 * Inicialização Global do GSAP (GreenSock Animation Platform)
 * Único ponto de inicialização do GSAP no projeto — anima a entrada do
 * conteúdo principal de qualquer página e, na home, também o hero.
 *
 * Respeita a preferência de "reduzir movimento" (do sistema operacional ou
 * do toggle manual da barra de acessibilidade) — se `deveReduzirMovimento()`
 * (definida em assets/js/main.js) disser que sim, nenhuma animação roda e o
 * conteúdo aparece direto.
 */
function gsapDeveReduzirMovimento () {
  return typeof window.deveReduzirMovimento === 'function'
    ? window.deveReduzirMovimento()
    : window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.body.classList.contains('reduce-motion')
}

function inicializarAnimacoesGsap () {
  if (typeof gsap === 'undefined') {
    console.warn('[ParkGestão] GSAP não carregado — animações desativadas.')
    return
  }

  if (gsapDeveReduzirMovimento()) return

  // --- Entrada do conteúdo principal (qualquer página) ---------------------
  const main = document.getElementById('main-content')
  if (main) {
    const secoes = Array.from(main.children).filter(
      el => el.offsetParent !== null
    )
    if (secoes.length > 0) {
      gsap.set(secoes, { clearProps: 'opacity,transform' })
      gsap.from(secoes, {
        opacity: 0,
        y: 18,
        duration: 0.5,
        ease: 'power2.out',
        stagger: 0.08,
        // Remove `transform` e `opacity` inline ao final: sem isso, o GSAP
        // deixa a matriz de identidade aplicada (transform:
        // matrix(1,0,0,1,0,0)), que cria um novo contexto de empilhamento e
        // "prende" dropdowns (position: fixed) dentro dele — fazendo o menu
        // aparecer atrás de elementos seguintes na página, como o próximo
        // card. Limpar `opacity` também evita que o inline fique preso e
        // brigue com qualquer outro sistema que mexa na opacidade do mesmo
        // elemento depois (ex.: scroll-reveal em main.js).
        clearProps: 'transform,opacity'
      })
    }
  }

  // --- Hero da página inicial: badge, título, texto e botões em sequência --
  const heroCard = document.querySelector('.hero-section')
  if (heroCard) {
    const alvosHero = heroCard.querySelectorAll('.badge, #hero-title, .lead, .btn')
    if (alvosHero.length > 0) {
      gsap.set(alvosHero, { clearProps: 'opacity,transform' })
      gsap.from(alvosHero, {
        opacity: 0,
        y: 24,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.07,
        delay: 0.1,
        clearProps: 'transform'
      })
    }
  }
}

/**
 * Anima a contagem de um elemento de KPI do valor atualmente exibido (ou 0,
 * na primeira renderização) até `valorFinal`, usado nos cards de indicadores
 * do Dashboard e de Métricas. Sem GSAP disponível, ou com "reduzir
 * movimento" ativo, aplica o valor final direto, sem animação.
 *
 * @param {HTMLElement} elemento
 * @param {number} valorFinal
 * @param {Object} [opcoes]
 * @param {(valor: number) => string} [opcoes.formatar] Formata o número
 *   corrente a cada frame (ex.: moeda, percentual). Padrão: inteiro simples.
 * @param {number} [opcoes.duracao] Duração em segundos. Padrão: 0.8.
 */
function animarContadorGsap (elemento, valorFinal, opcoes = {}) {
  if (!elemento) return

  const { formatar = valor => String(Math.round(valor)), duracao = 0.8 } =
    opcoes

  const alvo = Number(valorFinal) || 0

  if (typeof gsap === 'undefined' || gsapDeveReduzirMovimento()) {
    elemento.textContent = formatar(alvo)
    elemento.dataset.valorAnimado = alvo
    return
  }

  const valorInicial = Number(elemento.dataset.valorAnimado ?? 0) || 0
  const proxy = { valor: valorInicial }

  gsap.to(proxy, {
    valor: alvo,
    duration: duracao,
    ease: 'power1.out',
    onUpdate: () => {
      elemento.textContent = formatar(proxy.valor)
    },
    onComplete: () => {
      elemento.textContent = formatar(alvo)
      elemento.dataset.valorAnimado = alvo
    }
  })
}

/**
 * Entrada em cascata de uma lista de elementos recém-inseridos no DOM (ex.:
 * nós de um .roadmap montado via fetch, depois do carregamento inicial da
 * página — por isso não é coberto pelo `gsap.from(secoes, ...)` de
 * inicializarAnimacoesGsap, que só roda uma vez no DOMContentLoaded). Sem
 * GSAP ou com "reduzir movimento" ativo, não faz nada — os elementos já
 * aparecem no estado final.
 *
 * @param {Element[]|NodeListOf<Element>} elementos
 */
function animarEntradaEmCascata (elementos) {
  const lista = Array.from(elementos || [])
  if (lista.length === 0) return
  if (typeof gsap === 'undefined' || gsapDeveReduzirMovimento()) return

  gsap.set(lista, { clearProps: 'opacity,transform' })
  gsap.from(lista, {
    opacity: 0,
    y: 12,
    duration: 0.4,
    ease: 'power2.out',
    stagger: 0.08,
    clearProps: 'transform'
  })
}

/**
 * Anima o preenchimento de um anel de progresso SVG (ver .progress-ring-valor
 * em assets/scss/_components.scss — usado no resumo do PDI da aba RH) de 0%
 * até `percentualFinal`, via stroke-dashoffset. Sem GSAP ou com "reduzir
 * movimento" ativo, aplica o valor final direto.
 *
 * @param {SVGCircleElement} circuloEl Elemento <circle> com raio já definido.
 * @param {number} percentualFinal 0–100.
 */
function animarAnelProgresso (circuloEl, percentualFinal) {
  if (!circuloEl) return

  const raio = circuloEl.r.baseVal.value
  const perimetro = 2 * Math.PI * raio
  const alvo = Math.max(0, Math.min(100, Number(percentualFinal) || 0))

  circuloEl.style.strokeDasharray = `${perimetro}`

  const aplicarOffset = percentual => {
    circuloEl.style.strokeDashoffset = `${perimetro - (percentual / 100) * perimetro}`
  }

  if (typeof gsap === 'undefined' || gsapDeveReduzirMovimento()) {
    aplicarOffset(alvo)
    return
  }

  const proxy = { valor: 0 }
  aplicarOffset(0)
  gsap.to(proxy, {
    valor: alvo,
    duration: 1,
    ease: 'power2.out',
    onUpdate: () => aplicarOffset(proxy.valor)
  })
}

document.addEventListener('DOMContentLoaded', inicializarAnimacoesGsap)

window.inicializarAnimacoesGsap = inicializarAnimacoesGsap
window.animarContadorGsap = animarContadorGsap
window.animarEntradaEmCascata = animarEntradaEmCascata
window.animarAnelProgresso = animarAnelProgresso
