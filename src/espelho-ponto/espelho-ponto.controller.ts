import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { GerarEspelhoPontoDto } from './dto/gerar-espelho-ponto.dto'
import { EspelhoPontoService } from './espelho-ponto.service'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('espelho-ponto')
export class EspelhoPontoController {
  constructor (private readonly espelhoPontoService: EspelhoPontoService) {}

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Post('gerar')
  @HttpCode(HttpStatus.CREATED)
  gerar (@Body() dto: GerarEspelhoPontoDto, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.espelhoPontoService.gerar(dto, solicitante)
  }

  @Get()
  listar (@CurrentUser() solicitante: UsuarioAutenticado, @Query('usuarioId') usuarioId?: string) {
    return this.espelhoPontoService.listar(solicitante, usuarioId)
  }

  @Post(':id/assinar')
  assinar (@Param('id') id: string, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.espelhoPontoService.assinar(id, solicitante)
  }

  @Get(':id/pdf')
  async baixarPdf (
    @Param('id') id: string,
    @CurrentUser() solicitante: UsuarioAutenticado,
    @Res() res: Response
  ) {
    const pdf = await this.espelhoPontoService.gerarPdf(id, solicitante)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="espelho-de-ponto.pdf"')
    res.send(pdf)
  }
}
