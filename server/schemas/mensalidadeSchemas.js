const { z } = require('zod')

const atualizar = z.object({
  status: z.enum(['pendente', 'paga', 'cancelada'], 'Status inválido. Use pendente, paga ou cancelada.'),
  formaPagamento: z.enum(['pix', 'cartao_credito', 'cartao_debito', 'dinheiro']).nullable().optional()
})

module.exports = { atualizar }
