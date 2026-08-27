import { Transform } from 'class-transformer'
import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator'
import { IsCpfValido } from '../../common/cpf-valido.decorator'
import { IsSenhaForte } from '../../common/senha-forte.decorator'

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

// Usado tanto pelo modal "Meu Perfil" (dono da conta) quanto pelo admin —
// todo campo é opcional porque cada chamada manda só o que está mudando
// (ver UsuariosService.atualizarPerfil, que só grava o que veio definido no
// corpo).
export class AtualizarUsuarioDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Nome é obrigatório.' })
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  nome?: string

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'CPF é obrigatório.' })
  @IsCpfValido()
  cpf?: string | null

  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email?: string

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Telefone é obrigatório.' })
  telefone?: string | null

  @IsOptional()
  @Transform(trim)
  @IsString()
  endereco?: string | null

  @IsOptional()
  @Transform(trim)
  @IsString()
  dataNascimento?: string | null

  // Avatar só pode ser: vazio/nulo (remover), ou uma imagem embutida como
  // data URI (é assim que o front gera os avatares — ver GALERIA_AVATARES/
  // redimensionarImagemParaAvatar em assets/js/modules/auth.js). Sem essa
  // checagem, o campo aceitava QUALQUER string e era renderizado sem escape
  // em `<img src="${avatar}">` (ver inicializarMenuUsuario em auth.js) — um
  // valor como `x" onerror="fetch(atacante)"` escapava do atributo src e
  // executava JS ao carregar a navbar.
  @IsOptional()
  @MaxLength(200000, { message: 'Avatar inválido.' })
  @Matches(/^$|^data:image\/(png|jpe?g|gif|webp|svg\+xml);(base64,[A-Za-z0-9+/=]+|utf8,[A-Za-z0-9\-_.!~*'()%]+)$/, { message: 'Avatar inválido.' })
  avatar?: string | null

  @IsOptional()
  @IsSenhaForte()
  senha?: string

  @IsOptional()
  @IsString()
  senhaAtual?: string

  @IsOptional()
  @IsIn(['admin', 'rh', 'gestor', 'funcionario', 'financeiro'])
  role?: string

  @IsOptional()
  @Transform(({ value }) => value === undefined ? value : Boolean(value))
  @IsBoolean()
  ativo?: boolean
}
