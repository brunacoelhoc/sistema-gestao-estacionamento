import { Module } from '@nestjs/common'
import { AuditoriaModule } from '../auditoria/auditoria.module'
import { NotificacoesModule } from '../notificacoes/notificacoes.module'
import { PontoModule } from '../ponto/ponto.module'
import { FolhaPagamentoController } from './folha-pagamento.controller'
import { FolhaPagamentoService } from './folha-pagamento.service'

@Module({
  imports: [AuditoriaModule, NotificacoesModule, PontoModule],
  controllers: [FolhaPagamentoController],
  providers: [FolhaPagamentoService],
  exports: [FolhaPagamentoService]
})
export class FolhaPagamentoModule {}
