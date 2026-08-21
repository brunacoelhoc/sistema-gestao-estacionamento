import { Injectable } from '@nestjs/common'

// Tolerância de cortesia: permanências até este limite não são cobradas.
export const TEMPO_TOLERANCIA_MINUTOS = 15

// Sem tarifa cadastrada, usa esse valor por hora como fallback.
export const VALOR_HORA_PADRAO = 10

/**
 * Cálculo do valor cobrado no fechamento de um ticket avulso — único ponto
 * de cálculo de tarifa do sistema (ver TicketsService.fechar). Lógica pura,
 * sem dependência de Prisma/DB, para poder ser testada isoladamente.
 *
 * Mensalista NÃO passa por aqui: a cobrança dele é por ciclo de 30 dias, não
 * por hora — ver MensalidadeCicloService e a lógica de fechamento em
 * TicketsService.fechar.
 */
@Injectable()
export class CobrancaService {
  calcularTarifaAvulsa (diffMinutos: number, valorHora: number | undefined): number {
    if (diffMinutos <= TEMPO_TOLERANCIA_MINUTOS) return 0

    const horasPagas = Math.max(1, Math.ceil(diffMinutos / 60))
    return horasPagas * (valorHora ?? VALOR_HORA_PADRAO)
  }
}
