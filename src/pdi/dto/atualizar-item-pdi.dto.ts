import { Transform } from 'class-transformer'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

export class AtualizarItemPdiDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Título não pode ficar vazio.' })
  @Transform(trim)
  titulo?: string

  @IsOptional()
  @IsString()
  @Transform(trim)
  descricao?: string
}
