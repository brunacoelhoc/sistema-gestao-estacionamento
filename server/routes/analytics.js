const express = require('express')
const ctrl = require('../controllers/analytics')
const validar = require('../middleware/validar')
const schemas = require('../schemas/analyticsSchemas')
const { eventosLimiter } = require('../middleware/rateLimit')

const router = express.Router()

// Sem requireAuth: o banner de LGPD aparece antes do login, e a captura de
// telemetria roda em qualquer tela, autenticada ou não. Quem controla se o
// navegador manda algo é o consentimento (window.analyticsPermitido no
// front), não a sessão.
router.post('/eventos', eventosLimiter, validar(schemas.registrar), ctrl.registrarEventos)

module.exports = router
