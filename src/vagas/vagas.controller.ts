import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { AtualizarVagaDto } from './dto/atualizar-vaga.dto'
import { CriarVagaDto } from './dto/criar-vaga.dto'
import { VagasService } from './vagas.service'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('vagas')
export class VagasController {
  constructor (private readonly vagasService: VagasService) {}

  @Get()
  listar () {
    return this.vagasService.listarTodas()
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  criar (@Body() dto: CriarVagaDto) {
    return this.vagasService.criar(dto)
  }

  @Patch(':id')
  atualizar (@Param('id') id: string, @Body() dto: AtualizarVagaDto) {
    return this.vagasService.atualizar(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover (@Param('id') id: string) {
    await this.vagasService.remover(id)
  }
}
