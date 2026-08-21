const express = require('express')
const ctrl = require('../controllers/tickets')
const { requireAuth, requireProfileComplete } = require('../middleware/auth')
const validar = require('../middleware/validar')
const schemas = require('../schemas/ticketSchemas')

const router = express.Router()
router.use(requireAuth, requireProfileComplete)

router.get('/', ctrl.listar)
router.post('/', validar(schemas.abrir), ctrl.abrir)
router.post('/:id/fechar', validar(schemas.fechar), ctrl.fechar)
router.delete('/:id', ctrl.remover)

module.exports = router
