import { Module } from '@nestjs/common'
import { EmailModule } from '../email/email.module'
import { MensalidadesController } from './mensalidades.controller'
import { MensalidadesService } from './mensalidades.service'

@Module({
  imports: [EmailModule],
  controllers: [MensalidadesController],
  providers: [MensalidadesService]
})
export class MensalidadesModule {}
