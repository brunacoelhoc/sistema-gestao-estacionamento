import { Module } from '@nestjs/common'
import { AuditoriaModule } from '../auditoria/auditoria.module'
import { PdiController } from './pdi.controller'
import { PdiService } from './pdi.service'

@Module({
  imports: [AuditoriaModule],
  controllers: [PdiController],
  providers: [PdiService],
  exports: [PdiService]
})
export class PdiModule {}
