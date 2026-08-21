const tarifaRepository = require('../repositories/tarifaRepository')

async function listar (req, res) {
  res.json(await tarifaRepository.listarTodas())
}

async function criar (req, res) {
  const { categoria, valorHora } = req.body

  const tarifa = await tarifaRepository.criar({ categoria, valorHora })
  res.status(201).json(tarifa)
}

async function atualizar (req, res) {
  res.json(await tarifaRepository.atualizar(req.params.id, req.body))
}

async function remover (req, res) {
  await tarifaRepository.remover(req.params.id)
  res.status(204).end()
}

module.exports = { listar, criar, atualizar, remover }
