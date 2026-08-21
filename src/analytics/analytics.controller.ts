import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { seconds, Throttle } from '@nestjs/throttler'
import { EventosThrottlerGuard } from '../common/guards/eventos-throttler.guard'
import { AnalyticsService } from './analytics.service'
import { RegistrarEventosDto } from './dto/registrar-eventos.dto'

// Sem guard de auth: o banner de LGPD aparece antes do login, e a captura de
// telemetria roda em qualquer tela, autenticada ou não. Quem controla se o
// navegador manda algo é o consentimento (window.analyticsPermitido no
// front), não a sessão. O guard de rate limit existe só pra impedir abuso
// do endpoint.
@Controller('analytics')
export class AnalyticsController {
  constructor (private readonly analyticsService: AnalyticsService) {}

  @UseGuards(EventosThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  @Post('eventos')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registrarEventos (@Body() dto: RegistrarEventosDto) {
    await this.analyticsService.registrarEventos(dto.eventos)
  }
}
