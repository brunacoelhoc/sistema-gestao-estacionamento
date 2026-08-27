import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { DecidirTrabalhoExtraDto } from './dto/decidir-trabalho-extra.dto'
import { SolicitarTrabalhoExtraDto } from './dto/solicitar-trabalho-extra.dto'
import { TrabalhoExtraService } from './trabalho-extra.service'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('ponto/trabalho-extra')
export class TrabalhoExtraController {
  constructor (private readonly trabalhoExtraService: TrabalhoExtraService) {}

  @Post()
  solicitar (@Body() dto: SolicitarTrabalhoExtraDto, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.trabalhoExtraService.solicitar(solicitante.id, dto)
  }

  @Get()
  listar (@CurrentUser() solicitante: UsuarioAutenticado, @Query('usuarioId') usuarioId?: string) {
    return this.trabalhoExtraService.listar(solicitante, usuarioId)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Patch(':id')
  decidir (
    @Param('id') id: string,
    @Body() dto: DecidirTrabalhoExtraDto,
    @CurrentUser() solicitante: UsuarioAutenticado
  ) {
    return this.trabalhoExtraService.decidir(id, dto, solicitante)
  }
}
