import { Module } from '@nestjs/common'
import { CobrancaModule } from '../cobranca/cobranca.module'
import { EmailModule } from '../email/email.module'
import { MensalidadeCicloModule } from '../mensalidade-ciclo/mensalidade-ciclo.module'
import { TicketsController } from './tickets.controller'
import { TicketsService } from './tickets.service'

@Module({
  imports: [CobrancaModule, MensalidadeCicloModule, EmailModule],
  controllers: [TicketsController],
  providers: [TicketsService]
})
export class TicketsModule {}
