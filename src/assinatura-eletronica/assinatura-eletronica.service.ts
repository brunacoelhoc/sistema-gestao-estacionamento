import { ConflictException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CadastrarAssinaturaDto } from './dto/cadastrar-assinatura.dto'

@Injectable()
export class AssinaturaEletronicaService {
  constructor (private readonly prisma: PrismaService) {}

  async buscarMinha (usuarioId: string) {
    return await this.prisma.assinaturaEletronica.findUnique({ where: { usuarioId } })
  }

  // Cadastro único de propósito: sem endpoint de edição — a mesma assinatura
  // vale pra toda folha de ponto e holerite que o funcionário assinar depois
  // (ver requisito de negócio). Quem errou o desenho recadastra recusado
  // aqui de propósito; se um dia for preciso corrigir, isso deveria passar
  // por RH/admin de forma auditável, não por um PATCH do próprio dono.
  async cadastrar (usuarioId: string, dto: CadastrarAssinaturaDto) {
    const existente = await this.prisma.assinaturaEletronica.findUnique({ where: { usuarioId } })
    if (existente) {
      throw new ConflictException('Você já tem uma assinatura eletrônica cadastrada.')
    }

    return await this.prisma.assinaturaEletronica.create({
      data: { usuarioId, imagemDataUri: dto.imagemDataUri }
    })
  }
}
