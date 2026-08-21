import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EmailService } from '../email/email.service'
import { PrismaService } from '../prisma/prisma.service'
import { AtualizarMensalidadeDto } from './dto/atualizar-mensalidade.dto'

@Injectable()
export class MensalidadesService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  listar (mensalistaId?: string) {
    return this.prisma.mensalidade.findMany({
      where: mensalistaId ? { mensalistaId } : undefined,
      orderBy: { referencia: 'desc' },
      include: {
        mensalista: { select: { nome: true, placa: true, categoriaPlano: true, email: true } },
        alteradoPor: { select: { nome: true } }
      }
    })
  }

  buscarPorId (id: string) {
    return this.prisma.mensalidade.findUnique({
      where: { id },
      include: { mensalista: true }
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
        alteradoEm: new Date(),
        // Só mexe no anexo se um novo vier junto — não apaga um comprovante
        // já anexado antes só porque essa chamada específica não reenviou um.
        ...(dto.comprovanteAnexo !== undefined ? { comprovanteAnexo: dto.comprovanteAnexo } : {}),
        ...(dto.comprovanteNomeArquivo !== undefined ? { comprovanteNomeArquivo: dto.comprovanteNomeArquivo } : {})
      }
    })
  }

  async enviarLembrete (id: string) {
    const mensalidade = await this.buscarPorId(id)
    if (!mensalidade) {
      throw new NotFoundException('Cobrança não encontrada.')
    }
    if (!mensalidade.mensalista.email) {
      throw new BadRequestException('Este mensalista não tem e-mail cadastrado.')
    }

    await this.emailService.enviarEmailLembreteCobranca({
      to: mensalidade.mensalista.email,
      nome: mensalidade.mensalista.nome,
      valor: Number(mensalidade.valor).toFixed(2).replace('.', ','),
      dataFim: mensalidade.dataFim.toLocaleDateString('pt-BR')
    })

    return { enviado: true }
  }
}
