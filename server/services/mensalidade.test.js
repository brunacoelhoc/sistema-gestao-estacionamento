const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  DURACAO_CICLO_DIAS,
  referenciaDe,
  calcularFimCiclo,
  buscarCicloVigente,
  abrirNovoCiclo
} = require('./mensalidade')

// Prisma real não entra no escopo de testes unitários — este fake replica só
// o que o service usa de tx.mensalidade (findFirst/create) num array em
// memória.
function criarTxFake () {
  const registros = []
  let proximoId = 1

  return {
    registros,
    mensalidade: {
      async findFirst ({ where: { mensalistaId, dataFim } }) {
        const candidatos = registros
          .filter(r => r.mensalistaId === mensalistaId && r.dataFim >= dataFim.gte)
          .sort((a, b) => b.dataInicio - a.dataInicio)
        return candidatos[0] || null
      },
      async create ({ data }) {
        const registro = { id: String(proximoId++), ...data }
        registros.push(registro)
        return { ...registro }
      }
    }
  }
}

test('referenciaDe formata como YYYY-MM com mês em 2 dígitos', () => {
  assert.equal(referenciaDe(new Date(2026, 0, 15)), '2026-01')
  assert.equal(referenciaDe(new Date(2026, 10, 1)), '2026-11')
})

test('calcularFimCiclo soma 30 dias corridos à data de início', () => {
  const inicio = new Date(2026, 7, 5) // 5 de agosto
  const fim = calcularFimCiclo(inicio)
  assert.equal(fim.getTime(), new Date(2026, 8, 4).getTime()) // 4 de setembro
})

test('abrirNovoCiclo cria um ciclo já pago, cobrindo 30 dias a partir da entrada', async () => {
  const tx = criarTxFake()
  const mensalista = { id: 'm1', valorMensalidade: 300 }
  const dataEntrada = new Date(2026, 7, 5)

  const ciclo = await abrirNovoCiclo(tx, mensalista, dataEntrada, 'pix')

  assert.equal(ciclo.status, 'paga')
  assert.equal(ciclo.formaPagamento, 'pix')
  assert.equal(ciclo.valor, 300)
  assert.equal(ciclo.diasCobrados, DURACAO_CICLO_DIAS)
  assert.equal(ciclo.dataInicio, dataEntrada)
  assert.equal(ciclo.dataFim.getTime(), calcularFimCiclo(dataEntrada).getTime())
})

test('buscarCicloVigente encontra o ciclo que ainda cobre a data informada', async () => {
  const tx = criarTxFake()
  const mensalista = { id: 'm1', valorMensalidade: 300 }

  await abrirNovoCiclo(tx, mensalista, new Date(2026, 7, 1), 'pix')

  const dentroDoCiclo = await buscarCicloVigente(tx, 'm1', new Date(2026, 7, 20))
  assert.ok(dentroDoCiclo, 'esperava encontrar o ciclo vigente')

  const depoisDoCiclo = await buscarCicloVigente(tx, 'm1', new Date(2026, 8, 5)) // 31+ dias depois
  assert.equal(depoisDoCiclo, null)
})

test('buscarCicloVigente retorna null para mensalista sem nenhum ciclo', async () => {
  const tx = criarTxFake()
  const resultado = await buscarCicloVigente(tx, 'sem-ciclo', new Date(2026, 7, 20))
  assert.equal(resultado, null)
})

test('um segundo ciclo aberto depois do vencimento do primeiro passa a ser o vigente', async () => {
  const tx = criarTxFake()
  const mensalista = { id: 'm1', valorMensalidade: 300 }

  await abrirNovoCiclo(tx, mensalista, new Date(2026, 7, 1), 'pix')
  const segundo = await abrirNovoCiclo(tx, mensalista, new Date(2026, 9, 15), 'dinheiro')

  const vigente = await buscarCicloVigente(tx, 'm1', new Date(2026, 9, 20))
  assert.equal(vigente.id, segundo.id)
})
