import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

// Telemetria de uso: o navegador manda um lote a cada ~10s por aba aberta,
// então o limite é bem mais folgado que o de login — só existe pra impedir
// abuso do endpoint, não pra frear uso normal.
@Injectable()
export class EventosThrottlerGuard extends ThrottlerGuard {
  protected async getErrorMessage (): Promise<string> {
    return 'Muitos eventos enviados. Tente novamente em instantes.'
  }
}
