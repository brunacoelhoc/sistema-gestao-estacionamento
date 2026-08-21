import { IsStrongPassword, MaxLength } from 'class-validator'

// Política mínima de senha (OWASP ASVS 2.1.1): usada em qualquer fluxo que
// DEFINE uma senha nova (cadastro, troca, reset). O login continua aceitando
// qualquer senha não vazia — não podemos invalidar senhas antigas de contas
// já existentes só por serem curtas.
export const MENSAGEM_SENHA_FRACA =
  'A senha deve ter pelo menos 8 caracteres, com letra maiúscula, letra minúscula, número e caractere especial.'

export function IsSenhaForte () {
  return function (target: object, propertyKey: string) {
    IsStrongPassword(
      { minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 },
      { message: MENSAGEM_SENHA_FRACA }
    )(target, propertyKey)
    MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })(target, propertyKey) // limite do bcrypt
  }
}
