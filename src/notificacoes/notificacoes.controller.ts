import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { NotificacoesService } from './notificacoes.service'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('notificacoes')
export class NotificacoesController {
  constructor (private readonly notificacoesService: NotificacoesService) {}

  @Get()
  listarMinhas (@CurrentUser() solicitante: UsuarioAutenticado) {
    return this.notificacoesService.listarMinhas(solicitante.id)
  }

  @Patch(':id/lida')
  marcarComoLida (@Param('id') id: string, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.notificacoesService.marcarComoLida(id, solicitante.id)
  }
}
