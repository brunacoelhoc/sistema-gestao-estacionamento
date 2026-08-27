import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma'
import { PrismaService } from '../prisma/prisma.service'

export interface CriarNotificacaoParams {
  usuarioId: string
  tipo: Prisma.NotificacaoCreateInput['tipo']
  titulo: string
  mensagem: string
  folhaPontoId?: string
  holeriteId?: string
  contratoId?: string
}

@Injectable()
export class NotificacoesService {
  constructor (private readonly prisma: PrismaService) {}

  // Sem endpoint HTTP público — só outros services do módulo de RH chamam
  // isto (ex.: ao gerar um espelho de ponto ou holerite, mais adiante), nunca
  // o próprio usuário. Por isso não há checagem de permissão aqui: quem
  // decide se pode notificar é quem chama.
  async criar (params: CriarNotificacaoParams) {
    return await this.prisma.notificacao.create({
      data: {
        usuarioId: params.usuarioId,
        tipo: params.tipo,
        titulo: params.titulo,
        mensagem: params.mensagem,
        folhaPontoId: params.folhaPontoId,
        holeriteId: params.holeriteId,
        contratoId: params.contratoId
      }
    })
  }

  async listarMinhas (usuarioId: string) {
    return await this.prisma.notificacao.findMany({
      where: { usuarioId },
      // Inclui o status atual do documento vinculado (ex.: já assinado?) —
      // sem isso o front não sabe se deve oferecer "assinar" ou "baixar".
      include: {
        folhaPonto: { select: { status: true } },
        holerite: { select: { status: true } },
        contrato: { select: { status: true } }
      },
      orderBy: { criadoEm: 'desc' }
    })
  }

  async marcarComoLida (id: string, usuarioId: string) {
    const notificacao = await this.prisma.notificacao.findUnique({ where: { id } })
    if (!notificacao) {
      throw new NotFoundException('Notificação não encontrada.')
    }
    if (notificacao.usuarioId !== usuarioId) {
      throw new ForbiddenException('Esta notificação não é sua.')
    }
    if (notificacao.lida) {
      return notificacao
    }

    return await this.prisma.notificacao.update({
      where: { id },
      data: { lida: true, lidaEm: new Date() }
    })
  }
}
