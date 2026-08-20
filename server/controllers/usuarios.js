const bcrypt = require('bcryptjs')
const prisma = require('../config/prisma')

function semSenha (usuario) {
  const { senha, ...resto } = usuario
  return resto
}

// Só admin lista todos os usuários — evita expor a base inteira (inclusive
// hash de senha) para qualquer funcionário logado.
async function listar (req, res) {
  const usuarios = await prisma.usuario.findMany()
  res.json(usuarios.map(semSenha))
}

// Cadastro de funcionário feito pelo admin (painel "Funcionários").
async function criar (req, res) {
  const { nome, cpf, email, senha, telefone, endereco, dataNascimento, role } = req.body
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' })
  }

  try {
    const usuario = await prisma.usuario.create({
      data: {
        nome,
        cpf: cpf || null,
        email,
        senha: await bcrypt.hash(senha, 12),
        telefone: telefone || null,
        endereco: endereco || null,
        dataNascimento: dataNascimento ? new Date(dataNascimento) : null,
        role: role === 'admin' ? 'admin' : 'funcionario',
        ativo: true,
        aceitouTermos: true,
        provedor: 'local',
        senhaTemporaria: true
      }
    })
    res.status(201).json(semSenha(usuario))
  } catch (erro) {
    if (erro.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe um usuário cadastrado com este CPF ou e-mail.' })
    }
    throw erro
  }
}

// Usado tanto pelo modal "Meu Perfil" (dono da conta) quanto pelo admin.
async function atualizar (req, res) {
  const souEuMesmo = req.usuario.id === req.params.id
  if (!souEuMesmo && req.usuario.role !== 'admin') {
    return res.status(403).json({ erro: 'Você só pode editar o seu próprio perfil.' })
  }

  const dados = {}
  const {
    nome, cpf, email, telefone, endereco, dataNascimento, avatar,
    senha, senhaAtual, role, ativo
  } = req.body

  if (nome !== undefined) dados.nome = nome
  if (cpf !== undefined) dados.cpf = cpf
  if (email !== undefined) dados.email = email
  if (telefone !== undefined) dados.telefone = telefone
  if (endereco !== undefined) dados.endereco = endereco
  if (dataNascimento !== undefined) {
    dados.dataNascimento = dataNascimento ? new Date(dataNascimento) : null
  }
  if (avatar !== undefined) dados.avatar = avatar

  if (senha) {
    // Quando o dono da conta troca a própria senha pelo "Meu Perfil" e manda
    // a senha atual, confirmamos com bcrypt antes de trocar — evita que
    // alguém com a sessão aberta troque a senha sem saber a atual. A troca
    // obrigatória (temporária/expirada) não manda senhaAtual, então pula
    // essa checagem — o usuário já provou identidade ao logar.
    if (senhaAtual) {
      const usuarioAtual = await prisma.usuario.findUnique({ where: { id: req.params.id } })
      const confere = usuarioAtual?.senha && (await bcrypt.compare(senhaAtual, usuarioAtual.senha))
      if (!confere) {
        return res.status(400).json({ erro: 'Senha atual incorreta.' })
      }
    }
    dados.senha = await bcrypt.hash(senha, 12)
    // O próprio dono trocando a senha (perfil ou troca obrigatória) já conta
    // como definitiva; senha redefinida pelo admin para outra conta fica
    // marcada como temporária, obrigando a troca no próximo login.
    dados.senhaTemporaria = !souEuMesmo
    dados.senhaAlteradaEm = souEuMesmo ? new Date() : null
  }

  // Só admin pode alterar papel/status de qualquer conta (inclusive a própria).
  if (req.usuario.role === 'admin') {
    if (role !== undefined) dados.role = role === 'admin' ? 'admin' : 'funcionario'
    if (ativo !== undefined) dados.ativo = Boolean(ativo)
  }

  try {
    const usuario = await prisma.usuario.update({ where: { id: req.params.id }, data: dados })
    res.json(semSenha(usuario))
  } catch (erro) {
    if (erro.code === 'P2002') {
      const campo = erro.meta?.target?.includes('cpf') ? 'CPF' : 'e-mail'
      return res.status(409).json({ erro: `Este ${campo} já está em uso por outra conta.` })
    }
    throw erro
  }
}

module.exports = { listar, criar, atualizar }
