/**
 * Módulo LGPD (Lei Geral de Proteção de Dados) & Utilitários de Privacidade
 * - Gerencia o aviso e consentimento de cookies/dados.
 * - Exporta o utilitário LGPDModule para validação de CPF (a máscara/
 *   ocultação de exibição é feita no back-end, ver mascararCpf.util.ts).
 */

// ==========================================
// 1. UTILITÁRIOS DE DADOS (LGPDModule)
// ==========================================
window.LGPDModule = {
  /**
   * Valida apenas a estrutura do CPF (11 dígitos numéricos), sem cálculo de
   * dígito verificador — conforme especificação.
   * @param {string} cpf
   * @returns {boolean}
   */
  validateCPF (cpf) {
    if (!cpf) return false
    const clean = String(cpf).replace(/\D/g, '')
    return clean.length === 11
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
    window.analyticsPermitido = status === 'accepted'
    if (!status) {
      this.renderBanner()
    }
  }

  renderBanner () {
    if (document.getElementById('lgpd-banner')) return

    const banner = document.createElement('div')
    banner.id = 'lgpd-banner'
    banner.className =
      'lgpd-banner fixed-bottom bg-dark text-white p-3 shadow-lg border-top border-primary'
    banner.setAttribute('role', 'dialog')
    banner.setAttribute('aria-modal', 'false')
    banner.setAttribute('aria-live', 'polite')
    banner.setAttribute('aria-label', 'Aviso de Consentimento e Privacidade')

    banner.innerHTML = `
      <div class="container d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
        <div class="text-sm">
          <i class="fas fa-user-shield text-info me-2" aria-hidden="true"></i>
          <strong>Respeitamos sua privacidade:</strong> Este sistema utiliza armazenamento local e processa dados cadastrais de mensalistas e veículos para a operação do estacionamento. Com seu aceite, também registramos quais telas você visita e por quanto tempo, de forma anônima, para melhorar o sistema — em conformidade com a <strong>LGPD</strong>.
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
    window.analyticsPermitido = status === 'accepted'
    // Avisa outros módulos (ex.: telemetria.js) que o consentimento acabou
    // de mudar, caso já estejam rodando nesta mesma página.
    document.dispatchEvent(new CustomEvent('lgpd:consentimento', { detail: status }))

    const banner = document.getElementById('lgpd-banner')
    if (banner) {
      banner.remove()
    }
  }
}

// Instanciação global
window.lgpdManager = new LGPDConsentManager()
