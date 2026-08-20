const prisma = require('../config/prisma')

async function listar (req, res) {
  const { mensalistaId } = req.query
  res.json(
    await prisma.mensalidade.findMany({
      where: mensalistaId ? { mensalistaId } : undefined,
      orderBy: { referencia: 'desc' }
    })
  )
}

async function atualizar (req, res) {
  const { status } = req.body
  if (!['pendente', 'paga', 'cancelada'].includes(status)) {
    return res.status(400).json({ erro: 'Status inválido. Use pendente, paga ou cancelada.' })
  }

  res.json(await prisma.mensalidade.update({ where: { id: req.params.id }, data: { status } }))
}

module.exports = { listar, atualizar }
