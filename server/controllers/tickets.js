const prisma = require('../config/prisma')

// Tolerância de cortesia: permanências até este limite não são cobradas.
const TEMPO_TOLERANCIA_MINUTOS = 15

function erroNegocio (mensagem, status = 409) {
  const erro = new Error(mensagem)
  erro.status = status
  return erro
}

async function listar (req, res) {
  res.json(await prisma.ticket.findMany())
}

/**
 * Abertura de ticket: valida a vaga e já marca como ocupada na mesma
 * transação, evitando o cenário de duas chamadas HTTP separadas do front em
 * que uma falha no meio do caminho deixaria ticket e vaga inconsistentes
 * entre si.
 */
async function abrir (req, res) {
  const { placa, vagaId, tarifaId, mensalistaId } = req.body
  if (!placa || !vagaId) {
    return res.status(400).json({ erro: 'Placa e vaga são obrigatórias.' })
  }

  try {
    const ticket = await prisma.$transaction(async tx => {
      const vaga = await tx.vaga.findUnique({ where: { id: vagaId } })
      if (!vaga || vaga.status === 'ocupada') {
        throw erroNegocio('A vaga selecionada já está ocupada ou é inválida.')
      }

      const placaNormalizada = placa.toUpperCase().trim()

      let mensalistaFinalId = mensalistaId || null
      if (!mensalistaFinalId) {
        const mensalista = await tx.mensalista.findFirst({
          where: { placa: placaNormalizada, ativo: true }
        })
        if (mensalista) mensalistaFinalId = mensalista.id
      }

      const novoTicket = await tx.ticket.create({
        data: {
          placa: placaNormalizada,
          vagaId,
          tarifaId: tarifaId || null,
          mensalistaId: mensalistaFinalId,
          status: 'aberto'
        }
      })

      await tx.vaga.update({ where: { id: vagaId }, data: { status: 'ocupada' } })

      return novoTicket
    })

    res.status(201).json(ticket)
  } catch (erro) {
    if (erro.status) return res.status(erro.status).json({ erro: erro.message })
    throw erro
  }
}

/**
 * Fechamento de ticket e cálculo de tarifa — único ponto de cálculo do valor
 * cobrado, rodando no servidor. Mensalista ativo não paga por ticket (ele já
 * paga o ciclo mensal — ver server/services/mensalidade.js), então fecha
 * sempre com valorTotal 0.
 */
async function fechar (req, res) {
  const { formaPagamento } = req.body

  try {
    const resultado = await prisma.$transaction(async tx => {
      const ticket = await tx.ticket.findUnique({ where: { id: req.params.id } })
      if (!ticket || ticket.status !== 'aberto') {
        throw erroNegocio('Ticket inválido ou já finalizado.')
      }

      const dataSaida = new Date()
      const diffMinutos = Math.max(
        1,
        Math.floor((dataSaida - ticket.dataEntrada) / (1000 * 60))
      )

      let mensalistaAtivo = false
      if (ticket.mensalistaId) {
        const mensalista = await tx.mensalista.findUnique({
          where: { id: ticket.mensalistaId }
        })
        mensalistaAtivo = Boolean(mensalista?.ativo)
      }

      let valorTotal = 0
      if (mensalistaAtivo) {
        valorTotal = 0
      } else if (diffMinutos <= TEMPO_TOLERANCIA_MINUTOS) {
        valorTotal = 0
      } else {
        const tarifa = ticket.tarifaId
          ? await tx.tarifa.findUnique({ where: { id: ticket.tarifaId } })
          : await tx.tarifa.findFirst()
        const valorHora = tarifa ? Number(tarifa.valorHora) : 10
        const horasPagas = Math.max(1, Math.ceil(diffMinutos / 60))
        valorTotal = horasPagas * valorHora
      }

      const ticketAtualizado = await tx.ticket.update({
        where: { id: req.params.id },
        data: {
          dataSaida,
          valorTotal,
          formaPagamento: formaPagamento || (mensalistaAtivo ? 'isento' : null),
          status: 'fechado'
        }
      })

      await tx.vaga.update({ where: { id: ticket.vagaId }, data: { status: 'livre' } })

      return ticketAtualizado
    })

    res.json(resultado)
  } catch (erro) {
    if (erro.status) return res.status(erro.status).json({ erro: erro.message })
    throw erro
  }
}

async function remover (req, res) {
  await prisma.ticket.delete({ where: { id: req.params.id } })
  res.status(204).end()
}

module.exports = { listar, abrir, fechar, remover }
