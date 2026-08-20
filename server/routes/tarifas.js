const express = require('express')
const ctrl = require('../controllers/tarifas')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()
router.use(requireAuth)

router.get('/', ctrl.listar)
router.post('/', ctrl.criar)
router.patch('/:id', ctrl.atualizar)
router.delete('/:id', ctrl.remover)

module.exports = router
