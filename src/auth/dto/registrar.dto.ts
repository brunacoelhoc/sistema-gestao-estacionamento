import { Transform } from 'class-transformer'
import { Equals, IsEmail, IsNotEmpty, IsString } from 'class-validator'
import { IsCpfValido } from '../../common/cpf-valido.decorator'
import { IsSenhaForte } from '../../common/senha-forte.decorator'

export class RegistrarDto {
  @IsString({ message: 'Nome é obrigatório.' })
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  nome!: string

  // IsCpfValido antes de IsString/IsNotEmpty no empilhamento — ver o
  // comentário em criar-mensalista.dto.ts (senão CPF vazio mostra o erro de
  // formato em vez de "obrigatório").
  @IsCpfValido()
  @IsString({ message: 'CPF é obrigatório.' })
  @IsNotEmpty({ message: 'CPF é obrigatório.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  cpf!: string

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  email!: string

  @IsString({ message: 'Telefone é obrigatório.' })
  @IsNotEmpty({ message: 'Telefone é obrigatório.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  telefone!: string

  @IsSenhaForte()
  senha!: string

  @Equals(true, { message: 'É necessário aceitar os Termos de Uso para se cadastrar.' })
  aceitouTermos!: boolean
}
