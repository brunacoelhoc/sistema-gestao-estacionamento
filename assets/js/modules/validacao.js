/**
 * Validação/máscara de placa reaproveitada pelas telas de Mensalistas e
 * Tickets (antes duplicada em cada controller) — mesmo critério de formato
 * usado na validação equivalente do backend (ver IsPlacaValida em
 * src/common/placa-valida.decorator.ts). A validação/máscara de CPF já
 * vive em assets/js/modules/auth.js (ligarMascaraCpf/validarEstruturaCpf),
 * carregado em toda página autenticada.
 */

// Algoritmo de Validação de Placa (Mercosul ou Padrão Antigo)
function validarPlaca (placa) {
  const placaLimpa = (placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const regexAntigo = /^[A-Z]{3}[0-9]{4}$/
  const regexMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/
  return regexAntigo.test(placaLimpa) || regexMercosul.test(placaLimpa)
}

// Máscara simples de input de placa: só maiúsculas/números, até 7 caracteres.
function ligarMascaraPlaca (idInput) {
  const input = document.getElementById(idInput)
  if (!input) return
  input.addEventListener('input', e => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (value.length > 7) value = value.slice(0, 7)
    e.target.value = value
  })
}

window.validarPlaca = validarPlaca
window.ligarMascaraPlaca = ligarMascaraPlaca
