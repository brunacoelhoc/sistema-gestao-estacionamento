import { Transform } from 'class-transformer'
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator'

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

// Um único DTO "definir", reusado por POST (criar) e PATCH (editar) — mesmo
// padrão de DefinirPerfilRhDto: RH sempre reenvia a etapa inteira.
export class DefinirEtapaCarreiraDto {
  @IsInt({ message: 'Ordem deve ser um número inteiro.' })
  @Min(1, { message: 'Ordem deve ser pelo menos 1.' })
  ordem!: number

  @IsString({ message: 'Título é obrigatório.' })
  @IsNotEmpty({ message: 'Título é obrigatório.' })
  @Transform(trim)
  titulo!: string

  @IsOptional()
  @IsString()
  @Transform(trim)
  faixaSalarial?: string

  @IsString({ message: 'Descrição é obrigatória.' })
  @IsNotEmpty({ message: 'Descrição é obrigatória.' })
  @Transform(trim)
  descricao!: string
}
