/**
 * Vanta-Init JS - Inicialização do Efeito Visual 3D
 * Único ponto de inicialização do Vanta.js no projeto.
 * Respeita tanto prefers-reduced-motion (sistema) quanto o toggle manual
 * "Animação Off" (.reduce-motion, controlado por accessibility.js).
 */

/**
 * Verifica se a animação deve ser suprimida por acessibilidade.
 * @param {MediaQueryList} [mediaQueryList]
 * @returns {boolean}
 */
function deveReduzirMovimento (mediaQueryList) {
  const mql =
    mediaQueryList || window.matchMedia('(prefers-reduced-motion: reduce)')
  const preferenciaManual = document.body.classList.contains('reduce-motion')
  return preferenciaManual || mql.matches
}

/**
 * Interrompe e destrói a instância do Vanta.js limpando memória/GPU.
 */
function pararVantaSeAtivo () {
  if (window.vantaEffect) {
    try {
      window.vantaEffect.destroy()
    } catch (e) {
      console.warn('[ParkGestão] Erro ao destruir efeito Vanta.js:', e)
    } finally {
      window.vantaEffect = null
      console.log('[ParkGestão] Vanta.js interrompido.')
    }
  }
}

/**
 * Inicializa a animação 3D caso as condições de acessibilidade permitam.
 */
function iniciarVantaSePermitido () {
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')

  // Se o movimento deve ser reduzido, garante que a animação esteja parada
  if (deveReduzirMovimento(mql)) {
    pararVantaSeAtivo()
    console.log('[ParkGestão] Animação Vanta.js desativada por acessibilidade.')
    return
  }

  // Se já existe uma instância rodando, não reinicia
  if (window.vantaEffect) return

  const targetElement = document.getElementById('vanta-bg')

  if (
    targetElement &&
    typeof VANTA !== 'undefined' &&
    typeof THREE !== 'undefined'
  ) {
    try {
      window.vantaEffect = VANTA.TOPOLOGY({
        el: targetElement,
        THREE: window.THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        scale: 1.0,
        scaleMobile: 1.0,
        color: 0x0d6efd,
        backgroundColor: 0x0f172a
      })
      console.log('[ParkGestão] Vanta.js inicializado com sucesso.')
    } catch (error) {
      console.warn('[ParkGestão] Erro ao inicializar Vanta.js:', error)
    }
  }
}

// Interface Global de Acessibilidade
window.deveReduzirMovimento = deveReduzirMovimento
window.pararVantaSeAtivo = pararVantaSeAtivo
window.iniciarVantaSePermitido = iniciarVantaSePermitido

// Bootstrap do script respeitando o estado de carregamento do DOM
function init () {
  iniciarVantaSePermitido()

  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')

  // Ouve mudanças de acessibilidade em nível de Sistema Operacional em tempo real
  mql.addEventListener('change', e => {
    if (e.matches) {
      pararVantaSeAtivo()
    } else {
      iniciarVantaSePermitido()
    }
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

// Limpeza de memória GPU ao navegar/fechar a página
window.addEventListener('beforeunload', pararVantaSeAtivo)
