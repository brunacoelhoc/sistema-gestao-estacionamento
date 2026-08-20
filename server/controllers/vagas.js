const prisma = require('../config/prisma')

async function listar (req, res) {
  res.json(await prisma.vaga.findMany())
}

async function criar (req, res) {
  const { codigo, tipo, status } = req.body
  if (!codigo) {
    return res.status(400).json({ erro: 'Código da vaga é obrigatório.' })
  }

  const vaga = await prisma.vaga.create({
    data: {
      codigo: codigo.toUpperCase(),
      tipo: (tipo || 'comum').toLowerCase(),
      status: (status || 'livre').toLowerCase()
    }
  })
  res.status(201).json(vaga)
}

async function atualizar (req, res) {
  const dados = {}
  const { codigo, tipo, status } = req.body
  if (codigo !== undefined) dados.codigo = codigo.toUpperCase()
  if (tipo !== undefined) dados.tipo = tipo.toLowerCase()
  if (status !== undefined) dados.status = status.toLowerCase()

  res.json(await prisma.vaga.update({ where: { id: req.params.id }, data: dados }))
}

async function remover (req, res) {
  await prisma.vaga.delete({ where: { id: req.params.id } })
  res.status(204).end()
}

module.exports = { listar, criar, atualizar, remover }
