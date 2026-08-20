const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { OAuth2Client } = require('google-auth-library')
const prisma = require('../config/prisma')

// GOOGLE_CLIENT_ID precisa ser o mesmo Client ID configurado no front-end
// (ver GOOGLE_CLIENT_ID em assets/js/modules/auth.js) — Client ID não é
// segredo, é seguro deixá-lo público no navegador. Sem ele configurado no
// .env, o login com Google fica desativado (ver função google abaixo).
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || null
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null

function gerarToken (usuario) {
  return jwt.sign(
    { id: usuario.id, role: usuario.role, nome: usuario.nome },
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
  if (!cpf || !senha) {
    return res.status(400).json({ erro: 'Informe CPF e senha.' })
  }

  const usuario = await prisma.usuario.findUnique({ where: { cpf } })
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

  if (!nome || !cpf || !email || !telefone || !senha) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios para o cadastro.' })
  }
  if (!aceitouTermos) {
    return res.status(400).json({ erro: 'É necessário aceitar os Termos de Uso para se cadastrar.' })
  }

  const [cpfExistente, emailExistente] = await Promise.all([
    prisma.usuario.findUnique({ where: { cpf } }),
    prisma.usuario.findUnique({ where: { email } })
  ])
  if (cpfExistente) return res.status(409).json({ erro: 'Já existe uma conta cadastrada com este CPF.' })
  if (emailExistente) return res.status(409).json({ erro: 'Já existe uma conta cadastrada com este e-mail.' })

  const usuario = await prisma.usuario.create({
    data: {
      nome,
      cpf,
      email,
      senha: await bcrypt.hash(senha, 12),
      telefone,
      role: 'funcionario',
      ativo: true,
      aceitouTermos: true,
      provedor: 'local',
      senhaAlteradaEm: new Date()
    }
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
  if (!credential) {
    return res.status(400).json({ erro: 'Não foi possível ler os dados da conta Google.' })
  }

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

  let usuario = await prisma.usuario.findUnique({ where: { email } })
  if (!usuario) {
    usuario = await prisma.usuario.create({
      data: {
        nome: nome || email,
        email,
        role: 'funcionario',
        ativo: true,
        aceitouTermos: true,
        provedor: 'google'
      }
    })
  }

  if (!usuario.ativo) {
    return res.status(403).json({
      erro: 'Este usuário está inativo. Fale com um administrador do sistema.'
    })
  }

  res.json({ token: gerarToken(usuario), usuario: semSenha(usuario) })
}

// Recuperação de senha (simulada — sem envio real de e-mail, o código é
// gerado e mostrado no próprio front-end). Esta função só confirma que
// existe uma conta local com esse e-mail, sem expor nenhum outro dado do
// usuário.
async function solicitarReset (req, res) {
  const { email } = req.body
  if (!email) return res.status(400).json({ erro: 'Informe um e-mail.' })

  const usuario = await prisma.usuario.findUnique({ where: { email } })
  if (!usuario) {
    return res.status(404).json({ erro: 'Não encontramos uma conta com este e-mail.' })
  }
  if (usuario.provedor === 'google') {
    return res.status(400).json({
      erro: 'Esta conta usa login do Google e não tem senha para redefinir.'
    })
  }

  res.json({ ok: true })
}

// A validação do código de verificação continua no front-end (ver
// solicitarResetSenha/confirmarResetSenha em auth.js); aqui só trocamos a
// senha de fato, já com hash.
async function confirmarReset (req, res) {
  const { email, novaSenha } = req.body
  if (!email || !novaSenha) {
    return res.status(400).json({ erro: 'Informe o e-mail e a nova senha.' })
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } })
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' })

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      senha: await bcrypt.hash(novaSenha, 12),
      senhaTemporaria: false,
      senhaAlteradaEm: new Date()
    }
  })

  res.json({ ok: true })
}

module.exports = { login, registrar, google, solicitarReset, confirmarReset }
