const express = require('express')
const ctrl = require('../controllers/usuarios')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const validar = require('../middleware/validar')
const schemas = require('../schemas/usuarioSchemas')

const router = express.Router()
router.use(requireAuth)

router.get('/', requireAdmin, ctrl.listar)
router.post('/', requireAdmin, validar(schemas.criar), ctrl.criar)
router.patch('/:id', validar(schemas.atualizar), ctrl.atualizar)

module.exports = router
