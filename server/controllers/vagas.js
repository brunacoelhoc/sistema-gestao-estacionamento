const vagaRepository = require('../repositories/vagaRepository')

async function listar (req, res) {
  res.json(await vagaRepository.listarTodas())
}

async function criar (req, res) {
  const { codigo, tipo, status, acessivel } = req.body

  const vaga = await vagaRepository.criar({
    codigo,
    tipo: tipo || 'comum',
    status: status || 'livre',
    acessivel: acessivel || false
  })
  res.status(201).json(vaga)
}

async function atualizar (req, res) {
  res.json(await vagaRepository.atualizar(req.params.id, req.body))
}

async function remover (req, res) {
  await vagaRepository.remover(req.params.id)
  res.status(204).end()
}

module.exports = { listar, criar, atualizar, remover }
