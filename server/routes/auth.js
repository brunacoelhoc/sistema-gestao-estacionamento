const express = require('express')
const ctrl = require('../controllers/auth')

const router = express.Router()

router.post('/login', ctrl.login)
router.post('/registrar', ctrl.registrar)
router.post('/google', ctrl.google)
router.post('/reset/solicitar', ctrl.solicitarReset)
router.post('/reset/confirmar', ctrl.confirmarReset)

module.exports = router
