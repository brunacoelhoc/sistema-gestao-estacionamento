import { Transform } from 'class-transformer'
import { IsNotEmpty, IsString, Matches } from 'class-validator'

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

export class SolicitarTrabalhoExtraDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data deve estar no formato YYYY-MM-DD.' })
  data!: string

  @IsString({ message: 'Motivo é obrigatório.' })
  @IsNotEmpty({ message: 'Motivo é obrigatório.' })
  @Transform(trim)
  motivo!: string
}
