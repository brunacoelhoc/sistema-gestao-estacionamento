import { Transform } from 'class-transformer'
import { IsEmail, IsNotEmpty, IsString } from 'class-validator'
import { IsSenhaForte } from '../../common/senha-forte.decorator'

export class ConfirmarResetDto {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  email!: string

  @IsString({ message: 'Informe o código recebido por e-mail.' })
  @IsNotEmpty({ message: 'Informe o código recebido por e-mail.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  codigo!: string

  @IsSenhaForte()
  novaSenha!: string
}
