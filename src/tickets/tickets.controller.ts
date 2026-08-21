import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard'
import { AbrirTicketDto } from './dto/abrir-ticket.dto'
import { FecharTicketDto } from './dto/fechar-ticket.dto'
import { TicketsService } from './tickets.service'

@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
@Controller('tickets')
export class TicketsController {
  constructor (private readonly ticketsService: TicketsService) {}

  @Get()
  listar (
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('termo') termo?: string
  ) {
    if (!page) {
      return this.ticketsService.listar({ status, termo })
    }

    const paginaNum = Math.max(1, Number(page) || 1)
    const tamanho = Math.min(100, Math.max(1, Number(pageSize) || 10))

    return this.ticketsService.listar({ status, termo }, { skip: (paginaNum - 1) * tamanho, take: tamanho })
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  abrir (@Body() dto: AbrirTicketDto) {
    return this.ticketsService.abrir(dto)
  }

  @Post(':id/fechar')
  fechar (@Param('id') id: string, @Body() dto: FecharTicketDto) {
    return this.ticketsService.fechar(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover (@Param('id') id: string) {
    await this.ticketsService.remover(id)
  }
}
