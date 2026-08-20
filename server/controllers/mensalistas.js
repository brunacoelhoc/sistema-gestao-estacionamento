const prisma = require('../config/prisma')
const { abrirCiclo, encerrarCicloAntecipado } = require('../services/mensalidade')

async function listar (req, res) {
  res.json(await prisma.mensalista.findMany())
}

async function criar (req, res) {
  const { nome, cpf, placa, telefone, valorMensalidade, ativo } = req.body
  if (!nome || !cpf || !placa) {
    return res.status(400).json({ erro: 'Nome, CPF e placa são obrigatórios.' })
  }

  const ativoInicial = ativo !== undefined ? Boolean(ativo) : true

  const mensalista = await prisma.$transaction(async tx => {
    const criado = await tx.mensalista.create({
      data: {
        nome,
        cpf,
        placa: placa.toUpperCase().trim(),
        telefone: telefone || null,
        valorMensalidade: valorMensalidade || 0,
        ativo: ativoInicial
      }
    })

    if (ativoInicial) await abrirCiclo(tx, criado)

    return criado
  })

  res.status(201).json(mensalista)
}

async function atualizar (req, res) {
  const atual = await prisma.mensalista.findUnique({ where: { id: req.params.id } })
  if (!atual) {
    return res.status(404).json({ erro: 'Mensalista não encontrado.' })
  }

  const dados = {}
  const { nome, cpf, placa, telefone, valorMensalidade, ativo } = req.body
  if (nome !== undefined) dados.nome = nome
  if (cpf !== undefined) dados.cpf = cpf
  if (placa !== undefined) dados.placa = placa.toUpperCase().trim()
  if (telefone !== undefined) dados.telefone = telefone
  if (valorMensalidade !== undefined) dados.valorMensalidade = valorMensalidade
  if (ativo !== undefined) dados.ativo = Boolean(ativo)

  const mensalista = await prisma.$transaction(async tx => {
    const atualizado = await tx.mensalista.update({ where: { id: req.params.id }, data: dados })

    // O ciclo de mensalidade só reage a uma mudança real de status — trocar
    // outros campos (nome, telefone etc.) não mexe na cobrança vigente.
    if (dados.ativo === true && !atual.ativo) {
      await abrirCiclo(tx, atualizado)
    } else if (dados.ativo === false && atual.ativo) {
      await encerrarCicloAntecipado(tx, atualizado)
    }

    return atualizado
  })

  res.json(mensalista)
}

async function remover (req, res) {
  await prisma.mensalista.delete({ where: { id: req.params.id } })
  res.status(204).end()
}

module.exports = { listar, criar, atualizar, remover }
