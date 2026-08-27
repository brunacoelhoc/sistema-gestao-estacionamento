import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { MetricasService } from './metricas.service'

// Métricas expõe receita/KPIs agregados do estacionamento inteiro — por
// isso é restrito a admin e financeiro (ver guarda de rota em
// views/metricas.html). O cálculo roda inteiro aqui: o front nunca recebe a
// lista crua de tickets/mensalidades/mensalistas/vagas pra essa tela.
@UseGuards(JwtAuthGuard, ProfileCompleteGuard, RolesGuard)
@Roles('admin', 'financeiro')
@Controller('metricas')
export class MetricasController {
  constructor (private readonly metricasService: MetricasService) {}

  @Get()
  obter (@Query('periodo') periodo?: string) {
    return this.metricasService.calcular(periodo)
  }
}
