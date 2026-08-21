import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AtualizarMensalidadeDto } from './dto/atualizar-mensalidade.dto'

@Injectable()
export class MensalidadesService {
  constructor (private readonly prisma: PrismaService) {}

  listar (mensalistaId?: string) {
    return this.prisma.mensalidade.findMany({
      where: mensalistaId ? { mensalistaId } : undefined,
      orderBy: { referencia: 'desc' },
      include: { mensalista: { select: { nome: true, placa: true } } }
    })
  }

  atualizar (id: string, dto: AtualizarMensalidadeDto) {
    return this.prisma.mensalidade.update({
      where: { id },
      data: { status: dto.status as any, formaPagamento: dto.formaPagamento }
    })
  }
}
