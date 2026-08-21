import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

export class CriarMensalistaDto {
  @IsString({ message: 'Nome é obrigatório.' })
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  @Transform(trim)
  nome!: string

  @IsString({ message: 'CPF é obrigatório.' })
  @IsNotEmpty({ message: 'CPF é obrigatório.' })
  @Transform(trim)
  cpf!: string

  @IsString({ message: 'Placa é obrigatória.' })
  @IsNotEmpty({ message: 'Placa é obrigatória.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  placa!: string

  @IsString({ message: 'O telefone é obrigatório e não pode ser removido.' })
  @IsNotEmpty({ message: 'O telefone é obrigatório e não pode ser removido.' })
  @Transform(trim)
  telefone!: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valorMensalidade?: number

  @IsOptional()
  @Transform(({ value }) => value === undefined ? value : Boolean(value))
  @IsBoolean()
  ativo?: boolean
}
