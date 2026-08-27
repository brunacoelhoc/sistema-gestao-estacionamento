import { Module } from '@nestjs/common'
import { DesempenhoController } from './desempenho.controller'
import { DesempenhoService } from './desempenho.service'

@Module({
  controllers: [DesempenhoController],
  providers: [DesempenhoService],
  exports: [DesempenhoService]
})
export class DesempenhoModule {}
