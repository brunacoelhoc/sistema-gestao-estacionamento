const { z } = require('zod')
const { senhaForte } = require('./common')

const login = z.object({
  cpf: z.string('CPF é obrigatório.').trim().min(1, 'CPF é obrigatório.'),
  // Login aceita qualquer senha não vazia (não a política forte abaixo):
  // contas antigas podem ter senha curta e continuam precisando logar.
  senha: z.string('Senha é obrigatória.').min(1, 'Senha é obrigatória.')
})

const registrar = z.object({
  nome: z.string('Nome é obrigatório.').trim().min(1, 'Nome é obrigatório.'),
  cpf: z.string('CPF é obrigatório.').trim().min(1, 'CPF é obrigatório.'),
  email: z.email('Informe um e-mail válido.').trim(),
  telefone: z.string('Telefone é obrigatório.').trim().min(1, 'Telefone é obrigatório.'),
  senha: senhaForte,
  aceitouTermos: z.literal(true, { error: 'É necessário aceitar os Termos de Uso para se cadastrar.' })
})

const google = z.object({
  credential: z.string('Não foi possível ler os dados da conta Google.').trim().min(1, 'Não foi possível ler os dados da conta Google.')
})

const solicitarReset = z.object({
  email: z.email('Informe um e-mail válido.').trim()
})

const confirmarReset = z.object({
  email: z.email('Informe um e-mail válido.').trim(),
  codigo: z.string('Informe o código recebido por e-mail.').trim().min(1, 'Informe o código recebido por e-mail.'),
  novaSenha: senhaForte
})

module.exports = { login, registrar, google, solicitarReset, confirmarReset }
