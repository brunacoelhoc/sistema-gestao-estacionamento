import { Transform } from 'class-transformer'
import { IsEmail } from 'class-validator'

export class SolicitarResetDto {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  email!: string
}
