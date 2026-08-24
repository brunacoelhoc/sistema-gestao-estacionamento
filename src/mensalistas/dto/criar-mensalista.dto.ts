import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { IsCpfValido } from '../../common/cpf-valido.decorator'
import { IsPlacaValida } from '../../common/placa-valida.decorator'

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

export class CriarMensalistaDto {
  @IsString({ message: 'Nome é obrigatório.' })
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  @Transform(trim)
  nome!: string

  // IsCpfValido precisa vir ANTES de IsString/IsNotEmpty no empilhamento: com
  // experimentalDecorators, decorators aplicam de baixo pra cima, então o
  // último a ser escrito é o primeiro a validar — e a ValidationPipe só
  // devolve a mensagem do primeiro que falhar (ver validation-exception-
  // factory.ts). Nessa ordem, CPF vazio cai em IsNotEmpty ("obrigatório"),
  // não no formato — só cai no formato quando o CPF já foi preenchido, mas
  // errado.
  @IsCpfValido()
  @IsString({ message: 'CPF é obrigatório.' })
  @IsNotEmpty({ message: 'CPF é obrigatório.' })
  @Transform(trim)
  cpf!: string

  // Mesmo motivo do CPF acima.
  @IsPlacaValida()
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
  @Transform(({ value }) => typeof value === 'string' && value.trim() === '' ? undefined : value)
  @IsEmail({}, { message: 'E-mail inválido.' })
  email?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Categoria do plano não pode ficar vazia.' })
  categoriaPlano?: string

  @IsOptional()
  @Transform(({ value }) => value === undefined ? value : Boolean(value))
  @IsBoolean()
  ativo?: boolean
}
