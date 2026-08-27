import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { DefinirEtapaCarreiraDto } from './dto/definir-etapa-carreira.dto'
import { EtapasCarreiraService } from './etapas-carreira.service'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('etapas-carreira')
export class EtapasCarreiraController {
  constructor (private readonly etapasCarreiraService: EtapasCarreiraService) {}

  // Sem @Roles(): qualquer usuário autenticado enxerga o catálogo inteiro —
  // é o que alimenta a trilha de carreira exibida na aba "Meus Dados de RH".
  @Get()
  listar () {
    return this.etapasCarreiraService.listar()
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Post()
  criar (@Body() dto: DefinirEtapaCarreiraDto, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.etapasCarreiraService.criar(dto, solicitante)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Patch(':id')
  editar (
    @Param('id') id: string,
    @Body() dto: DefinirEtapaCarreiraDto,
    @CurrentUser() solicitante: UsuarioAutenticado
  ) {
    return this.etapasCarreiraService.editar(id, dto, solicitante)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Delete(':id')
  remover (@Param('id') id: string, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.etapasCarreiraService.remover(id, solicitante)
  }
}
