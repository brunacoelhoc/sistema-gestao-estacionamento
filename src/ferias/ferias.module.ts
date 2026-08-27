import { Module } from '@nestjs/common'
import { AuditoriaModule } from '../auditoria/auditoria.module'
import { FeriasController } from './ferias.controller'
import { FeriasService } from './ferias.service'

@Module({
  imports: [AuditoriaModule],
  controllers: [FeriasController],
  providers: [FeriasService],
  exports: [FeriasService]
})
export class FeriasModule {}
