import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { AtualizarTarifaDto } from './dto/atualizar-tarifa.dto'
import { CriarTarifaDto } from './dto/criar-tarifa.dto'
import { TarifasService } from './tarifas.service'

// Sem AdminGuard: diferente de Usuários/Métricas, o cadastro de tarifas é
// operação do dia a dia (é usado ao abrir ticket — ver TicketsService.abrir)
// e fica liberado pra qualquer funcionário autenticado com perfil completo.
@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('tarifas')
export class TarifasController {
  constructor (private readonly tarifasService: TarifasService) {}

  @Get()
  listar () {
    return this.tarifasService.listarTodas()
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  criar (@Body() dto: CriarTarifaDto) {
    return this.tarifasService.criar(dto)
  }

  @Patch(':id')
  atualizar (@Param('id') id: string, @Body() dto: AtualizarTarifaDto) {
    return this.tarifasService.atualizar(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover (@Param('id') id: string) {
    await this.tarifasService.remover(id)
  }
}
