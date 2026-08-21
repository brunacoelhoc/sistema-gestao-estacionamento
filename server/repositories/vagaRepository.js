const prisma = require('../config/prisma')

// Sem orderBy o Postgres devolve as linhas em ordem física arbitrária (não
// alfabética, não de criação) e pode até mudar entre uma consulta e outra
// depois de um UPDATE — o combo de "Vaga Disponível" no front ficava
// embaralhado, fazendo uma vaga recém-liberada (voltou a "livre" ao fechar
// um ticket) parecer sumida só porque foi parar longe da posição esperada.
function listarTodas (client = prisma) {
  return client.vaga.findMany({ orderBy: { codigo: 'asc' } })
}

function buscarPorId (id, client = prisma) {
  return client.vaga.findUnique({ where: { id } })
}

function criar (dados, client = prisma) {
  return client.vaga.create({ data: dados })
}

function atualizar (id, dados, client = prisma) {
  return client.vaga.update({ where: { id }, data: dados })
}

function remover (id, client = prisma) {
  return client.vaga.delete({ where: { id } })
}

module.exports = { listarTodas, buscarPorId, criar, atualizar, remover }
