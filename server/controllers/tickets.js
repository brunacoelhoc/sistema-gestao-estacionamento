const prisma = require('../config/prisma')
const ticketRepository = require('../repositories/ticketRepository')
const vagaRepository = require('../repositories/vagaRepository')
const tarifaRepository = require('../repositories/tarifaRepository')
const mensalistaRepository = require('../repositories/mensalistaRepository')
const { calcularTarifaAvulsa } = require('../services/cobranca')
const { buscarCicloVigente, abrirNovoCiclo } = require('../services/mensalidade')

function erroNegocio (mensagem, status = 409) {
  const erro = new Error(mensagem)
  erro.status = status
  return erro
}

/**
 * Sem `page` na query, mantém o contrato antigo (array completo) — usado
 * pelo Dashboard e por Métricas, que precisam do histórico inteiro para
 * calcular KPIs. Com `page`, aplica os mesmos filtros (status, termo) e
 * devolve só a fatia pedida, para a tabela de Tickets não baixar o
 * histórico inteiro a cada visita.
 */
async function listar (req, res) {
  const { page, pageSize, status, termo } = req.query

  const where = {}
  if (status && String(status).toLowerCase() !== 'todos') {
    where.status = String(status).toLowerCase()
  }
  if (termo) {
    const termoBusca = String(termo).trim()
    where.OR = [
      { placa: { contains: termoBusca, mode: 'insensitive' } },
      { vaga: { codigo: { contains: termoBusca, mode: 'insensitive' } } }
    ]
  }

  if (!page) {
    return res.json(await ticketRepository.listar(where))
  }

  const paginaNum = Math.max(1, Number(page) || 1)
  const tamanho = Math.min(100, Math.max(1, Number(pageSize) || 10))

  const [dados, total] = await Promise.all([
    ticketRepository.listar(where, { skip: (paginaNum - 1) * tamanho, take: tamanho }),
    ticketRepository.contar(where)
  ])

  res.json({
    dados,
    total,
    pagina: paginaNum,
    totalPaginas: Math.max(1, Math.ceil(total / tamanho))
  })
}

/**
 * Abertura de ticket: valida a vaga e já marca como ocupada na mesma
 * transação, evitando o cenário de duas chamadas HTTP separadas do front em
 * que uma falha no meio do caminho deixaria ticket e vaga inconsistentes
 * entre si.
 */
async function abrir (req, res) {
  const { placa, vagaId, tarifaId, mensalistaId } = req.body

  try {
    const ticket = await prisma.$transaction(async tx => {
      const vaga = await vagaRepository.buscarPorId(vagaId, tx)
      if (!vaga || vaga.status === 'ocupada') {
        throw erroNegocio('A vaga selecionada já está ocupada ou é inválida.')
      }

      const placaNormalizada = placa.toUpperCase().trim()

      // A tabela de Tickets não carrega mais a lista inteira no front (ver
      // listar, acima), então esta checagem — que antes rodava no cliente
      // sobre o array completo — precisa ser feita aqui para continuar
      // valendo.
      const ticketAbertoExistente = await ticketRepository.buscarAbertoPorPlaca(placaNormalizada, tx)
      if (ticketAbertoExistente) {
        throw erroNegocio(`A placa ${placaNormalizada} já possui um ticket aberto.`)
      }

      let mensalistaFinalId = mensalistaId || null
      if (!mensalistaFinalId) {
        const mensalista = await mensalistaRepository.buscarAtivoPorPlaca(placaNormalizada, tx)
        if (mensalista) mensalistaFinalId = mensalista.id
      }

      const novoTicket = await ticketRepository.criar({
        placa: placaNormalizada,
        vagaId,
        tarifaId: tarifaId || null,
        mensalistaId: mensalistaFinalId,
        status: 'aberto'
      }, tx)

      await vagaRepository.atualizar(vagaId, { status: 'ocupada' }, tx)

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
 * cobrado, rodando no servidor.
 *
 * Mensalista ativo não paga por hora: ele paga um ciclo de 30 dias corridos,
 * cobrado de uma vez na primeira entrada em que não há ciclo vigente (ver
 * server/services/mensalidade.js). Se já existe um ciclo cobrindo a data de
 * entrada deste ticket, ele fecha isento; senão, este ticket é quem cobra o
 * ciclo inteiro e o abre a partir da data de entrada.
 */
async function fechar (req, res) {
  const { formaPagamento } = req.body

  try {
    const resultado = await prisma.$transaction(async tx => {
      const ticket = await ticketRepository.buscarPorId(req.params.id, tx)
      if (!ticket || ticket.status !== 'aberto') {
        throw erroNegocio('Ticket inválido ou já finalizado.')
      }

      const dataSaida = new Date()
      const diffMinutos = Math.max(
        1,
        Math.floor((dataSaida - ticket.dataEntrada) / (1000 * 60))
      )

      let valorTotal
      let formaPagamentoFinal = formaPagamento || null
      let mensalistaCiclo = null

      const mensalista = ticket.mensalistaId
        ? await mensalistaRepository.buscarPorId(ticket.mensalistaId, tx)
        : null

      if (mensalista?.ativo) {
        const cicloVigente = await buscarCicloVigente(tx, mensalista.id, ticket.dataEntrada)

        if (cicloVigente) {
          valorTotal = 0
          formaPagamentoFinal = 'isento'
          mensalistaCiclo = { cobradoAgora: false, dataFim: cicloVigente.dataFim }
        } else {
          const novoCiclo = await abrirNovoCiclo(tx, mensalista, ticket.dataEntrada, formaPagamento || 'dinheiro')
          valorTotal = Number(mensalista.valorMensalidade || 0)
          formaPagamentoFinal = formaPagamento || 'dinheiro'
          mensalistaCiclo = { cobradoAgora: true, dataFim: novoCiclo.dataFim }
        }
      } else {
        const tarifa = ticket.tarifaId
          ? await tarifaRepository.buscarPorId(ticket.tarifaId, tx)
          : await tarifaRepository.buscarPrimeira(tx)
        const valorHora = tarifa ? Number(tarifa.valorHora) : undefined

        valorTotal = calcularTarifaAvulsa(diffMinutos, valorHora)
      }

      const ticketAtualizado = await ticketRepository.atualizar(req.params.id, {
        dataSaida,
        valorTotal,
        formaPagamento: formaPagamentoFinal,
        status: 'fechado'
      }, tx)

      await vagaRepository.atualizar(ticket.vagaId, { status: 'livre' }, tx)

      return { ...ticketAtualizado, mensalistaCiclo }
    })

    res.json(resultado)
  } catch (erro) {
    if (erro.status) return res.status(erro.status).json({ erro: erro.message })
    throw erro
  }
}

async function remover (req, res) {
  await ticketRepository.remover(req.params.id)
  res.status(204).end()
}

module.exports = { listar, abrir, fechar, remover }
