import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { DecidirFeriasDto } from './dto/decidir-ferias.dto'
import { SolicitarFeriasDto } from './dto/solicitar-ferias.dto'
import { FeriasService } from './ferias.service'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('ferias')
export class FeriasController {
  constructor (private readonly feriasService: FeriasService) {}

  @Post()
  solicitar (@Body() dto: SolicitarFeriasDto, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.feriasService.solicitar(solicitante.id, dto)
  }

  @Get()
  listar (@CurrentUser() solicitante: UsuarioAutenticado, @Query('usuarioId') usuarioId?: string) {
    return this.feriasService.listar(solicitante, usuarioId)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Patch(':id')
  decidir (
    @Param('id') id: string,
    @Body() dto: DecidirFeriasDto,
    @CurrentUser() solicitante: UsuarioAutenticado
  ) {
    return this.feriasService.decidir(id, dto, solicitante)
  }

  // Rota própria (não pode ser PATCH :id de novo, já usada por decidir) —
  // admin/RH corrigindo as datas de uma solicitação ainda pendente.
  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Patch(':id/datas')
  editar (
    @Param('id') id: string,
    @Body() dto: SolicitarFeriasDto,
    @CurrentUser() solicitante: UsuarioAutenticado
  ) {
    return this.feriasService.editar(id, dto, solicitante)
  }
}
