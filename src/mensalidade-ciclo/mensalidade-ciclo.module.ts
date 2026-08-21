import { Module } from '@nestjs/common'
import { MensalidadeCicloService } from './mensalidade-ciclo.service'

@Module({
  providers: [MensalidadeCicloService],
  exports: [MensalidadeCicloService]
})
export class MensalidadeCicloModule {}
