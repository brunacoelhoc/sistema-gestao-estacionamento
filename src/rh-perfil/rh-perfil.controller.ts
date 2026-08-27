import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { DefinirPerfilRhDto } from './dto/definir-perfil-rh.dto'
import { RhPerfilService } from './rh-perfil.service'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('rh-perfil')
export class RhPerfilController {
  constructor (private readonly rhPerfilService: RhPerfilService) {}

  // Precisa vir antes de ":usuarioId" — senão o Nest trata "me" como um id.
  @Get('me')
  buscarMeuPerfil (@CurrentUser() solicitante: UsuarioAutenticado) {
    return this.rhPerfilService.buscarPorUsuarioId(solicitante.id, solicitante)
  }

  // Também precisa vir antes de ":usuarioId", mesmo motivo do "me" acima.
  // Sem RolesGuard: qualquer funcionário autenticado pode ver a árvore
  // completa (só nome/cargo, nunca dado sensível).
  @Get('organograma')
  buscarOrganograma () {
    return this.rhPerfilService.buscarOrganograma()
  }

  // Também precisa vir antes de ":usuarioId". Só rh/admin — é quem abre o
  // modal "Dados de RH" e usa isso pra popular o <select> de cargo.
  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Get('cargos')
  listarCargos () {
    return this.rhPerfilService.listarCargos()
  }

  @Get(':usuarioId')
  buscarPorUsuarioId (@Param('usuarioId') usuarioId: string, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.rhPerfilService.buscarPorUsuarioId(usuarioId, solicitante)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Patch(':usuarioId')
  definir (
    @Param('usuarioId') usuarioId: string,
    @Body() dto: DefinirPerfilRhDto,
    @CurrentUser() solicitante: UsuarioAutenticado
  ) {
    return this.rhPerfilService.definir(usuarioId, dto, solicitante)
  }
}
