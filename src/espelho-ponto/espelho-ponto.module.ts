import { Module } from '@nestjs/common'
import { AuditoriaModule } from '../auditoria/auditoria.module'
import { NotificacoesModule } from '../notificacoes/notificacoes.module'
import { PontoModule } from '../ponto/ponto.module'
import { EspelhoPontoController } from './espelho-ponto.controller'
import { EspelhoPontoService } from './espelho-ponto.service'

@Module({
  imports: [AuditoriaModule, NotificacoesModule, PontoModule],
  controllers: [EspelhoPontoController],
  providers: [EspelhoPontoService],
  exports: [EspelhoPontoService]
})
export class EspelhoPontoModule {}
