const prisma = require('../config/prisma')

async function listar (req, res) {
  res.json(await prisma.tarifa.findMany())
}

async function criar (req, res) {
  const { categoria, valorHora, valor } = req.body
  const valorFinal = Number(valorHora ?? valor)
  if (!categoria || Number.isNaN(valorFinal)) {
    return res.status(400).json({ erro: 'Categoria e valor por hora são obrigatórios.' })
  }

  const tarifa = await prisma.tarifa.create({
    data: { categoria, valorHora: valorFinal }
  })
  res.status(201).json(tarifa)
}

async function atualizar (req, res) {
  const dados = {}
  const { categoria, valorHora, valor } = req.body
  if (categoria !== undefined) dados.categoria = categoria
  if (valorHora !== undefined || valor !== undefined) {
    dados.valorHora = Number(valorHora ?? valor)
  }

  res.json(await prisma.tarifa.update({ where: { id: req.params.id }, data: dados }))
}

async function remover (req, res) {
  await prisma.tarifa.delete({ where: { id: req.params.id } })
  res.status(204).end()
}

module.exports = { listar, criar, atualizar, remover }
