import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { ContratoTrabalhoService } from './contrato-trabalho.service'
import { GerarContratoTrabalhoDto } from './dto/gerar-contrato-trabalho.dto'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('contrato-trabalho')
export class ContratoTrabalhoController {
  constructor (private readonly contratoTrabalhoService: ContratoTrabalhoService) {}

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Post('gerar')
  @HttpCode(HttpStatus.CREATED)
  gerar (@Body() dto: GerarContratoTrabalhoDto, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.contratoTrabalhoService.gerar(dto, solicitante)
  }

  @Get()
  listar (@CurrentUser() solicitante: UsuarioAutenticado, @Query('usuarioId') usuarioId?: string) {
    return this.contratoTrabalhoService.listar(solicitante, usuarioId)
  }

  @Post(':id/assinar')
  assinar (@Param('id') id: string, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.contratoTrabalhoService.assinar(id, solicitante)
  }

  @Get(':id/pdf')
  async baixarPdf (
    @Param('id') id: string,
    @CurrentUser() solicitante: UsuarioAutenticado,
    @Res() res: Response
  ) {
    const pdf = await this.contratoTrabalhoService.gerarPdf(id, solicitante)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="contrato-de-trabalho.pdf"')
    res.send(pdf)
  }
}
