const { z } = require('zod')

// Reflete o enum StatusVaga do schema.prisma (só "livre"/"ocupada" existem
// no banco hoje — ver prisma/migrations/20260819183625_init/migration.sql).
const minusculo = valor => (typeof valor === 'string' ? valor.trim().toLowerCase() : valor)

const statusVaga = z.preprocess(minusculo, z.enum(['livre', 'ocupada']))
const tipoVaga = z.preprocess(minusculo, z.enum(['comum', 'coberta', 'mensalista']))

const codigo = z.string('Código da vaga é obrigatório.').trim().min(1, 'Código da vaga é obrigatório.').transform(v => v.toUpperCase())

const criar = z.object({
  codigo,
  tipo: tipoVaga.optional(),
  status: statusVaga.optional(),
  acessivel: z.boolean().optional()
})

const atualizar = z.object({
  codigo: codigo.optional(),
  tipo: tipoVaga.optional(),
  status: statusVaga.optional(),
  acessivel: z.boolean().optional()
})

module.exports = { criar, atualizar }
