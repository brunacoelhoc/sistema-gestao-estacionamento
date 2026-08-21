import { Module } from '@nestjs/common'
import { MensalistasController } from './mensalistas.controller'
import { MensalistasService } from './mensalistas.service'

@Module({
  controllers: [MensalistasController],
  providers: [MensalistasService],
  exports: [MensalistasService]
})
export class MensalistasModule {}
