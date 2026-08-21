import { Transform } from 'class-transformer'
import { IsNotEmpty, IsString } from 'class-validator'

export class LoginDto {
  @IsString({ message: 'CPF é obrigatório.' })
  @IsNotEmpty({ message: 'CPF é obrigatório.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  cpf!: string

  @IsString({ message: 'Senha é obrigatória.' })
  @IsNotEmpty({ message: 'Senha é obrigatória.' })
  senha!: string
}
