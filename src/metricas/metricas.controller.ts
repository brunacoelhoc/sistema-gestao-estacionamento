import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AdminGuard } from '../common/guards/admin.guard'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { MetricasService } from './metricas.service'

// Métricas expõe receita/KPIs agregados do estacionamento inteiro — por
// isso é admin-only (ver guarda de rota em views/metricas.html). O cálculo
// roda inteiro aqui: o front nunca recebe a lista crua de tickets/
// mensalidades/mensalistas/vagas pra essa tela.
@UseGuards(JwtAuthGuard, ProfileCompleteGuard, AdminGuard)
@Controller('metricas')
export class MetricasController {
  constructor (private readonly metricasService: MetricasService) {}

  @Get()
  obter (@Query('periodo') periodo?: string) {
    return this.metricasService.calcular(periodo)
  }
}
