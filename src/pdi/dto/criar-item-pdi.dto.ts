import { Transform } from 'class-transformer'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

export class CriarItemPdiDto {
  @IsString({ message: 'Título é obrigatório.' })
  @IsNotEmpty({ message: 'Título é obrigatório.' })
  @Transform(trim)
  titulo!: string

  @IsOptional()
  @IsString()
  @Transform(trim)
  descricao?: string
}
