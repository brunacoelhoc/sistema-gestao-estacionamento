import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AtualizarVagaDto } from './dto/atualizar-vaga.dto'
import { CriarVagaDto } from './dto/criar-vaga.dto'

@Injectable()
export class VagasService {
  constructor (private readonly prisma: PrismaService) {}

  // Sem orderBy o Postgres devolve as linhas em ordem física arbitrária (não
  // alfabética, não de criação) e pode até mudar entre uma consulta e outra
  // depois de um UPDATE — ver server/repositories/vagaRepository.js.
  listarTodas () {
    return this.prisma.vaga.findMany({ orderBy: { codigo: 'asc' } })
  }

  criar (dto: CriarVagaDto) {
    return this.prisma.vaga.create({
      data: {
        codigo: dto.codigo,
        tipo: (dto.tipo as any) || 'comum',
        status: (dto.status as any) || 'livre',
        acessivel: dto.acessivel || false
      }
    })
  }

  atualizar (id: string, dto: AtualizarVagaDto) {
    return this.prisma.vaga.update({ where: { id }, data: dto as any })
  }

  remover (id: string) {
    return this.prisma.vaga.delete({ where: { id } })
  }
}
