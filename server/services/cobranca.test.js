const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  TEMPO_TOLERANCIA_MINUTOS,
  VALOR_HORA_PADRAO,
  calcularTarifaAvulsa
} = require('./cobranca')

test('dentro da tolerância de cortesia não cobra nada', () => {
  const valor = calcularTarifaAvulsa(TEMPO_TOLERANCIA_MINUTOS, 20)
  assert.equal(valor, 0)
})

test('um minuto além da tolerância já cobra a primeira hora cheia', () => {
  const valor = calcularTarifaAvulsa(TEMPO_TOLERANCIA_MINUTOS + 1, 20)
  assert.equal(valor, 20)
})

test('hora quebrada é sempre arredondada para cima', () => {
  const valor = calcularTarifaAvulsa(61, 10)
  assert.equal(valor, 20)
})

test('permanência de exatas 2 horas cobra só 2 horas', () => {
  const valor = calcularTarifaAvulsa(120, 10)
  assert.equal(valor, 20)
})

test('sem valorHora informado, usa o valor padrão', () => {
  const valor = calcularTarifaAvulsa(90, undefined)
  assert.equal(valor, 2 * VALOR_HORA_PADRAO)
})
