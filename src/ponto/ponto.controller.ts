import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { PontoCalculoService } from './ponto-calculo.service'
import { PontoService } from './ponto.service'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('ponto')
export class PontoController {
  constructor (
    private readonly pontoService: PontoService,
    private readonly pontoCalculoService: PontoCalculoService
  ) {}

  @Post('entrada')
  registrarEntrada (@CurrentUser() solicitante: UsuarioAutenticado) {
    return this.pontoService.registrarEntrada(solicitante.id)
  }

  @Post('saida')
  registrarSaida (@CurrentUser() solicitante: UsuarioAutenticado) {
    return this.pontoService.registrarSaida(solicitante.id)
  }

  @Get()
  listar (
    @CurrentUser() solicitante: UsuarioAutenticado,
    @Query('usuarioId') usuarioId?: string,
    @Query('referencia') referencia?: string
  ) {
    return this.pontoService.listar(usuarioId || solicitante.id, solicitante, referencia)
  }

  // Resumo mensal calculado (horas normais/extras/fora de escala, faltas) —
  // usado tanto pela tela de ponto do próprio funcionário quanto, mais
  // adiante, pelo espelho de ponto e pela folha de pagamento.
  @Get('resumo')
  resumo (
    @CurrentUser() solicitante: UsuarioAutenticado,
    @Query('referencia') referencia: string,
    @Query('usuarioId') usuarioId?: string
  ) {
    return this.pontoCalculoService.resumoMes(usuarioId || solicitante.id, referencia, solicitante)
  }
}
