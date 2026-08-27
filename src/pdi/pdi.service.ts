import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { AuditoriaService } from '../auditoria/auditoria.service'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ehGestaoDeRh } from '../common/utils/papel.util'
import { PrismaService } from '../prisma/prisma.service'
import { AtualizarItemPdiDto } from './dto/atualizar-item-pdi.dto'
import { CriarItemPdiDto } from './dto/criar-item-pdi.dto'

@Injectable()
export class PdiService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService
  ) {}

  // Mesma regra de ownership do PerfilRH: só rh/admin veem o PDI de
  // terceiro (é dado que pode embasar negociação de salário/cargo — gestor
  // não entra aqui, mesma lógica de nunca ver salário de terceiro).
  async listarPorUsuario (usuarioId: string, solicitante: UsuarioAutenticado) {
    if (!ehGestaoDeRh(solicitante.role) && solicitante.id !== usuarioId) {
      throw new ForbiddenException('Você só pode ver o seu próprio PDI.')
    }
    return await this.prisma.itemPdi.findMany({ where: { usuarioId }, orderBy: { ordem: 'asc' } })
  }

  async criar (usuarioId: string, dto: CriarItemPdiDto, solicitante: UsuarioAutenticado) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } })
    if (!usuario) {
      throw new NotFoundException('Funcionário não encontrado.')
    }

    const ultimo = await this.prisma.itemPdi.findFirst({ where: { usuarioId }, orderBy: { ordem: 'desc' } })
    const ordem = (ultimo?.ordem ?? 0) + 1

    const item = await this.prisma.itemPdi.create({
      data: {
        usuarioId,
        ordem,
        titulo: dto.titulo,
        descricao: dto.descricao || null,
        criadoPorId: solicitante.id
      }
    })

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: 'pdi.criar',
      entidade: 'ItemPdi',
      entidadeId: item.id,
      dadosDepois: item
    })

    return item
  }

  private async buscarOuFalhar (itemId: string) {
    const item = await this.prisma.itemPdi.findUnique({ where: { id: itemId } })
    if (!item) {
      throw new NotFoundException('Item de PDI não encontrado.')
    }
    return item
  }

  async editar (itemId: string, dto: AtualizarItemPdiDto, solicitante: UsuarioAutenticado) {
    const anterior = await this.buscarOuFalhar(itemId)

    const item = await this.prisma.itemPdi.update({
      where: { id: itemId },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
        ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {})
      }
    })

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: 'pdi.editar',
      entidade: 'ItemPdi',
      entidadeId: item.id,
      dadosAntes: anterior,
      dadosDepois: item
    })

    return item
  }

  async concluir (itemId: string, solicitante: UsuarioAutenticado) {
    const anterior = await this.buscarOuFalhar(itemId)
    if (anterior.status === 'concluido') return anterior

    const item = await this.prisma.itemPdi.update({
      where: { id: itemId },
      data: { status: 'concluido', concluidoEm: new Date() }
    })

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: 'pdi.concluir',
      entidade: 'ItemPdi',
      entidadeId: item.id,
      dadosAntes: anterior,
      dadosDepois: item
    })

    return item
  }

  async reabrir (itemId: string, solicitante: UsuarioAutenticado) {
    const anterior = await this.buscarOuFalhar(itemId)
    if (anterior.status === 'pendente') return anterior

    const item = await this.prisma.itemPdi.update({
      where: { id: itemId },
      data: { status: 'pendente', concluidoEm: null }
    })

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: 'pdi.reabrir',
      entidade: 'ItemPdi',
      entidadeId: item.id,
      dadosAntes: anterior,
      dadosDepois: item
    })

    return item
  }

  // Troca a "ordem" com o vizinho na direção pedida — é o que reordena a
  // linha do tempo exibida ao funcionário. Usa uma ordem temporária negativa
  // no meio da troca pra não colidir com o @@unique([usuarioId, ordem]).
  async mover (itemId: string, direcao: 'cima' | 'baixo', solicitante: UsuarioAutenticado) {
    const atual = await this.buscarOuFalhar(itemId)

    const vizinho = await this.prisma.itemPdi.findFirst({
      where: {
        usuarioId: atual.usuarioId,
        ordem: direcao === 'cima' ? { lt: atual.ordem } : { gt: atual.ordem }
      },
      orderBy: { ordem: direcao === 'cima' ? 'desc' : 'asc' }
    })
    if (!vizinho) return atual

    const ordemAntes = atual.ordem
    await this.prisma.$transaction(async tx => {
      await tx.itemPdi.update({ where: { id: atual.id }, data: { ordem: -1 } })
      await tx.itemPdi.update({ where: { id: vizinho.id }, data: { ordem: ordemAntes } })
      await tx.itemPdi.update({ where: { id: atual.id }, data: { ordem: vizinho.ordem } })
    })

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: 'pdi.mover',
      entidade: 'ItemPdi',
      entidadeId: atual.id,
      dadosAntes: { ordem: ordemAntes },
      dadosDepois: { ordem: vizinho.ordem }
    })

    return await this.prisma.itemPdi.findUnique({ where: { id: atual.id } })
  }

  async remover (itemId: string, solicitante: UsuarioAutenticado) {
    const anterior = await this.buscarOuFalhar(itemId)
    await this.prisma.itemPdi.delete({ where: { id: itemId } })

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: 'pdi.remover',
      entidade: 'ItemPdi',
      entidadeId: itemId,
      dadosAntes: anterior
    })
  }
}
