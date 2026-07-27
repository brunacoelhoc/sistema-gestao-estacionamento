/**
 * Vanta-Init JS - Inicialização do Efeito Visual 3D
 * Otimizado com suporte a preferências de redução de movimento (WCAG).
 */

document.addEventListener('DOMContentLoaded', () => {
  // Respeita a preferência de redução de movimento do usuário
  const prefereSemAnimacao = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches
  if (prefereSemAnimacao) {
    console.log(
      '[ParkGestão] Animação Vanta.js desativada por preferência de acessibilidade.'
    )
    return
  }

  // Elemento alvo da animação de fundo (por exemplo, cabeçalho da Home)
  const targetElement =
    document.getElementById('vanta-bg') ||
    document.querySelector('.vanta-container')

  // Verifica se o container e a biblioteca VANTA existem
  if (
    targetElement &&
    typeof VANTA !== 'undefined' &&
    typeof THREE !== 'undefined'
  ) {
    try {
      window.vantaEffect = VANTA.TOPOLOGY({
        el: targetElement,
        THREE: THREE,
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
      console.warn(
        '[ParkGestão] Não foi possível carregar o efeito Vanta.js:',
        error
      )
    }
  }
})
