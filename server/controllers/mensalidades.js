const mensalidadeRepository = require('../repositories/mensalidadeRepository')

async function listar (req, res) {
  const { mensalistaId } = req.query
  res.json(await mensalidadeRepository.listar(mensalistaId ? { mensalistaId } : undefined))
}

async function atualizar (req, res) {
  res.json(await mensalidadeRepository.atualizar(req.params.id, req.body))
}

module.exports = { listar, atualizar }
