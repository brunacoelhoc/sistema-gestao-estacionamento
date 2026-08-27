import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { JwtAuthGuard, type UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { GerarHoleriteDto } from './dto/gerar-holerite.dto'
import { FolhaPagamentoService } from './folha-pagamento.service'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('folha-pagamento')
export class FolhaPagamentoController {
  constructor (private readonly folhaPagamentoService: FolhaPagamentoService) {}

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Post('gerar')
  @HttpCode(HttpStatus.CREATED)
  gerar (@Body() dto: GerarHoleriteDto, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.folhaPagamentoService.gerar(dto, solicitante)
  }

  @Get()
  listar (@CurrentUser() solicitante: UsuarioAutenticado, @Query('usuarioId') usuarioId?: string) {
    return this.folhaPagamentoService.listar(solicitante, usuarioId)
  }

  @Post(':id/assinar')
  assinar (@Param('id') id: string, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.folhaPagamentoService.assinar(id, solicitante)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'rh')
  @Post(':id/pagar')
  pagar (@Param('id') id: string, @CurrentUser() solicitante: UsuarioAutenticado) {
    return this.folhaPagamentoService.pagar(id, solicitante)
  }

  @Get(':id/pdf')
  async baixarPdf (
    @Param('id') id: string,
    @CurrentUser() solicitante: UsuarioAutenticado,
    @Res() res: Response
  ) {
    const pdf = await this.folhaPagamentoService.gerarPdf(id, solicitante)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="holerite.pdf"')
    res.send(pdf)
  }
}
