/**
 * Módulo de Telemetria de Uso (Product Analytics)
 * Registra apenas duas coisas, por tela: que ela foi visitada ("visualizacao")
 * e quanto tempo a pessoa ficou nela ("tempo-na-tela"). Nada de posição do
 * mouse, cliques individuais ou identificação da pessoa.
 * Só coleta depois do "Aceitar e Continuar" no aviso de LGPD (ver lgpd.js) —
 * window.analyticsPermitido é quem decide isso.
 */

const TELEMETRIA_ENDPOINT = `${API_BASE_URL}/analytics/eventos`
const TELEMETRIA_INTERVALO_MS = 10000

const filaTelemetria = []
let telemetriaInicioTela = Date.now()
let telemetriaJaRegistrouVisualizacao = false

function telemetriaPermitida () {
  return window.analyticsPermitido === true
}

function registrarEventoUso (tipo, detalhes = {}) {
  if (!telemetriaPermitida()) return
  filaTelemetria.push({
    tipo,
    tela: location.pathname,
    quando: Date.now(),
    ...detalhes
  })
}

function registrarVisualizacaoUmaVez () {
  if (telemetriaJaRegistrouVisualizacao || !telemetriaPermitida()) return
  telemetriaJaRegistrouVisualizacao = true
  registrarEventoUso('visualizacao')
}

function enviarFilaTelemetria (final = false) {
  if (filaTelemetria.length === 0) return
  const lote = filaTelemetria.splice(0, filaTelemetria.length)
  const corpo = JSON.stringify({ eventos: lote })

  // `keepalive: true` garante o envio mesmo com a página descarregando —
  // mesma garantia do sendBeacon, sem o problema dele: sendBeacon sempre
  // manda a requisição com credenciais quando o destino é de outra origem,
  // e o navegador recusa isso quando o servidor responde CORS com
  // Access-Control-Allow-Origin: '*' (caso do backend em dev, sem
  // CORS_ORIGIN configurado) — daí o erro de CORS ao trocar de aba/fechar.
  fetch(TELEMETRIA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: corpo,
    keepalive: final
  }).catch(() => {
    // Falha de rede: o lote se perde. Aceitável para telemetria de uso —
    // diferente de dados de negócio, não há retentativa.
  })
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    registrarEventoUso('tempo-na-tela', { duracaoMs: Date.now() - telemetriaInicioTela })
    enviarFilaTelemetria(true)
  } else {
    telemetriaInicioTela = Date.now()
  }
})

// Se o consentimento for aceito depois que a página já carregou (a pessoa
// demorou pra clicar no banner), começa a registrar a partir daí.
document.addEventListener('lgpd:consentimento', ev => {
  if (ev.detail === 'accepted') registrarVisualizacaoUmaVez()
})

setInterval(enviarFilaTelemetria, TELEMETRIA_INTERVALO_MS)
registrarVisualizacaoUmaVez()
