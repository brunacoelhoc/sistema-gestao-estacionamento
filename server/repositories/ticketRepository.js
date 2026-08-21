const prisma = require('../config/prisma')

function listar (where, { skip, take } = {}, client = prisma) {
  return client.ticket.findMany({ where, orderBy: { dataEntrada: 'desc' }, skip, take })
}

function contar (where, client = prisma) {
  return client.ticket.count({ where })
}

function buscarPorId (id, client = prisma) {
  return client.ticket.findUnique({ where: { id } })
}

function buscarAbertoPorPlaca (placa, client = prisma) {
  return client.ticket.findFirst({ where: { placa, status: 'aberto' } })
}

function criar (dados, client = prisma) {
  return client.ticket.create({ data: dados })
}

function atualizar (id, dados, client = prisma) {
  return client.ticket.update({ where: { id }, data: dados })
}

function remover (id, client = prisma) {
  return client.ticket.delete({ where: { id } })
}

module.exports = {
  listar,
  contar,
  buscarPorId,
  buscarAbertoPorPlaca,
  criar,
  atualizar,
  remover
}
