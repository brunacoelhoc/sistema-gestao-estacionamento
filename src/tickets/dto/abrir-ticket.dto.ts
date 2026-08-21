import { Transform } from 'class-transformer'
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator'

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

export class AbrirTicketDto {
  @IsString({ message: 'Placa é obrigatória.' })
  @IsNotEmpty({ message: 'Placa é obrigatória.' })
  @Transform(trim)
  placa!: string

  @IsString({ message: 'Vaga é obrigatória.' })
  @IsNotEmpty({ message: 'Vaga é obrigatória.' })
  @Transform(trim)
  vagaId!: string

  // O front sempre manda estes dois campos, com `null` explícito quando não
  // há tarifa/mensalista selecionado (ver ApiService.criarTicket) — por
  // isso são nullable, não só optional: todo ticket avulso (o caso mais
  // comum) manda tarifaId/mensalistaId: null.
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  tarifaId?: string | null

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  mensalistaId?: string | null
}
