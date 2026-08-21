import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { AtualizarMensalidadeDto } from './dto/atualizar-mensalidade.dto'
import { MensalidadesService } from './mensalidades.service'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('mensalidades')
export class MensalidadesController {
  constructor (private readonly mensalidadesService: MensalidadesService) {}

  @Get()
  listar (@Query('mensalistaId') mensalistaId?: string) {
    return this.mensalidadesService.listar(mensalistaId)
  }

  @Patch(':id')
  atualizar (
    @Param('id') id: string,
    @Body() dto: AtualizarMensalidadeDto,
    @CurrentUser() usuario: UsuarioAutenticado
  ) {
    return this.mensalidadesService.atualizar(id, dto, usuario.id)
  }
}
