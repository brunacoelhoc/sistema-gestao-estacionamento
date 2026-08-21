const prisma = require('../config/prisma')

function listar (where, client = prisma) {
  return client.mensalidade.findMany({
    where,
    orderBy: { referencia: 'desc' },
    include: { mensalista: { select: { nome: true, placa: true } } }
  })
}

function buscarPorMensalistaEReferencia (mensalistaId, referencia, client = prisma) {
  return client.mensalidade.findUnique({
    where: { mensalistaId_referencia: { mensalistaId, referencia } }
  })
}

// Ciclo de 30 dias mais recente do mensalista cujo período ainda cobre
// `dataReferencia` (dataFim >= dataReferencia) — usado para decidir, no
// fechamento de um ticket, se ele já pagou o período corrente ou se esta é a
// primeira entrada de um novo ciclo.
function buscarVigente (mensalistaId, dataReferencia, client = prisma) {
  return client.mensalidade.findFirst({
    where: { mensalistaId, dataFim: { gte: dataReferencia } },
    orderBy: { dataInicio: 'desc' }
  })
}

function criar (dados, client = prisma) {
  return client.mensalidade.create({ data: dados })
}

function atualizar (id, dados, client = prisma) {
  return client.mensalidade.update({ where: { id }, data: dados })
}

module.exports = {
  listar,
  buscarPorMensalistaEReferencia,
  buscarVigente,
  criar,
  atualizar
}
