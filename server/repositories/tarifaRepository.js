const prisma = require('../config/prisma')

function listarTodas (client = prisma) {
  return client.tarifa.findMany()
}

function buscarPorId (id, client = prisma) {
  return client.tarifa.findUnique({ where: { id } })
}

// Usada como fallback quando um ticket não tem tarifa própria vinculada.
function buscarPrimeira (client = prisma) {
  return client.tarifa.findFirst()
}

function criar (dados, client = prisma) {
  return client.tarifa.create({ data: dados })
}

function atualizar (id, dados, client = prisma) {
  return client.tarifa.update({ where: { id }, data: dados })
}

function remover (id, client = prisma) {
  return client.tarifa.delete({ where: { id } })
}

module.exports = { listarTodas, buscarPorId, buscarPrimeira, criar, atualizar, remover }
