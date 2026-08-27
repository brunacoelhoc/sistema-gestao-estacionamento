import { Module } from '@nestjs/common'
import { AuditoriaModule } from '../auditoria/auditoria.module'
import { JustificativasPontoController } from './justificativas-ponto.controller'
import { JustificativasPontoService } from './justificativas-ponto.service'
import { PontoCalculoService } from './ponto-calculo.service'
import { PontoController } from './ponto.controller'
import { PontoService } from './ponto.service'
import { TrabalhoExtraController } from './trabalho-extra.controller'
import { TrabalhoExtraService } from './trabalho-extra.service'

@Module({
  imports: [AuditoriaModule],
  controllers: [PontoController, TrabalhoExtraController, JustificativasPontoController],
  providers: [PontoService, PontoCalculoService, TrabalhoExtraService, JustificativasPontoService],
  exports: [PontoService, PontoCalculoService, TrabalhoExtraService, JustificativasPontoService]
})
export class PontoModule {}
