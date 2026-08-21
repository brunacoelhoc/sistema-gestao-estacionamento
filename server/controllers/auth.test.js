const { test } = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')

// Mesma lib/estratégia usada em server/controllers/auth.js (bcrypt.hash /
// bcrypt.compare). Custo baixo aqui só para o teste rodar rápido — em
// produção o hash real usa custo 12 (ver registrar/confirmarReset).
const CUSTO_TESTE = 4

test('hash da senha nunca é igual ao texto puro', async () => {
  const hash = await bcrypt.hash('minhaSenha123', CUSTO_TESTE)
  assert.notEqual(hash, 'minhaSenha123')
})

test('compare aceita a senha correta contra o hash gerado', async () => {
  const hash = await bcrypt.hash('minhaSenha123', CUSTO_TESTE)
  assert.equal(await bcrypt.compare('minhaSenha123', hash), true)
})

test('compare rejeita senha incorreta', async () => {
  const hash = await bcrypt.hash('minhaSenha123', CUSTO_TESTE)
  assert.equal(await bcrypt.compare('senhaErrada', hash), false)
})

test('duas senhas iguais geram hashes diferentes (salt aleatório por chamada)', async () => {
  const hashA = await bcrypt.hash('mesmaSenha', CUSTO_TESTE)
  const hashB = await bcrypt.hash('mesmaSenha', CUSTO_TESTE)

  assert.notEqual(hashA, hashB)
  assert.equal(await bcrypt.compare('mesmaSenha', hashA), true)
  assert.equal(await bcrypt.compare('mesmaSenha', hashB), true)
})
