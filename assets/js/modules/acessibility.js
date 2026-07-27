/**
 * Módulo de Acessibilidade (WCAG 2.1 AAA)
 * Gerencia alto contraste, tamanho de fonte, modo dislexia, daltonismo e redução de movimentos.
 */

class AccessibilityManager {
  constructor () {
    this.currentFontSizeRatio = 1.0
    this.init()
  }

  init () {
    this.applySavedPreferences()
    this.bindEvents()
  }

  bindEvents () {
    // Eventos de Fontes
    document
      .getElementById('btn-font-increase')
      ?.addEventListener('click', () => this.changeFontSize(0.1))
    document
      .getElementById('btn-font-decrease')
      ?.addEventListener('click', () => this.changeFontSize(-0.1))
    document
      .getElementById('btn-font-reset')
      ?.addEventListener('click', () => this.resetFontSize())

    // Toggle de Modos
    document
      .getElementById('btn-contrast')
      ?.addEventListener('click', () => this.toggleHighContrast())
    document
      .getElementById('btn-dyslexic')
      ?.addEventListener('click', () => this.toggleDyslexicFont())
    document
      .getElementById('btn-motion')
      ?.addEventListener('click', () => this.toggleReduceMotion())

    // Seletor de Daltonismo
    document
      .getElementById('select-daltonism')
      ?.addEventListener('change', e => this.setDaltonismFilter(e.target.value))
  }

  changeFontSize (delta) {
    this.currentFontSizeRatio = Math.min(
      Math.max(this.currentFontSizeRatio + delta, 0.8),
      1.4
    )
    document.documentElement.style.fontSize = `${
      this.currentFontSizeRatio * 100
    }%`
    localStorage.setItem(
      'pref_font_ratio',
      this.currentFontSizeRatio.toString()
    )
  }

  resetFontSize () {
    this.currentFontSizeRatio = 1.0
    document.documentElement.style.fontSize = '100%'
    localStorage.removeItem('pref_font_ratio')
  }

  toggleHighContrast () {
    document.body.classList.toggle('high-contrast')
    const isHighContrast = document.body.classList.contains('high-contrast')
    localStorage.setItem(
      'pref_high_contrast',
      isHighContrast ? 'true' : 'false'
    )
  }

  toggleDyslexicFont () {
    document.body.classList.toggle('dyslexic-font')
    const isDyslexic = document.body.classList.contains('dyslexic-font')
    localStorage.setItem('pref_dyslexic', isDyslexic ? 'true' : 'false')
  }

  toggleReduceMotion () {
    document.body.classList.toggle('reduce-motion')
    const isReduceMotion = document.body.classList.contains('reduce-motion')
    localStorage.setItem(
      'pref_reduce_motion',
      isReduceMotion ? 'true' : 'false'
    )
  }

  setDaltonismFilter (type) {
    document.body.classList.remove('protanopia', 'deuteranopia', 'tritanopia')
    if (type && type !== 'normal') {
      document.body.classList.add(type)
      localStorage.setItem('pref_daltonism', type)
    } else {
      localStorage.removeItem('pref_daltonism')
    }
  }

  applySavedPreferences () {
    // Restaurar Fonte
    const savedRatio = localStorage.getItem('pref_font_ratio')
    if (savedRatio) {
      this.currentFontSizeRatio = parseFloat(savedRatio)
      document.documentElement.style.fontSize = `${
        this.currentFontSizeRatio * 100
      }%`
    }

    // Restaurar Modos
    if (localStorage.getItem('pref_high_contrast') === 'true')
      document.body.classList.add('high-contrast')
    if (localStorage.getItem('pref_dyslexic') === 'true')
      document.body.classList.add('dyslexic-font')
    if (localStorage.getItem('pref_reduce_motion') === 'true')
      document.body.classList.add('reduce-motion')

    // Restaurar Daltonismo
    const savedDaltonism = localStorage.getItem('pref_daltonism')
    if (savedDaltonism) {
      document.body.classList.add(savedDaltonism)
      const select = document.getElementById('select-daltonism')
      if (select) select.value = savedDaltonism
    }
  }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  window.accessibilityManager = new AccessibilityManager()
})
