import { ConflictException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AtualizarTarifaDto } from './dto/atualizar-tarifa.dto'
import { CriarTarifaDto } from './dto/criar-tarifa.dto'

@Injectable()
export class TarifasService {
  constructor (private readonly prisma: PrismaService) {}

  listarTodas () {
    return this.prisma.tarifa.findMany()
  }

  // Usada como fallback quando um ticket não tem tarifa própria vinculada.
  buscarPrimeira () {
    return this.prisma.tarifa.findFirst()
  }

  criar (dados: CriarTarifaDto) {
    return this.prisma.tarifa.create({
      data: { categoria: dados.categoria, valorHora: dados.valorHora }
    })
  }

  atualizar (id: string, dados: AtualizarTarifaDto) {
    const data: Record<string, unknown> = {}
    if (dados.categoria !== undefined) data.categoria = dados.categoria
    if (dados.valorHora !== undefined) data.valorHora = dados.valorHora
    return this.prisma.tarifa.update({ where: { id }, data })
  }

  // Ticket.tarifaId é SET NULL (não RESTRICT) — o Postgres deixa apagar uma
  // tarifa vinculada a um ticket sem reclamar, só zera a referência. Pra
  // ticket já fechado isso não importa (o valor cobrado já está gravado em
  // Ticket.valorTotal), mas um ticket ainda ABERTO perderia a tarifa
  // escolhida e cairia no fallback "primeira tarifa cadastrada" ao fechar
  // (ver TicketsService.fechar) — podendo cobrar um valor por hora
  // diferente do que o cliente viu na entrada. Por isso a checagem aqui,
  // antes do delete, em vez de confiar só na constraint do banco.
  async remover (id: string) {
    const ticketAbertoVinculado = await this.prisma.ticket.findFirst({
      where: { tarifaId: id, status: 'aberto' }
    })
    if (ticketAbertoVinculado) {
      throw new ConflictException(
        'Esta tarifa está vinculada a um ticket em aberto e não pode ser excluída até ele ser fechado.'
      )
    }
    await this.prisma.tarifa.delete({ where: { id } })
  }
}
