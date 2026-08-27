import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { DesempenhoService } from './desempenho.service'

// Só admin/rh/gestor — desempenho é dado de gestão sobre terceiros, nunca
// visível pro funcionário comum.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'rh', 'gestor')
@Controller('desempenho')
export class DesempenhoController {
  constructor (private readonly desempenhoService: DesempenhoService) {}

  @Get()
  relatorio (@Query('referencia') referencia?: string) {
    return this.desempenhoService.relatorio(referencia)
  }
}
