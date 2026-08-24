import { Injectable } from '@nestjs/common'

// Tolerância de cortesia: permanências até este limite não são cobradas.
export const TEMPO_TOLERANCIA_MINUTOS = 15

// Sem tarifa cadastrada, usa esse valor por hora como fallback.
export const VALOR_HORA_PADRAO = 10

// Acréscimo fixo (R$/hora) sobre o valor/hora da tarifa quando a vaga
// ocupada é do tipo "coberta" — vaga coberta custa mais que uma comum
// independente da categoria de tarifa escolhida, em vez de exigir cadastrar
// uma tarifa duplicada por tipo de vaga (ver TicketsService.fechar). Ex.:
// tarifa "Carro" a R$7,00/h numa vaga coberta fecha a R$10,00/h.
export const ADICIONAL_VAGA_COBERTA_VALOR = 3

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
  calcularTarifaAvulsa (diffMinutos: number, valorHora: number | undefined, vagaCoberta = false): number {
    if (diffMinutos <= TEMPO_TOLERANCIA_MINUTOS) return 0

    const valorHoraBase = valorHora ?? VALOR_HORA_PADRAO
    const valorHoraFinal = vagaCoberta
      ? valorHoraBase + ADICIONAL_VAGA_COBERTA_VALOR
      : valorHoraBase

    const horasPagas = Math.max(1, Math.ceil(diffMinutos / 60))
    return horasPagas * valorHoraFinal
  }
}
