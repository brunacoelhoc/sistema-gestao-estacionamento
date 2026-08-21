import { BadRequestException } from '@nestjs/common'
import type { ValidationError } from '@nestjs/common'

// Reproduz o comportamento do antigo middleware validar() (Zod): devolve só
// a mensagem do primeiro campo inválido, não a lista inteira de violações
// que o class-validator gera por padrão.
function primeiraMensagem (erros: ValidationError[]): string {
  for (const erro of erros) {
    if (erro.constraints) {
      const mensagens = Object.values(erro.constraints)
      if (mensagens[0]) return mensagens[0]
    }
    if (erro.children && erro.children.length > 0) {
      const mensagem = primeiraMensagem(erro.children)
      if (mensagem) return mensagem
    }
  }
  return 'Dados inválidos.'
}

export function validationExceptionFactory (erros: ValidationError[]) {
  return new BadRequestException(primeiraMensagem(erros))
}
