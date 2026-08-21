const prisma = require('../config/prisma')

function invalidarPendentes (usuarioId, client = prisma) {
  return client.resetSenhaCodigo.deleteMany({ where: { usuarioId, usado: false } })
}

function criar (dados, client = prisma) {
  return client.resetSenhaCodigo.create({ data: dados })
}

function buscarPendenteMaisRecente (usuarioId, client = prisma) {
  return client.resetSenhaCodigo.findFirst({
    where: { usuarioId, usado: false },
    orderBy: { criadoEm: 'desc' }
  })
}

function marcarComoUsado (id, client = prisma) {
  return client.resetSenhaCodigo.update({ where: { id }, data: { usado: true } })
}

module.exports = {
  invalidarPendentes,
  criar,
  buscarPendenteMaisRecente,
  marcarComoUsado
}
