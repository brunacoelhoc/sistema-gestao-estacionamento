import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { AuditoriaService } from './auditoria.service'

// Antes só admin acessava ("RH é fiscalizado, não fiscaliza a si mesmo").
// Decisão de produto: RH passa a enxergar a trilha de auditoria também
// (inclusive ações do próprio RH) — mesmo padrão RolesGuard/@Roles já usado
// no resto do módulo de RH (rh-perfil, pdi, folha-pagamento etc.).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'rh')
@Controller('auditoria')
export class AuditoriaController {
  constructor (private readonly auditoriaService: AuditoriaService) {}

  @Get()
  listar (
    @Query('entidade') entidade?: string,
    @Query('entidadeId') entidadeId?: string,
    @Query('usuarioId') usuarioId?: string
  ) {
    return this.auditoriaService.listar({ entidade, entidadeId, usuarioId })
  }
}
