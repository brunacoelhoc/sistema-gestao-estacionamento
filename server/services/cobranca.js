/**
 * Cálculo do valor cobrado no fechamento de um ticket avulso — único ponto
 * de cálculo de tarifa do sistema (ver server/controllers/tickets.js#fechar).
 * Extraído do controller para poder ser testado sem depender de Prisma/DB.
 *
 * Mensalista NÃO passa por aqui: a cobrança dele é por ciclo de 30 dias, não
 * por hora — ver server/services/mensalidade.js e a lógica de fechamento em
 * server/controllers/tickets.js#fechar.
 */

// Tolerância de cortesia: permanências até este limite não são cobradas.
const TEMPO_TOLERANCIA_MINUTOS = 15

// Sem tarifa cadastrada, usa esse valor por hora como fallback.
const VALOR_HORA_PADRAO = 10

function calcularTarifaAvulsa (diffMinutos, valorHora) {
  if (diffMinutos <= TEMPO_TOLERANCIA_MINUTOS) return 0

  const horasPagas = Math.max(1, Math.ceil(diffMinutos / 60))
  return horasPagas * (valorHora ?? VALOR_HORA_PADRAO)
}

module.exports = {
  TEMPO_TOLERANCIA_MINUTOS,
  VALOR_HORA_PADRAO,
  calcularTarifaAvulsa
}
