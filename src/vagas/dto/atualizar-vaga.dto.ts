import { PartialType } from '@nestjs/mapped-types'
import { CriarVagaDto } from './criar-vaga.dto'

export class AtualizarVagaDto extends PartialType(CriarVagaDto) {}
