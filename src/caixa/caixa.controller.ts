import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { CaixaService } from './caixa.service'
import { AbrirCaixaDto } from './dto/abrir-caixa.dto'
import { FecharCaixaDto } from './dto/fechar-caixa.dto'

// Mesmos guards de TicketsController (não restrito por papel): quem registra
// tickets é quem abre/fecha o caixa do dia.
@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('caixa')
export class CaixaController {
  constructor (private readonly caixaService: CaixaService) {}

  @Get('hoje')
  obterStatusHoje () {
    return this.caixaService.obterStatusHoje()
  }

  @Post('abrir')
  @HttpCode(HttpStatus.CREATED)
  abrir (@Body() dto: AbrirCaixaDto, @CurrentUser() usuario: UsuarioAutenticado) {
    return this.caixaService.abrir(dto, usuario.id)
  }

  @Post(':id/fechar')
  fechar (
    @Param('id') id: string,
    @Body() dto: FecharCaixaDto,
    @CurrentUser() usuario: UsuarioAutenticado
  ) {
    return this.caixaService.fechar(id, dto, usuario.id)
  }
}
