import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EmailService } from '../email/email.service'
import { PrismaService } from '../prisma/prisma.service'
import { AtualizarMensalidadeDto } from './dto/atualizar-mensalidade.dto'

// Referência do mês atual no formato "YYYY-MM" — mesma regra usada pelos
// cartões de KPI (ver antiga referenciaAtual() em faturamento.js).
function referenciaAtual (agora: Date): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
}

@Injectable()
export class MensalidadesService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  /**
   * KPIs da tela de Faturamento (MRR previsto, recebido no mês, ticket
   * médio, mensalistas sem ciclo ativo) calculados aqui — o front nunca
   * mais precisa baixar a lista crua de mensalistas/mensalidades só pra
   * somar esses números (ver mesmo padrão em MetricasService.calcular).
   */
  async calcularKpis () {
    const agora = new Date()
    const referencia = referenciaAtual(agora)

    const [mensalistas, mensalidades] = await Promise.all([
      this.prisma.mensalista.findMany({
        select: { id: true, nome: true, placa: true, ativo: true, valorMensalidade: true }
      }),
      this.prisma.mensalidade.findMany({
        select: { mensalistaId: true, status: true, referencia: true, valor: true, dataFim: true }
      })
    ])

    const mensalistasAtivos = mensalistas.filter(m => m.ativo)

    // Faturamento Previsto (MRR): soma do valor do plano de todo mensalista
    // ativo — é o que se espera arrecadar por ciclo se todos passarem pela
    // cancela dentro do período, não uma cobrança já lançada.
    const mrr = mensalistasAtivos.reduce((soma, m) => soma + Number(m.valorMensalidade || 0), 0)

    // Faturamento Realizado: ciclos efetivamente pagos cujo início caiu no
    // mês corrente — comparar com o MRR acima mostra quanto do previsto já
    // veio a caixa neste mês.
    const mensalidadesPagasNoMes = mensalidades.filter(
      mv => mv.status === 'paga' && mv.referencia === referencia
    )
    const recebidoNoMes = mensalidadesPagasNoMes.reduce((soma, mv) => soma + Number(mv.valor || 0), 0)

    const ticketMedio = mensalistasAtivos.length > 0 ? mrr / mensalistasAtivos.length : 0

    // "Sem Ciclo Ativo": mensalista ativo cujo último ciclo pago (se algum)
    // já venceu, ou que nunca chegou a pagar um primeiro ciclo — não é
    // "inadimplência" no sentido de atraso (a cobrança só acontece quando ele
    // aparece, ver MensalidadeCicloService), mas sinaliza quem está sem
    // cobertura vigente agora.
    const semCicloLista = mensalistasAtivos.filter(m => {
      const ciclosDoMensalista = mensalidades.filter(
        mv => mv.mensalistaId === m.id && mv.status === 'paga'
      )
      if (ciclosDoMensalista.length === 0) return true
      return !ciclosDoMensalista.some(mv => mv.dataFim && mv.dataFim >= agora)
    })

    return {
      referencia,
      mrr,
      recebidoNoMes,
      recebidoNoMesQtd: mensalidadesPagasNoMes.length,
      ticketMedio,
      mensalistasAtivosQtd: mensalistasAtivos.length,
      semCicloAtivo: semCicloLista.length,
      semCicloLista: semCicloLista.map(m => ({ id: m.id, nome: m.nome, placa: m.placa }))
    }
  }

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
