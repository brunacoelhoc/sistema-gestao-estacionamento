import { Injectable } from '@nestjs/common'
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

  remover (id: string) {
    return this.prisma.tarifa.delete({ where: { id } })
  }
}
