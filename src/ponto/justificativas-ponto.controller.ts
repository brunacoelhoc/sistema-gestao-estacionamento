import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { CriarJustificativaDto } from './dto/criar-justificativa.dto'
import { JustificativasPontoService } from './justificativas-ponto.service'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('ponto/justificativas')
export class JustificativasPontoController {
  constructor (private readonly justificativasPontoService: JustificativasPontoService) {}

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Post()
  criar (@Body() dto: CriarJustificativaDto, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.justificativasPontoService.criar(dto, solicitante)
  }

  @Get()
  listar (@CurrentUser() solicitante: UsuarioAutenticado, @Query('usuarioId') usuarioId?: string) {
    return this.justificativasPontoService.listar(solicitante, usuarioId)
  }
}
