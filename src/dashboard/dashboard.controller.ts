import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { DashboardService } from './dashboard.service'

// Não é admin-only: o painel principal é a tela inicial de qualquer
// funcionário autenticado (ver index.html).
@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('dashboard')
export class DashboardController {
  constructor (private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  kpis (@Query('tipo') tipo?: string) {
    return this.dashboardService.calcularKpis(tipo)
  }

  @Get('ranking-vagas')
  rankingVagas () {
    return this.dashboardService.calcularRankingVagas()
  }
}
