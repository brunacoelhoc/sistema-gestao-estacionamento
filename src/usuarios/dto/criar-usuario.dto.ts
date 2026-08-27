import { Transform } from 'class-transformer'
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { IsCpfValido } from '../../common/cpf-valido.decorator'
import { IsSenhaForte } from '../../common/senha-forte.decorator'

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

// Cadastro de funcionário pelo admin (painel "Funcionários") — cpf/telefone/
// endereco/dataNascimento são opcionais aqui porque o admin pode completar o
// resto depois; nome/email/senha são o mínimo para a conta existir.
export class CriarUsuarioDto {
  @IsString({ message: 'Nome é obrigatório.' })
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  @Transform(trim)
  nome!: string

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Transform(trim)
  email!: string

  @IsSenhaForte()
  senha!: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsCpfValido()
  cpf?: string | null

  @IsOptional()
  @Transform(trim)
  @IsString()
  telefone?: string | null

  @IsOptional()
  @Transform(trim)
  @IsString()
  endereco?: string | null

  @IsOptional()
  @Transform(trim)
  @IsString()
  dataNascimento?: string | null

  @IsOptional()
  @IsIn(['admin', 'rh', 'gestor', 'funcionario', 'financeiro'])
  role?: string
}
