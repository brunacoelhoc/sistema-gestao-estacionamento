/**
 * Módulo LGPD (Lei Geral de Proteção de Dados)
 * Gerencia o aviso e consentimento de cookies e tratamento de dados pessoais.
 */

class LGPDConsentManager {
  constructor () {
    this.storageKey = 'lgpd_consent_accepted'
    this.init()
  }

  init () {
    document.addEventListener('DOMContentLoaded', () => {
      this.checkConsent()
    })
  }

  checkConsent () {
    const hasConsented = localStorage.getItem(this.storageKey)
    if (!hasConsented) {
      this.renderBanner()
    }
  }

  renderBanner () {
    const banner = document.createElement('div')
    banner.id = 'lgpd-banner'
    banner.className =
      'fixed-bottom bg-dark text-white p-3 shadow-lg z-3 border-top border-primary'
    banner.setAttribute('role', 'region')
    banner.setAttribute('aria-label', 'Consentimento de Privacidade e Cookies')

    banner.innerHTML = `
      <div class="container d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
        <div class="text-sm">
          <i class="fas fa-user-shield text-info me-2" aria-hidden="true"></i>
          <strong>Respeitamos sua privacidade:</strong> Este sistema utiliza armazenamento local e processa dados cadastrais de mensalistas e veículos estritamente para a operação do estacionamento, em conformidade com a <strong>LGPD</strong>.
        </div>
        <div class="d-flex gap-2">
          <button id="btn-lgpd-accept" class="btn btn-primary btn-sm px-4 fw-semibold" type="button">
            Aceitar e Continuar
          </button>
        </div>
      </div>
    `

    document.body.appendChild(banner)

    document
      .getElementById('btn-lgpd-accept')
      ?.addEventListener('click', () => {
        this.acceptConsent()
      })
  }

  acceptConsent () {
    localStorage.setItem(this.storageKey, 'true')
    const banner = document.getElementById('lgpd-banner')
    if (banner) {
      banner.remove()
    }
  }
}

// Instanciação global
window.lgpdManager = new LGPDConsentManager()
