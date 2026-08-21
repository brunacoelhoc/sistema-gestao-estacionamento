const rateLimit = require('express-rate-limit')

// Limita tentativas de login/cadastro por IP para dificultar força bruta de
// senha/CPF. Não conta requisições bem-sucedidas, só as que falham (senha
// errada, CPF já existente etc.), pra não travar um usuário legítimo que
// erra a senha uma vez e depois acerta.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { erro: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' }
})

// Telemetria de uso: o navegador manda um lote a cada ~10s por aba aberta
// (ver assets/js/modules/telemetria.js), então o limite é bem mais folgado
// que o de login — só existe pra impedir abuso do endpoint, não pra frear
// uso normal.
const eventosLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitos eventos enviados. Tente novamente em instantes.' }
})

module.exports = { authLimiter, eventosLimiter }
