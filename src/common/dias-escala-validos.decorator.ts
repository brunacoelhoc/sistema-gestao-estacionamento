import { registerDecorator, type ValidationOptions } from 'class-validator'

// Escala fixa do estacionamento: o pátio funciona 24/7 com equipes de 4 dias
// revezando os 7 dias da semana, então cada funcionário cobre exatamente 4
// dias fixos (0=domingo … 6=sábado, sem repetição) — ver PerfilRH.diasEscala.
export const MENSAGEM_DIAS_ESCALA_INVALIDOS =
  'Informe exatamente 4 dias da semana (0=domingo … 6=sábado), sem repetição.'

export function IsDiasEscalaValidos (validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDiasEscalaValidos',
      target: object.constructor,
      propertyName,
      options: { message: MENSAGEM_DIAS_ESCALA_INVALIDOS, ...validationOptions },
      validator: {
        validate (valor: unknown) {
          if (!Array.isArray(valor) || valor.length !== 4) return false
          if (!valor.every(dia => Number.isInteger(dia) && dia >= 0 && dia <= 6)) return false
          return new Set(valor).size === 4
        }
      }
    })
  }
}
