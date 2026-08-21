import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'

const minusculo = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value

// Reflete o enum StatusVaga/TipoVaga do schema.prisma.
export class CriarVagaDto {
  @IsString({ message: 'Código da vaga é obrigatório.' })
  @IsNotEmpty({ message: 'Código da vaga é obrigatório.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  codigo!: string

  @IsOptional()
  @Transform(minusculo)
  @IsIn(['comum', 'coberta', 'mensalista'], { message: 'Tipo de vaga inválido.' })
  tipo?: string

  @IsOptional()
  @Transform(minusculo)
  @IsIn(['livre', 'ocupada'], { message: 'Status de vaga inválido.' })
  status?: string

  @IsOptional()
  @IsBoolean()
  acessivel?: boolean
}
