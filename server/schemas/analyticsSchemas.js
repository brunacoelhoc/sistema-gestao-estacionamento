const { z } = require('zod')

const evento = z.object({
  tipo: z.enum(['visualizacao', 'tempo-na-tela']),
  tela: z.string().trim().min(1).max(200),
  duracaoMs: z.number().int().nonnegative().optional().nullable(),
  quando: z.number()
})

const registrar = z.object({
  eventos: z.array(evento).min(1).max(50)
})

module.exports = { registrar }
