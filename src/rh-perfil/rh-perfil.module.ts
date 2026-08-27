import { Module } from '@nestjs/common'
import { AuditoriaModule } from '../auditoria/auditoria.module'
import { RhPerfilController } from './rh-perfil.controller'
import { RhPerfilService } from './rh-perfil.service'

@Module({
  imports: [AuditoriaModule],
  controllers: [RhPerfilController],
  providers: [RhPerfilService],
  exports: [RhPerfilService]
})
export class RhPerfilModule {}
