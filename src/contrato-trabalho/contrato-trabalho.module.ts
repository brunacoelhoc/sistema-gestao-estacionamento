import { Module } from '@nestjs/common'
import { AuditoriaModule } from '../auditoria/auditoria.module'
import { NotificacoesModule } from '../notificacoes/notificacoes.module'
import { ContratoTrabalhoController } from './contrato-trabalho.controller'
import { ContratoTrabalhoService } from './contrato-trabalho.service'

@Module({
  imports: [AuditoriaModule, NotificacoesModule],
  controllers: [ContratoTrabalhoController],
  providers: [ContratoTrabalhoService],
  exports: [ContratoTrabalhoService]
})
export class ContratoTrabalhoModule {}
