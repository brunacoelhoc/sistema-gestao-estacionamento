import { ConflictException, Injectable } from '@nestjs/common'
import { ehViolacaoRestricaoFk } from '../common/utils/prisma-erro.util'
import { PrismaService } from '../prisma/prisma.service'
import { AtualizarVagaDto } from './dto/atualizar-vaga.dto'
import { CriarVagaDto } from './dto/criar-vaga.dto'

@Injectable()
export class VagasService {
  constructor (private readonly prisma: PrismaService) {}

  // Sem orderBy o Postgres devolve as linhas em ordem física arbitrária (não
  // alfabética, não de criação) e pode até mudar entre uma consulta e outra
  // depois de um UPDATE — sem isso, o combo de "Vaga Disponível" no front
  // ficava embaralhado a cada recarregamento.
  //
  // O orderBy do Postgres ordena "codigo" como texto puro, então A10 vem
  // logo depois de A1 (antes de A2..A9) — ordenação alfabética, não
  // numérica. Por isso a ordenação final é feita aqui em JS, com
  // localeCompare({ numeric: true }), que trata o número dentro do código
  // como número (A1, A2, ..., A10) em vez de comparar caractere a caractere.
  async listarTodas () {
    const vagas = await this.prisma.vaga.findMany()
    return vagas.sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true, sensitivity: 'base' }))
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

  async remover (id: string) {
    try {
      await this.prisma.vaga.delete({ where: { id } })
    } catch (erro) {
      // Violação de FK — a vaga tem tickets vinculados (Ticket.vagaId é
      // RESTRICT, mesmo depois de fechados: preserva o histórico de uso pro
      // ranking/relatórios). Antes esse erro vazava cru do Prisma/Postgres
      // como um 500 genérico; agora recusa com uma mensagem clara.
      if (ehViolacaoRestricaoFk(erro)) {
        throw new ConflictException(
          'Esta vaga tem tickets vinculados (mesmo já fechados) e não pode ser excluída. Marque como "Manutenção" em vez disso.'
        )
      }
      throw erro
    }
  }
}
