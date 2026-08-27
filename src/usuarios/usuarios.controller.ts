import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { AdminGuard } from '../common/guards/admin.guard'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto'
import { CriarUsuarioDto } from './dto/criar-usuario.dto'
import { UsuariosService } from './usuarios.service'

@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor (private readonly usuariosService: UsuariosService) {}

  // Listagem também aberta a RH e gestor (RolesGuard, não o AdminGuard fixo
  // usado no resto do controller): RH precisa enxergar os funcionários pra
  // vincular perfil de RH, justificativas de ponto, férias e folha de
  // pagamento; gestor precisa pra gerenciamento e relatório de desempenho
  // (nunca vê dado de RH em si — isso continua restrito a admin/rh, ver
  // ehGestaoDeRh).
  @UseGuards(RolesGuard)
  @Roles('admin', 'rh', 'gestor')
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

  // Sem AdminGuard de propósito: é a rota também usada pelo modal "Meu
  // Perfil", onde qualquer funcionário edita a própria conta. Quem decide se
  // o solicitante pode editar o alvo (ele mesmo, ou é admin) é o service —
  // ver a checagem em UsuariosService.atualizarPerfil.
  @Patch(':id')
  atualizar (
    @Param('id') id: string,
    @Body() dto: AtualizarUsuarioDto,
    @CurrentUser() solicitante: UsuarioAutenticado
  ) {
    return this.usuariosService.atualizarPerfil(id, dto, solicitante)
  }
}
