const { z } = require('zod')

// Política mínima de senha (OWASP ASVS 2.1.1): usada em qualquer fluxo que
// DEFINE uma senha nova (cadastro, troca, reset). O login continua aceitando
// qualquer senha não vazia — não podemos invalidar senhas antigas de contas
// já existentes só por serem curtas, isso é papel de uma migração dedicada.
//
// Espelha exatamente a checagem que já existe no front (avaliarForcaSenha /
// MENSAGEM_SENHA_FRACA em assets/js/modules/auth.js) — antes disso o front
// bloqueava senha fraca na tela, mas nada impedia mandar uma senha de 1
// caractere direto pra API (ex.: curl/Postman), já que o schema só exigia
// `.min(1)`.
const MENSAGEM_SENHA_FRACA =
  'A senha deve ter pelo menos 8 caracteres, com letra maiúscula, letra minúscula, número e caractere especial.'

const senhaForte = z
  .string('Senha é obrigatória.')
  .min(8, MENSAGEM_SENHA_FRACA)
  .max(72, 'A senha deve ter no máximo 72 caracteres.') // limite do bcrypt
  .refine(senha => /[A-Z]/.test(senha), MENSAGEM_SENHA_FRACA)
  .refine(senha => /[a-z]/.test(senha), MENSAGEM_SENHA_FRACA)
  .refine(senha => /[0-9]/.test(senha), MENSAGEM_SENHA_FRACA)
  .refine(senha => /[^A-Za-z0-9]/.test(senha), MENSAGEM_SENHA_FRACA)

module.exports = { senhaForte }
