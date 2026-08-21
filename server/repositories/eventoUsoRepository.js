const prisma = require('../config/prisma')

function criarMuitos (eventos, client = prisma) {
  return client.eventoUso.createMany({ data: eventos })
}

module.exports = { criarMuitos }
