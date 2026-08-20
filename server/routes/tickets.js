const express = require('express')
const ctrl = require('../controllers/tickets')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()
router.use(requireAuth)

router.get('/', ctrl.listar)
router.post('/', ctrl.abrir)
router.post('/:id/fechar', ctrl.fechar)
router.delete('/:id', ctrl.remover)

module.exports = router
