import { Module } from '@nestjs/common'
import { AuditoriaModule } from '../auditoria/auditoria.module'
import { EtapasCarreiraController } from './etapas-carreira.controller'
import { EtapasCarreiraService } from './etapas-carreira.service'

@Module({
  imports: [AuditoriaModule],
  controllers: [EtapasCarreiraController],
  providers: [EtapasCarreiraService],
  exports: [EtapasCarreiraService]
})
export class EtapasCarreiraModule {}
