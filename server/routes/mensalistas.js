const express = require('express')
const ctrl = require('../controllers/mensalistas')
const { requireAuth, requireProfileComplete } = require('../middleware/auth')
const validar = require('../middleware/validar')
const schemas = require('../schemas/mensalistaSchemas')

const router = express.Router()
router.use(requireAuth, requireProfileComplete)

router.get('/', ctrl.listar)
router.post('/', validar(schemas.criar), ctrl.criar)
router.patch('/:id', validar(schemas.atualizar), ctrl.atualizar)
router.delete('/:id', ctrl.remover)

module.exports = router
