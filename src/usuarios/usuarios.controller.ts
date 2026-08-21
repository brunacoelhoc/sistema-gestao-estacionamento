import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { AdminGuard } from '../common/guards/admin.guard'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto'
import { CriarUsuarioDto } from './dto/criar-usuario.dto'
import { UsuariosService } from './usuarios.service'

@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor (private readonly usuariosService: UsuariosService) {}

  @UseGuards(AdminGuard)
  @Get()
  listar () {
    return this.usuariosService.listar()
  }

  // Precisa vir antes de ":id" — senão o Nest trata "verificar-cpf" como um id.
  @UseGuards(AdminGuard)
  @Get('verificar-cpf')
  async verificarCpf (@Query('cpf') cpf: string, @Query('excluirId') excluirId?: string) {
    const duplicado = await this.usuariosService.existeCpfDuplicado(cpf, excluirId)
    return { duplicado }
  }

  @UseGuards(AdminGuard)
  @Get(':id')
  buscarPorId (@Param('id') id: string) {
    return this.usuariosService.buscarPorId(id)
  }

  @UseGuards(AdminGuard)
  @Post()
  criar (@Body() dto: CriarUsuarioDto) {
    return this.usuariosService.criarFuncionario(dto)
  }

  @Patch(':id')
  atualizar (
    @Param('id') id: string,
    @Body() dto: AtualizarUsuarioDto,
    @CurrentUser() solicitante: UsuarioAutenticado
  ) {
    return this.usuariosService.atualizarPerfil(id, dto, solicitante)
  }
}
