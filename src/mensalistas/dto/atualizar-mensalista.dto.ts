import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

// Presente e vazio = erro (telefone e categoriaPlano não podem ser
// removidos); ausente = não mexe no campo.
export class AtualizarMensalistaDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Nome é obrigatório.' })
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  nome?: string

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'CPF é obrigatório.' })
  @IsNotEmpty({ message: 'CPF é obrigatório.' })
  cpf?: string

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString({ message: 'Placa é obrigatória.' })
  @IsNotEmpty({ message: 'Placa é obrigatória.' })
  placa?: string

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'O telefone é obrigatório e não pode ser removido.' })
  @IsNotEmpty({ message: 'O telefone é obrigatório e não pode ser removido.' })
  telefone?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valorMensalidade?: number

  // Diferente de telefone/categoriaPlano: e-mail é opcional no cadastro, e
  // string vazia aqui vira `null` de propósito — é o jeito de "apagar" um
  // e-mail já cadastrado (undefined continua significando "não mexe").
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' && value.trim() === '' ? null : value)
  @IsEmail({}, { message: 'E-mail inválido.' })
  email?: string | null

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Categoria do plano não pode ficar vazia.' })
  @IsNotEmpty({ message: 'Categoria do plano não pode ficar vazia.' })
  categoriaPlano?: string

  @IsOptional()
  @Transform(({ value }) => value === undefined ? value : Boolean(value))
  @IsBoolean()
  ativo?: boolean
}
