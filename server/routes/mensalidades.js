const express = require('express')
const ctrl = require('../controllers/mensalidades')
const { requireAuth, requireProfileComplete } = require('../middleware/auth')
const validar = require('../middleware/validar')
const schemas = require('../schemas/mensalidadeSchemas')

const router = express.Router()
router.use(requireAuth, requireProfileComplete)

router.get('/', ctrl.listar)
router.patch('/:id', validar(schemas.atualizar), ctrl.atualizar)

module.exports = router
