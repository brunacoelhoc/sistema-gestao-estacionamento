const { z } = require('zod')
const { senhaForte } = require('./common')

const papel = z.enum(['admin', 'funcionario'])

// Avatar só pode ser: vazio/nulo (remover), ou uma imagem embutida como data
// URI (é assim que o front gera os avatares da galeria e o upload de foto —
// ver GALERIA_AVATARES/redimensionarImagemParaAvatar em assets/js/modules/
// auth.js). Sem essa checagem, o campo aceitava QUALQUER string e era
// renderizado sem escape em `<img src="${avatar}">` (ver inicializarMenuUsuario
// em auth.js) — um valor como `x" onerror="fetch(atacante)"` escapava do
// atributo src e executava JS ao carregar a navbar.
const avatar = z.union([
  z.literal(''),
  z
    .string()
    .trim()
    .max(200000, 'Avatar inválido.')
    .regex(
      /^data:image\/(png|jpe?g|gif|webp|svg\+xml);(base64,[A-Za-z0-9+/=]+|utf8,[A-Za-z0-9\-_.!~*'()%]+)$/,
      'Avatar inválido.'
    )
])

// Cadastro de funcionário pelo admin (painel "Funcionários") — cpf/telefone/
// endereco/dataNascimento são opcionais aqui porque o admin pode completar
// o resto depois; nome/email/senha são o mínimo para a conta existir.
const criar = z.object({
  nome: z.string('Nome é obrigatório.').trim().min(1, 'Nome é obrigatório.'),
  email: z.email('Informe um e-mail válido.').trim(),
  senha: senhaForte,
  cpf: z.string().trim().min(1).nullable().optional(),
  telefone: z.string().trim().min(1).nullable().optional(),
  endereco: z.string().trim().min(1).nullable().optional(),
  dataNascimento: z.string().trim().min(1).nullable().optional(),
  role: papel.optional()
})

// Usado tanto pelo modal "Meu Perfil" (dono da conta) quanto pelo admin —
// todo campo é opcional porque cada chamada manda só o que está mudando
// (ver server/controllers/usuarios.js#atualizar, que só grava o que veio
// definido no corpo).
const atualizar = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório.').optional(),
  cpf: z.string().trim().min(1, 'CPF é obrigatório.').nullable().optional(),
  email: z.email('Informe um e-mail válido.').trim().optional(),
  telefone: z.string().trim().min(1, 'Telefone é obrigatório.').nullable().optional(),
  endereco: z.string().trim().min(1).nullable().optional(),
  dataNascimento: z.string().trim().min(1).nullable().optional(),
  avatar: avatar.nullable().optional(),
  senha: senhaForte.optional(),
  senhaAtual: z.string().min(1).optional(),
  role: papel.optional(),
  ativo: z.coerce.boolean().optional()
})

module.exports = { criar, atualizar }
