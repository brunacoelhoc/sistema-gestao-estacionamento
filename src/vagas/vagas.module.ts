import { Module } from '@nestjs/common'
import { VagasController } from './vagas.controller'
import { VagasService } from './vagas.service'

@Module({
  controllers: [VagasController],
  providers: [VagasService],
  exports: [VagasService]
})
export class VagasModule {}
