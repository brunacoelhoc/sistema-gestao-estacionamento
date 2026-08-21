import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { EventoDto } from './dto/registrar-eventos.dto'

@Injectable()
export class AnalyticsService {
  constructor (private readonly prisma: PrismaService) {}

  registrarEventos (eventos: EventoDto[]) {
    return this.prisma.eventoUso.createMany({
      data: eventos.map(e => ({
        tipo: e.tipo,
        tela: e.tela,
        duracaoMs: e.duracaoMs ?? null,
        criadoEm: new Date(e.quando)
      }))
    })
  }
}
