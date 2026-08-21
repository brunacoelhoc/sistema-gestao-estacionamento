const prisma = require('../config/prisma')

function listarTodos (client = prisma) {
  return client.mensalista.findMany()
}

function buscarPorId (id, client = prisma) {
  return client.mensalista.findUnique({ where: { id } })
}

function buscarAtivoPorPlaca (placa, client = prisma) {
  return client.mensalista.findFirst({ where: { placa, ativo: true } })
}

function criar (dados, client = prisma) {
  return client.mensalista.create({ data: dados })
}

function atualizar (id, dados, client = prisma) {
  return client.mensalista.update({ where: { id }, data: dados })
}

function remover (id, client = prisma) {
  return client.mensalista.delete({ where: { id } })
}

module.exports = {
  listarTodos,
  buscarPorId,
  buscarAtivoPorPlaca,
  criar,
  atualizar,
  remover
}
