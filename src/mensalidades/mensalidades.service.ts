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
      include: {
        mensalista: { select: { nome: true, placa: true, categoriaPlano: true } },
        alteradoPor: { select: { nome: true } }
      }
    })
  }

  // usuarioId vem do token de quem chamou o PATCH — sempre um operador
  // agindo na tela de Faturamento (marcar como paga / cancelar), nunca a
  // cobrança automática do fechamento de ticket, que não passa por aqui.
  atualizar (id: string, dto: AtualizarMensalidadeDto, usuarioId: string) {
    return this.prisma.mensalidade.update({
      where: { id },
      data: {
        status: dto.status as any,
        formaPagamento: dto.formaPagamento,
        // Só grava motivo quando o status realmente é cancelada — evita que
        // um motivo antigo "vaze" de volta caso a mesma linha seja
        // reaproveitada por engano numa chamada futura sem o campo.
        motivoCancelamento: dto.status === 'cancelada' ? dto.motivoCancelamento : null,
        alteradoPorId: usuarioId,
        alteradoEm: new Date()
      }
    })
  }
}
