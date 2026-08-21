const prisma = require('../config/prisma')

// Todo método aceita um `client` opcional (padrão: a instância compartilhada
// do Prisma) — permite chamar dentro de uma prisma.$transaction(tx => ...)
// passando `tx` no lugar, sem duplicar a query.

function buscarPorId (id, client = prisma) {
  return client.usuario.findUnique({ where: { id } })
}

function buscarPorCpf (cpf, client = prisma) {
  return client.usuario.findUnique({ where: { cpf } })
}

function buscarPorEmail (email, client = prisma) {
  return client.usuario.findUnique({ where: { email } })
}

function listarTodos (client = prisma) {
  return client.usuario.findMany()
}

function criar (dados, client = prisma) {
  return client.usuario.create({ data: dados })
}

function atualizar (id, dados, client = prisma) {
  return client.usuario.update({ where: { id }, data: dados })
}

module.exports = {
  buscarPorId,
  buscarPorCpf,
  buscarPorEmail,
  listarTodos,
  criar,
  atualizar
}
