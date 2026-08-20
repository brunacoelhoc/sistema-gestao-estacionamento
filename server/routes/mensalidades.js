const express = require('express')
const ctrl = require('../controllers/mensalidades')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()
router.use(requireAuth)

router.get('/', ctrl.listar)
router.patch('/:id', ctrl.atualizar)

module.exports = router
