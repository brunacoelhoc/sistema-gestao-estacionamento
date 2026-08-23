import { Matches } from 'class-validator'

// Só valida o FORMATO que o front sempre envia (máscara aplicada em
// ligarMascaraCpf/initInputMasks: "000.000.000-00"), sem cálculo de dígito
// verificador — mesmo critério já usado no cliente (ver validarEstruturaCpf
// em assets/js/modules/auth.js e validarCPF em mensalistas.js). Sem isso, uma
// chamada direta à API podia gravar um CPF fora desse formato.
export const MENSAGEM_CPF_INVALIDO = 'CPF deve estar no formato 000.000.000-00.'

export function IsCpfValido () {
  return Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, { message: MENSAGEM_CPF_INVALIDO })
}
