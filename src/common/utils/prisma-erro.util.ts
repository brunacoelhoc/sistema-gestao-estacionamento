import { Prisma } from '../../../generated/prisma'

// P2002 = violação de constraint @unique (ex.: CPF/placa/e-mail duplicado).
export function ehConflitoUnico (erro: unknown): erro is Prisma.PrismaClientKnownRequestError {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002'
}
