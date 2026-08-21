const { z } = require('zod')

const placa = z.string('Placa é obrigatória.').trim().min(1, 'Placa é obrigatória.').transform(v => v.toUpperCase())
const telefoneObrigatorio = z.string('Telefone é obrigatório.').trim().min(1, 'O telefone é obrigatório e não pode ser removido.')

const criar = z.object({
  nome: z.string('Nome é obrigatório.').trim().min(1, 'Nome é obrigatório.'),
  cpf: z.string('CPF é obrigatório.').trim().min(1, 'CPF é obrigatório.'),
  placa,
  telefone: telefoneObrigatorio,
  valorMensalidade: z.coerce.number().min(0).optional(),
  ativo: z.coerce.boolean().optional()
})

const atualizar = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório.').optional(),
  cpf: z.string().trim().min(1, 'CPF é obrigatório.').optional(),
  placa: placa.optional(),
  // Presente e vazio = erro (telefone não pode ser removido); ausente = não mexe no campo.
  telefone: telefoneObrigatorio.optional(),
  valorMensalidade: z.coerce.number().min(0).optional(),
  ativo: z.coerce.boolean().optional()
})

module.exports = { criar, atualizar }
