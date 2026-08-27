import { Transform } from 'class-transformer'
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator'

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

export class CriarJustificativaDto {
  @IsString({ message: 'Funcionário é obrigatório.' })
  @IsNotEmpty({ message: 'Funcionário é obrigatório.' })
  usuarioId!: string

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data deve estar no formato YYYY-MM-DD.' })
  data!: string

  @IsIn(['atestado', 'abono', 'folga'])
  tipo!: 'atestado' | 'abono' | 'folga'

  @IsOptional()
  @Transform(trim)
  @IsString()
  descricao?: string
}
