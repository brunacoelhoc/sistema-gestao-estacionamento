const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { OAuth2Client } = require('google-auth-library')
const prisma = require('../config/prisma')
const usuarioRepository = require('../repositories/usuarioRepository')
const resetSenhaCodigoRepository = require('../repositories/resetSenhaCodigoRepository')
const { enviarEmailResetSenha } = require('../services/email')

const RESET_TTL_MINUTOS = 15

function gerarCodigoReset () {
  return String(crypto.randomInt(100000, 1000000))
}

// Nunca guardamos o código em texto puro — só o hash, igual senha.
function hashCodigoReset (codigo) {
  return crypto.createHash('sha256').update(codigo).digest('hex')
}

// GOOGLE_CLIENT_ID precisa ser o mesmo Client ID configurado no front-end
// (ver GOOGLE_CLIENT_ID em assets/js/modules/auth.js) — Client ID não é
// segredo, é seguro deixá-lo público no navegador. Sem ele configurado no
// .env, o login com Google fica desativado (ver função google abaixo).
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || null
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null

// cpfPendente vai no token para o middleware requireProfileComplete decidir
// sem precisar consultar o banco a cada requisição. Contas criadas via
// Google (ver função google, abaixo) nascem sem CPF — cpfPendente fica true
// até o usuário completar o cadastro (POST/PATCH que grava o CPF precisa
// gerar um token novo, senão o token antigo continuaria "preso" com o valor
// de quando foi emitido).
function gerarToken (usuario) {
  return jwt.sign(
    { id: usuario.id, role: usuario.role, nome: usuario.nome, cpfPendente: !usuario.cpf },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  )
}

function semSenha (usuario) {
  const { senha, ...resto } = usuario
  return resto
}

// Login é por CPF, igual ao comportamento atual do front (AuthService.login).
async function login (req, res) {
  const { cpf, senha } = req.body

  const usuario = await usuarioRepository.buscarPorCpf(cpf)
  if (!usuario || !usuario.senha) {
    return res.status(401).json({ erro: 'CPF ou senha inválidos.' })
  }

  const senhaConfere = await bcrypt.compare(senha, usuario.senha)
  if (!senhaConfere) {
    return res.status(401).json({ erro: 'CPF ou senha inválidos.' })
  }
  if (!usuario.ativo) {
    return res.status(403).json({
      erro: 'Este usuário está inativo. Fale com um administrador do sistema.'
    })
  }

  res.json({ token: gerarToken(usuario), usuario: semSenha(usuario) })
}

async function registrar (req, res) {
  const { nome, cpf, email, senha, telefone, aceitouTermos } = req.body

  const [cpfExistente, emailExistente] = await Promise.all([
    usuarioRepository.buscarPorCpf(cpf),
    usuarioRepository.buscarPorEmail(email)
  ])
  if (cpfExistente) return res.status(409).json({ erro: 'Já existe uma conta cadastrada com este CPF.' })
  if (emailExistente) return res.status(409).json({ erro: 'Já existe uma conta cadastrada com este e-mail.' })

  const usuario = await usuarioRepository.criar({
    nome,
    cpf,
    email,
    senha: await bcrypt.hash(senha, 12),
    telefone,
    role: 'funcionario',
    ativo: true,
    aceitouTermos: Boolean(aceitouTermos),
    provedor: 'local',
    senhaAlteradaEm: new Date()
  })

  res.status(201).json({ token: gerarToken(usuario), usuario: semSenha(usuario) })
}

/**
 * Login/cadastro via Google. O front-end manda o ID token bruto
 * (credentialResponse.credential, ver auth.js) e é ESTA função que verifica
 * a assinatura com a chave pública do Google — o front não decodifica mais o
 * token por conta própria, então não dá pra forjar nome/e-mail.
 */
async function google (req, res) {
  if (!googleClient) {
    return res.status(503).json({
      erro: 'Login com Google não está configurado neste servidor (GOOGLE_CLIENT_ID ausente).'
    })
  }

  const { credential } = req.body

  let payload
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    })
    payload = ticket.getPayload()
  } catch (erro) {
    return res.status(401).json({ erro: 'Credencial do Google inválida ou expirada.' })
  }

  const { email, name: nome } = payload || {}
  if (!email) {
    return res.status(400).json({ erro: 'Não foi possível ler os dados da conta Google.' })
  }

  let usuario = await usuarioRepository.buscarPorEmail(email)
  if (!usuario) {
    usuario = await usuarioRepository.criar({
      nome: nome || email,
      email,
      role: 'funcionario',
      ativo: true,
      aceitouTermos: true,
      provedor: 'google'
    })
  }

  if (!usuario.ativo) {
    return res.status(403).json({
      erro: 'Este usuário está inativo. Fale com um administrador do sistema.'
    })
  }

  res.json({ token: gerarToken(usuario), usuario: semSenha(usuario) })
}

// Recuperação de senha: gera um código de 6 dígitos, guarda só o hash dele
// (com expiração de RESET_TTL_MINUTOS) e envia o código por e-mail de
// verdade via server/services/email.js.
async function solicitarReset (req, res) {
  const { email } = req.body

  const usuario = await usuarioRepository.buscarPorEmail(email)
  if (!usuario) {
    return res.status(404).json({ erro: 'Não encontramos uma conta com este e-mail.' })
  }
  if (usuario.provedor === 'google') {
    return res.status(400).json({
      erro: 'Esta conta usa login do Google e não tem senha para redefinir.'
    })
  }

  const codigo = gerarCodigoReset()
  const expiraEm = new Date(Date.now() + RESET_TTL_MINUTOS * 60 * 1000)

  await prisma.$transaction(async tx => {
    // Invalida códigos anteriores ainda não usados — só o mais recente vale.
    await resetSenhaCodigoRepository.invalidarPendentes(usuario.id, tx)
    await resetSenhaCodigoRepository.criar(
      { usuarioId: usuario.id, codigoHash: hashCodigoReset(codigo), expiraEm }, tx
    )
  })

  await enviarEmailResetSenha({ to: usuario.email, nome: usuario.nome, codigo })

  res.json({ ok: true })
}

// Confere o código de verificação (hash + expiração + uso único) antes de
// trocar a senha. Igual ao login, a mensagem de erro não distingue "código
// errado" de "código expirado" pra não dar pista a quem estiver tentando
// adivinhar.
async function confirmarReset (req, res) {
  const { email, codigo, novaSenha } = req.body

  const usuario = await usuarioRepository.buscarPorEmail(email)
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' })

  const registro = await resetSenhaCodigoRepository.buscarPendenteMaisRecente(usuario.id)

  const codigoValido =
    registro &&
    registro.expiraEm > new Date() &&
    registro.codigoHash === hashCodigoReset(codigo)

  if (!codigoValido) {
    return res.status(400).json({ erro: 'Código de verificação inválido ou expirado.' })
  }

  const senhaHash = await bcrypt.hash(novaSenha, 12)
  await prisma.$transaction(async tx => {
    await resetSenhaCodigoRepository.marcarComoUsado(registro.id, tx)
    await usuarioRepository.atualizar(usuario.id, {
      senha: senhaHash,
      senhaTemporaria: false,
      senhaAlteradaEm: new Date()
    }, tx)
  })

  res.json({ ok: true })
}

module.exports = { login, registrar, google, solicitarReset, confirmarReset, gerarToken }
