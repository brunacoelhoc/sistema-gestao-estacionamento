const express = require('express')
const ctrl = require('../controllers/auth')
const { authLimiter } = require('../middleware/rateLimit')
const validar = require('../middleware/validar')
const schemas = require('../schemas/authSchemas')

const router = express.Router()

router.post('/login', authLimiter, validar(schemas.login), ctrl.login)
router.post('/registrar', authLimiter, validar(schemas.registrar), ctrl.registrar)
router.post('/google', validar(schemas.google), ctrl.google)
router.post('/reset/solicitar', authLimiter, validar(schemas.solicitarReset), ctrl.solicitarReset)
router.post('/reset/confirmar', authLimiter, validar(schemas.confirmarReset), ctrl.confirmarReset)

module.exports = router
