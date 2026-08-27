import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { AuditoriaService } from '../auditoria/auditoria.service'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ehGestaoDeRh } from '../common/utils/papel.util'
import { PrismaService } from '../prisma/prisma.service'
import { DefinirPerfilRhDto } from './dto/definir-perfil-rh.dto'

export interface NoOrganograma {
  usuarioId: string
  nome: string
  cargo: string
  role: string
  filhos: NoOrganograma[]
}

@Injectable()
export class RhPerfilService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService
  ) {}

  // Só rh/admin enxergam perfil de terceiro (inclui salário) — qualquer
  // outro papel (funcionário, gestor) só o próprio. Mesmo padrão de "guard
  // grosso na rota + checagem fina no service" já usado em UsuariosService.
  async buscarPorUsuarioId (usuarioId: string, solicitante: UsuarioAutenticado) {
    if (!ehGestaoDeRh(solicitante.role) && solicitante.id !== usuarioId) {
      throw new ForbiddenException('Você só pode ver o seu próprio perfil de RH.')
    }
    return await this.prisma.perfilRH.findUnique({
      where: { usuarioId },
      include: {
        gestor: { select: { id: true, nome: true, role: true, perfilRH: { select: { cargo: true } } } }
      }
    })
  }

  // Catálogo de cargos já usados (pra popular o <select> de "Cargo" no
  // modal "Dados de RH" e evitar variações de escrita do mesmo cargo). Pra
  // cada cargo distinto, devolve a vagaOrigem do registro mais antigo
  // (criadoEm asc) — assim, ao reaproveitar um cargo já cadastrado, o RH
  // reaproveita a mesma vaga/processo seletivo que originou o cargo da
  // primeira vez, em vez de digitar de novo (e possivelmente divergente).
  async listarCargos () {
    const perfis = await this.prisma.perfilRH.findMany({
      select: { cargo: true, vagaOrigem: true, criadoEm: true },
      orderBy: { criadoEm: 'asc' }
    })

    const porCargo = new Map<string, string | null>()
    for (const perfil of perfis) {
      if (!porCargo.has(perfil.cargo)) {
        porCargo.set(perfil.cargo, perfil.vagaOrigem)
      }
    }

    return Array.from(porCargo.entries())
      .map(([cargo, vagaOrigem]) => ({ cargo, vagaOrigem }))
      .sort((a, b) => a.cargo.localeCompare(b.cargo, 'pt-BR', { sensitivity: 'base' }))
  }

  // Upsert: RH sempre reenvia o perfil inteiro (ver DefinirPerfilRhDto). Toda
  // escrita é auditada — quem define/edita dado de RH de terceiro é
  // justamente o que a trilha de auditoria (LogAuditoria) precisa cobrir.
  async definir (usuarioId: string, dto: DefinirPerfilRhDto, solicitante: UsuarioAutenticado) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } })
    if (!usuario) {
      throw new NotFoundException('Funcionário não encontrado.')
    }

    const anterior = await this.prisma.perfilRH.findUnique({ where: { usuarioId } })

    if (dto.gestorId) {
      if (dto.gestorId === usuarioId) {
        throw new ForbiddenException('Um funcionário não pode ser o próprio gestor.')
      }
      const gestor = await this.prisma.usuario.findUnique({ where: { id: dto.gestorId } })
      if (!gestor) {
        throw new NotFoundException('Gestor informado não encontrado.')
      }
    }

    const dados = {
      cargo: dto.cargo,
      salarioBase: dto.salarioBase,
      tipoContrato: (dto.tipoContrato as 'clt' | 'pj' | undefined) || 'clt',
      dataAdmissao: new Date(dto.dataAdmissao),
      dataDemissao: dto.dataDemissao ? new Date(dto.dataDemissao) : null,
      diasEscala: dto.diasEscala,
      horasPorDia: dto.horasPorDia ?? 6,
      horaInicioEscala: dto.horaInicioEscala || '08:00',
      bancoNome: dto.bancoNome,
      agencia: dto.agencia,
      contaBancaria: dto.contaBancaria,
      direitos: dto.direitos || null,
      deveres: dto.deveres || null,
      tarefas: dto.tarefas || null,
      tipoValeTransporte: (dto.tipoValeTransporte as 'vale_transporte' | 'vale_combustivel' | 'nenhum' | undefined) || 'nenhum',
      bonusDesempenho: dto.bonusDesempenho ?? null,
      observacoesBeneficios: dto.observacoesBeneficios || null,
      vagaOrigem: dto.vagaOrigem || null,
      gestorId: dto.gestorId || null,
      etapaCarreiraAtualId: dto.etapaCarreiraAtualId || null
    }

    const perfil = await this.prisma.perfilRH.upsert({
      where: { usuarioId },
      create: { usuarioId, ...dados },
      update: dados
    })

    await this.auditoriaService.registrar({
      usuarioId: solicitante.id,
      papel: solicitante.role,
      acao: anterior ? 'perfil-rh.editar' : 'perfil-rh.criar',
      entidade: 'PerfilRH',
      entidadeId: perfil.id,
      dadosAntes: anterior
        ? { ...anterior, salarioBase: anterior.salarioBase.toString(), bonusDesempenho: anterior.bonusDesempenho?.toString() ?? null }
        : null,
      dadosDepois: { ...perfil, salarioBase: perfil.salarioBase.toString(), bonusDesempenho: perfil.bonusDesempenho?.toString() ?? null }
    })

    return perfil
  }

  // Árvore completa da empresa (nome + cargo, nunca salário/dados bancários)
  // — qualquer funcionário autenticado pode ver, ao contrário de
  // buscarPorUsuarioId (que exige ser dono ou rh/admin). Montada em memória
  // a partir de PerfilRH.gestorId; ciclos e gestores "órfãos" (gestorId
  // apontando pra alguém sem PerfilRH) viram raiz em vez de quebrar a árvore.
  async buscarOrganograma (): Promise<NoOrganograma[]> {
    const perfis = await this.prisma.perfilRH.findMany({
      select: {
        usuarioId: true,
        cargo: true,
        gestorId: true,
        usuario: { select: { nome: true, role: true } }
      }
    })

    const porId = new Map<string, NoOrganograma>(
      perfis.map(p => [p.usuarioId, { usuarioId: p.usuarioId, nome: p.usuario.nome, cargo: p.cargo, role: p.usuario.role, filhos: [] }])
    )
    const gestorIdPorUsuario = new Map(perfis.map(p => [p.usuarioId, p.gestorId]))

    const fazParteDeCiclo = (usuarioId: string): boolean => {
      const visitados = new Set<string>()
      let atualId = gestorIdPorUsuario.get(usuarioId)
      while (atualId) {
        if (atualId === usuarioId || visitados.has(atualId)) return true
        if (!porId.has(atualId)) return false
        visitados.add(atualId)
        atualId = gestorIdPorUsuario.get(atualId)
      }
      return false
    }

    const raizes: NoOrganograma[] = []
    for (const [usuarioId, no] of porId) {
      const gestorId = gestorIdPorUsuario.get(usuarioId)
      const gestorValido = gestorId && porId.has(gestorId) && !fazParteDeCiclo(usuarioId)
      if (gestorValido) {
        porId.get(gestorId as string)!.filhos.push(no)
      } else {
        raizes.push(no)
      }
    }
    return raizes
  }
}
