import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { AtualizarMensalidadeDto } from './dto/atualizar-mensalidade.dto'
import { MensalidadesService } from './mensalidades.service'

// Não é restrito por padrão: além da tela de Faturamento, estes endpoints
// também são usados pela saída de tickets de mensalistas (cálculo do ciclo
// em Tickets) e pelo histórico de cobranças no modal de Mensalistas — ambos
// acessíveis a funcionários comuns. Só a listagem SEM mensalistaId (o livro
// financeiro completo, usado pela tela de Faturamento) é restrita a
// admin/financeiro — ver checagem em `listar` abaixo.
@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('mensalidades')
export class MensalidadesController {
  constructor (private readonly mensalidadesService: MensalidadesService) {}

  // KPIs agregados de todo o faturamento (MRR, recebido no mês, ticket
  // médio, sem ciclo ativo) — mesmo padrão restrito de MetricasController.
  @UseGuards(RolesGuard)
  @Roles('admin', 'financeiro')
  @Get('kpis')
  kpis () {
    return this.mensalidadesService.calcularKpis()
  }

  @Get()
  listar (
    @Query('mensalistaId') mensalistaId: string | undefined,
    @CurrentUser() usuario: UsuarioAutenticado
  ) {
    if (!mensalistaId && !['admin', 'financeiro'].includes(usuario.role)) {
      throw new ForbiddenException('Acesso restrito a administradores e financeiro.')
    }
    return this.mensalidadesService.listar(mensalistaId)
  }

  @Patch(':id')
  atualizar (
    @Param('id') id: string,
    @Body() dto: AtualizarMensalidadeDto,
    @CurrentUser() usuario: UsuarioAutenticado
  ) {
    return this.mensalidadesService.atualizar(id, dto, usuario.id)
  }

  @Post(':id/lembrete')
  @HttpCode(HttpStatus.OK)
  enviarLembrete (@Param('id') id: string) {
    return this.mensalidadesService.enviarLembrete(id)
  }
}
