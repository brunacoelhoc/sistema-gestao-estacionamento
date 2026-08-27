import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { AssinaturaEletronicaService } from './assinatura-eletronica.service'
import { CadastrarAssinaturaDto } from './dto/cadastrar-assinatura.dto'

// Só rotas "me" — assinatura eletrônica é sempre a do próprio usuário
// logado, nunca gerenciada por terceiros (nem RH/admin cadastram por ele).
@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('assinatura-eletronica')
export class AssinaturaEletronicaController {
  constructor (private readonly assinaturaEletronicaService: AssinaturaEletronicaService) {}

  @Get('me')
  buscarMinha (@CurrentUser() solicitante: UsuarioAutenticado) {
    return this.assinaturaEletronicaService.buscarMinha(solicitante.id)
  }

  @Post('me')
  @HttpCode(HttpStatus.CREATED)
  cadastrar (@Body() dto: CadastrarAssinaturaDto, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.assinaturaEletronicaService.cadastrar(solicitante.id, dto)
  }
}
