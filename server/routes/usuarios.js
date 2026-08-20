const express = require('express')
const ctrl = require('../controllers/usuarios')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const router = express.Router()
router.use(requireAuth)

router.get('/', requireAdmin, ctrl.listar)
router.post('/', requireAdmin, ctrl.criar)
router.patch('/:id', ctrl.atualizar)

module.exports = router
