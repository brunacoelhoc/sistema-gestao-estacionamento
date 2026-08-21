const { z } = require('zod')

// `valor` é um alias legado de `valorHora` que ainda pode chegar de
// integrações antigas — o front atual (ApiService.createTarifa) já manda só
// valorHora, mas mantemos a compatibilidade aqui em vez de no controller.
const aliasValor = dados => {
  if (dados && typeof dados === 'object' && dados.valorHora === undefined && dados.valor !== undefined) {
    return { ...dados, valorHora: dados.valor }
  }
  return dados
}

const categoria = z.string('Categoria é obrigatória.').trim().min(1, 'Categoria é obrigatória.')
const valorHora = z.coerce.number('Valor por hora é obrigatório.').min(0, 'Valor por hora não pode ser negativo.')

const criar = z.preprocess(aliasValor, z.object({
  categoria,
  valorHora
}))

const atualizar = z.preprocess(aliasValor, z.object({
  categoria: categoria.optional(),
  valorHora: valorHora.optional()
}))

module.exports = { criar, atualizar }
