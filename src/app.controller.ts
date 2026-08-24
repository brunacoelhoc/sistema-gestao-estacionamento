import { Controller, Get } from '@nestjs/common'
import { ADICIONAL_VAGA_COBERTA_VALOR, TEMPO_TOLERANCIA_MINUTOS } from './cobranca/cobranca.service'
import { DURACAO_CICLO_DIAS } from './mensalidade-ciclo/mensalidade-ciclo.service'

@Controller()
export class AppController {
  @Get('health')
  health () {
    return { ok: true }
  }

  // Constantes de regra de cobrança usadas só pra prévia de valor mostrada
  // no front antes de confirmar o fechamento de um ticket (Tickets e
  // Dashboard) — o valor cobrado de fato é sempre recalculado no backend
  // (TicketsService.fechar), mas a prévia não pode divergir se essas regras
  // mudarem só aqui.
  @Get('config')
  config () {
    return {
      toleranciaMinutos: TEMPO_TOLERANCIA_MINUTOS,
      duracaoCicloMensalistaDias: DURACAO_CICLO_DIAS,
      adicionalVagaCobertaValor: ADICIONAL_VAGA_COBERTA_VALOR
    }
  }
}
