import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma'
import { mascararCpf } from '../common/utils/mascarar-cpf.util'
import { PrismaService } from '../prisma/prisma.service'
import { AtualizarMensalistaDto } from './dto/atualizar-mensalista.dto'
import { CriarMensalistaDto } from './dto/criar-mensalista.dto'

function ehConflitoUnico (erro: unknown): erro is Prisma.PrismaClientKnownRequestError {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002'
}

@Injectable()
export class MensalistasService {
  constructor (private readonly prisma: PrismaService) {}

  // Listagem nunca devolve o CPF completo — só quem abre um registro
  // específico (edição) vê o valor real, via buscarPorId.
  async listarTodos () {
    const mensalistas = await this.prisma.mensalista.findMany()
    return mensalistas.map(m => ({ ...m, cpf: mascararCpf(m.cpf) }))
  }

  buscarPorId (id: string) {
    return this.prisma.mensalista.findUnique({ where: { id } })
  }

  async existeCpfDuplicado (cpf: string, excluirId?: string) {
    const encontrado = await this.prisma.mensalista.findFirst({
      where: { cpf, ...(excluirId ? { id: { not: excluirId } } : {}) }
    })
    return Boolean(encontrado)
  }

  buscarAtivoPorPlaca (placa: string, client: Prisma.TransactionClient | PrismaService = this.prisma) {
    return client.mensalista.findFirst({ where: { placa, ativo: true } })
  }

  // O ciclo de mensalidade (30 dias corridos) não nasce mais aqui: cadastrar
  // ou reativar um mensalista não cobra nada por si só — a cobrança só
  // acontece quando ele de fato estaciona e fecha um ticket sem ter um ciclo
  // vigente (ver TicketsService.fechar e MensalidadeCicloService).
  async criar (dto: CriarMensalistaDto) {
    try {
      return await this.prisma.mensalista.create({
        data: {
          nome: dto.nome,
          cpf: dto.cpf,
          placa: dto.placa,
          telefone: dto.telefone,
          email: dto.email || null,
          valorMensalidade: dto.valorMensalidade || 0,
          categoriaPlano: dto.categoriaPlano || 'Mensal Integral',
          ativo: dto.ativo !== undefined ? dto.ativo : true
        }
      })
    } catch (erro) {
      if (ehConflitoUnico(erro)) {
        const alvo = (erro.meta?.target as string[] | undefined) || []
        const campo = alvo.includes('cpf') ? 'CPF' : 'placa'
        throw new ConflictException(`Já existe um mensalista cadastrado com este ${campo}.`)
      }
      throw erro
    }
  }

  async atualizar (id: string, dto: AtualizarMensalistaDto) {
    const atual = await this.prisma.mensalista.findUnique({ where: { id } })
    if (!atual) {
      throw new NotFoundException('Mensalista não encontrado.')
    }

    const data: Prisma.MensalistaUpdateInput = {}
    if (dto.nome !== undefined) data.nome = dto.nome
    if (dto.cpf !== undefined) data.cpf = dto.cpf
    if (dto.placa !== undefined) data.placa = dto.placa
    if (dto.telefone !== undefined) data.telefone = dto.telefone
    if (dto.email !== undefined) data.email = dto.email
    if (dto.valorMensalidade !== undefined) data.valorMensalidade = dto.valorMensalidade
    if (dto.categoriaPlano !== undefined) data.categoriaPlano = dto.categoriaPlano
    if (dto.ativo !== undefined) data.ativo = dto.ativo

    try {
      return await this.prisma.mensalista.update({ where: { id }, data })
    } catch (erro) {
      if (ehConflitoUnico(erro)) {
        const alvo = (erro.meta?.target as string[] | undefined) || []
        const campo = alvo.includes('cpf') ? 'CPF' : 'placa'
        throw new ConflictException(`Já existe um mensalista cadastrado com este ${campo}.`)
      }
      throw erro
    }
  }

  async remover (id: string) {
    try {
      await this.prisma.mensalista.delete({ where: { id } })
    } catch (erro) {
      // Violação de foreign key — mensalista tem ciclos de mensalidade no
      // histórico (Mensalidade referencia mensalistaId com RESTRICT). Não dá
      // pra apagar sem perder o histórico de cobrança, então recusamos com
      // uma mensagem clara em vez de deixar vazar o erro cru do
      // Prisma/Postgres.
      //
      // Com o driver adapter do Postgres (@prisma/adapter-pg), erros de
      // banco não vêm no `erro.code` padrão do Prisma (ex.: P2003) — chegam
      // embrulhados em `erro.meta.driverAdapterError`, com o código original
      // do Postgres em `cause.originalCode` (23001 = restrict_violation,
      // 23503 = foreign_key_violation).
      if (erro instanceof Prisma.PrismaClientKnownRequestError) {
        const meta = erro.meta as { driverAdapterError?: { cause?: { originalCode?: string } } } | undefined
        const codigoPostgres = meta?.driverAdapterError?.cause?.originalCode
        if (erro.code === 'P2003' || codigoPostgres === '23001' || codigoPostgres === '23503') {
          throw new ConflictException(
            'Este mensalista tem histórico de cobranças e não pode ser excluído. Use "Inativar" em vez disso.'
          )
        }
      }
      throw erro
    }
  }
}
