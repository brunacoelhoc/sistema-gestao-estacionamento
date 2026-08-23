import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { AdminGuard } from '../common/guards/admin.guard'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { AtualizarMensalidadeDto } from './dto/atualizar-mensalidade.dto'
import { MensalidadesService } from './mensalidades.service'

// Não é admin-only: além da tela de Faturamento, estes endpoints também são
// usados pela saída de tickets de mensalistas (cálculo do ciclo em
// Tickets) e pelo histórico de cobranças no modal de Mensalistas — ambos
// acessíveis a funcionários comuns. Só a listagem SEM mensalistaId (o livro
// financeiro completo, usado pela tela de Faturamento) é admin-only — ver
// checagem em `listar` abaixo.
@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('mensalidades')
export class MensalidadesController {
  constructor (private readonly mensalidadesService: MensalidadesService) {}

  // KPIs agregados de todo o faturamento (MRR, recebido no mês, ticket
  // médio, sem ciclo ativo) — admin-only, mesmo padrão de MetricasController.
  @UseGuards(AdminGuard)
  @Get('kpis')
  kpis () {
    return this.mensalidadesService.calcularKpis()
  }

  @Get()
  listar (
    @Query('mensalistaId') mensalistaId: string | undefined,
    @CurrentUser() usuario: UsuarioAutenticado
  ) {
    if (!mensalistaId && usuario.role !== 'admin') {
      throw new ForbiddenException('Acesso restrito a administradores.')
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
