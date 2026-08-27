import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { AtualizarItemPdiDto } from './dto/atualizar-item-pdi.dto'
import { CriarItemPdiDto } from './dto/criar-item-pdi.dto'
import { MoverItemPdiDto } from './dto/mover-item-pdi.dto'
import { PdiService } from './pdi.service'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('pdi')
export class PdiController {
  constructor (private readonly pdiService: PdiService) {}

  // Precisa vir antes de ":usuarioId" — senão o Nest trata "me" como um id.
  @Get('me')
  listarMeuPdi (@CurrentUser() solicitante: UsuarioAutenticado) {
    return this.pdiService.listarPorUsuario(solicitante.id, solicitante)
  }

  @Get(':usuarioId')
  listarPorUsuario (@Param('usuarioId') usuarioId: string, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.pdiService.listarPorUsuario(usuarioId, solicitante)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Post(':usuarioId')
  criar (
    @Param('usuarioId') usuarioId: string,
    @Body() dto: CriarItemPdiDto,
    @CurrentUser() solicitante: UsuarioAutenticado
  ) {
    return this.pdiService.criar(usuarioId, dto, solicitante)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Patch('item/:itemId')
  editar (
    @Param('itemId') itemId: string,
    @Body() dto: AtualizarItemPdiDto,
    @CurrentUser() solicitante: UsuarioAutenticado
  ) {
    return this.pdiService.editar(itemId, dto, solicitante)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Patch('item/:itemId/concluir')
  concluir (@Param('itemId') itemId: string, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.pdiService.concluir(itemId, solicitante)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Patch('item/:itemId/reabrir')
  reabrir (@Param('itemId') itemId: string, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.pdiService.reabrir(itemId, solicitante)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Patch('item/:itemId/mover')
  mover (
    @Param('itemId') itemId: string,
    @Body() dto: MoverItemPdiDto,
    @CurrentUser() solicitante: UsuarioAutenticado
  ) {
    return this.pdiService.mover(itemId, dto.direcao, solicitante)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Delete('item/:itemId')
  remover (@Param('itemId') itemId: string, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.pdiService.remover(itemId, solicitante)
  }
}
