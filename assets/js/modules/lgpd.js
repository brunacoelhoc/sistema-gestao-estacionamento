/**
 * Módulo LGPD (Lei Geral de Proteção de Dados) & Utilitários de Privacidade
 * - Gerencia o aviso e consentimento de cookies/dados.
 * - Exporta o utilitário LGPDModule para validação e máscara de CPF.
 */

// ==========================================
// 1. UTILITÁRIOS DE DADOS (LGPDModule)
// ==========================================
window.LGPDModule = {
  /**
   * Sanitiza e aplica máscara padrão de CPF (000.000.000-00)
   * @param {string} cpf
   * @returns {string}
   */
  maskCPF (cpf) {
    if (!cpf) return ''
    const cleanCPF = String(cpf).replace(/\D/g, '').slice(0, 11)
    return cleanCPF
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  },

  /**
   * Valida algoritmo do dígito verificador e estrutura do CPF
   * @param {string} cpf
   * @returns {boolean}
   */
  validateCPF (cpf) {
    if (!cpf) return false
    const clean = String(cpf).replace(/\D/g, '')

    if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) {
      return false
    }

    let sum = 0
    let remainder

    for (let i = 1; i <= 9; i++) {
      sum += parseInt(clean.substring(i - 1, i), 10) * (11 - i)
    }

    remainder = (sum * 10) % 11
    if (remainder === 10 || remainder === 11) remainder = 0
    if (remainder !== parseInt(clean.substring(9, 10), 10)) return false

    sum = 0
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(clean.substring(i - 1, i), 10) * (12 - i)
    }

    remainder = (sum * 10) % 11
    if (remainder === 10 || remainder === 11) remainder = 0
    if (remainder !== parseInt(clean.substring(10, 11), 10)) return false

    return true
  }
}

// ==========================================
// 2. GERENCIADOR DE CONSENTIMENTO (LGPDConsentManager)
// ==========================================
class LGPDConsentManager {
  constructor () {
    this.storageKey = 'lgpd_consent_status' // 'accepted' | 'rejected'
    this.init()
  }

  init () {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.checkConsent())
    } else {
      this.checkConsent()
    }
  }

  checkConsent () {
    const status = localStorage.getItem(this.storageKey)
    if (!status) {
      this.renderBanner()
    }
  }

  renderBanner () {
    if (document.getElementById('lgpd-banner')) return

    const banner = document.createElement('div')
    banner.id = 'lgpd-banner'
    banner.className =
      'fixed-bottom bg-dark text-white p-3 shadow-lg z-3 border-top border-primary'
    banner.setAttribute('role', 'dialog')
    banner.setAttribute('aria-modal', 'false')
    banner.setAttribute('aria-live', 'polite')
    banner.setAttribute('aria-label', 'Aviso de Consentimento e Privacidade')

    banner.innerHTML = `
      <div class="container d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
        <div class="text-sm">
          <i class="fas fa-user-shield text-info me-2" aria-hidden="true"></i>
          <strong>Respeitamos sua privacidade:</strong> Este sistema utiliza armazenamento local e processa dados cadastrais de mensalistas e veículos estritamente para a operação do estacionamento, em conformidade com a <strong>LGPD</strong>.
        </div>
        <div class="d-flex gap-2 flex-shrink-0">
          <button id="btn-lgpd-reject" class="btn btn-outline-light btn-sm px-3 fw-semibold" type="button">
            Apenas Essenciais
          </button>
          <button id="btn-lgpd-accept" class="btn btn-primary btn-sm px-4 fw-semibold" type="button">
            Aceitar e Continuar
          </button>
        </div>
      </div>
    `

    document.body.appendChild(banner)

    const btnAccept = document.getElementById('btn-lgpd-accept')
    const btnReject = document.getElementById('btn-lgpd-reject')

    // Gerenciamento de foco para leitores de tela e navegacao via teclado
    setTimeout(() => {
      btnAccept?.focus()
    }, 100)

    btnAccept?.addEventListener('click', () => this.setConsent('accepted'))
    btnReject?.addEventListener('click', () => this.setConsent('rejected'))
  }

  setConsent (status) {
    localStorage.setItem(this.storageKey, status)
    const banner = document.getElementById('lgpd-banner')
    if (banner) {
      banner.remove()
    }
  }
}

// Instanciação global
window.lgpdManager = new LGPDConsentManager()
