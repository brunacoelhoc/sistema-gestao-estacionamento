const { z } = require('zod')

const abrir = z.object({
  placa: z.string('Placa é obrigatória.').trim().min(1, 'Placa é obrigatória.'),
  vagaId: z.string('Vaga é obrigatória.').trim().min(1, 'Vaga é obrigatória.'),
  // O front sempre manda estes dois campos, com `null` explícito quando não
  // há tarifa/mensalista selecionado (ver ApiService.criarTicket) — sem
  // `.nullable()` o Zod rejeita `null` mesmo sendo `.optional()`, e todo
  // ticket avulso (o caso mais comum) quebrava com 400 ao abrir.
  tarifaId: z.string().trim().min(1).nullable().optional(),
  mensalistaId: z.string().trim().min(1).nullable().optional()
})

const fechar = z.object({
  // Mesmo motivo acima: ApiService.fecharTicket manda `formaPagamento: null`
  // por padrão quando a tela não escolhe uma forma de pagamento específica.
  formaPagamento: z.string().trim().min(1).nullable().optional()
})

module.exports = { abrir, fechar }
