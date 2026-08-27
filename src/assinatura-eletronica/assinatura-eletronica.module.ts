import { Module } from '@nestjs/common'
import { AssinaturaEletronicaController } from './assinatura-eletronica.controller'
import { AssinaturaEletronicaService } from './assinatura-eletronica.service'

@Module({
  controllers: [AssinaturaEletronicaController],
  providers: [AssinaturaEletronicaService],
  exports: [AssinaturaEletronicaService]
})
export class AssinaturaEletronicaModule {}
