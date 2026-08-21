const eventoUsoRepository = require('../repositories/eventoUsoRepository')

async function registrarEventos (req, res) {
  const { eventos } = req.body

  await eventoUsoRepository.criarMuitos(
    eventos.map(e => ({
      tipo: e.tipo,
      tela: e.tela,
      duracaoMs: e.duracaoMs ?? null,
      criadoEm: new Date(e.quando)
    }))
  )

  res.status(204).end()
}

module.exports = { registrarEventos }
