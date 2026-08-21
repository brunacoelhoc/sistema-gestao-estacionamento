import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { AtualizarMensalistaDto } from './dto/atualizar-mensalista.dto'
import { CriarMensalistaDto } from './dto/criar-mensalista.dto'
import { MensalistasService } from './mensalistas.service'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('mensalistas')
export class MensalistasController {
  constructor (private readonly mensalistasService: MensalistasService) {}

  @Get()
  listar () {
    return this.mensalistasService.listarTodos()
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  criar (@Body() dto: CriarMensalistaDto) {
    return this.mensalistasService.criar(dto)
  }

  @Patch(':id')
  atualizar (@Param('id') id: string, @Body() dto: AtualizarMensalistaDto) {
    return this.mensalistasService.atualizar(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover (@Param('id') id: string) {
    await this.mensalistasService.remover(id)
  }
}
