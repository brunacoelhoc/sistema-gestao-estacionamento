import { Module } from '@nestjs/common'
import { CobrancaService } from './cobranca.service'

@Module({
  providers: [CobrancaService],
  exports: [CobrancaService]
})
export class CobrancaModule {}
