const mensalistaRepository = require('../repositories/mensalistaRepository')

async function listar (req, res) {
  res.json(await mensalistaRepository.listarTodos())
}

// O ciclo de mensalidade (30 dias corridos) não nasce mais aqui: cadastrar
// ou reativar um mensalista não cobra nada por si só — a cobrança só
// acontece quando ele de fato estaciona e fecha um ticket sem ter um ciclo
// vigente (ver server/controllers/tickets.js#fechar e
// server/services/mensalidade.js).
async function criar (req, res) {
  const { nome, cpf, placa, telefone, valorMensalidade, ativo } = req.body
  const ativoInicial = ativo !== undefined ? ativo : true

  const mensalista = await mensalistaRepository.criar({
    nome,
    cpf,
    placa,
    telefone,
    valorMensalidade: valorMensalidade || 0,
    ativo: ativoInicial
  })

  res.status(201).json(mensalista)
}

async function atualizar (req, res) {
  const atual = await mensalistaRepository.buscarPorId(req.params.id)
  if (!atual) {
    return res.status(404).json({ erro: 'Mensalista não encontrado.' })
  }

  const mensalista = await mensalistaRepository.atualizar(req.params.id, req.body)
  res.json(mensalista)
}

async function remover (req, res) {
  try {
    await mensalistaRepository.remover(req.params.id)
    res.status(204).end()
  } catch (erro) {
    // Violação de foreign key — mensalista tem ciclos de mensalidade no
    // histórico (Mensalidade referencia mensalistaId com RESTRICT). Não dá
    // pra apagar sem perder o histórico de cobrança, então recusamos com uma
    // mensagem clara em vez de deixar vazar o erro cru do Prisma/Postgres.
    //
    // Com o driver adapter do Postgres (@prisma/adapter-pg), erros de banco
    // não vêm no `erro.code` padrão do Prisma (ex.: P2003) — chegam
    // embrulhados em `erro.meta.driverAdapterError`, com o código original
    // do Postgres em `cause.originalCode` (23001 = restrict_violation,
    // 23503 = foreign_key_violation).
    const codigoPostgres = erro.meta?.driverAdapterError?.cause?.originalCode
    if (erro.code === 'P2003' || codigoPostgres === '23001' || codigoPostgres === '23503') {
      return res.status(409).json({
        erro: 'Este mensalista tem histórico de cobranças e não pode ser excluído. Use "Inativar" em vez disso.'
      })
    }
    throw erro
  }
}

module.exports = { listar, criar, atualizar, remover }
