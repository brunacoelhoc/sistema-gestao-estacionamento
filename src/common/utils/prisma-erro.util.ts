import { Prisma } from '../../../generated/prisma'

// P2002 = violação de constraint @unique (ex.: CPF/placa/e-mail duplicado).
export function ehConflitoUnico (erro: unknown): erro is Prisma.PrismaClientKnownRequestError {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002'
}

// P2003 = violação de FK detectada pelo Prisma no formato padrão. Com o
// driver adapter do Postgres (@prisma/adapter-pg), porém, esse tipo de erro
// costuma chegar embrulhado em meta.driverAdapterError, com o código
// original do Postgres em cause.originalCode (23001 = restrict_violation,
// 23503 = foreign_key_violation) — ver comentário de origem em
// MensalistasService.remover.
export function ehViolacaoRestricaoFk (erro: unknown): boolean {
  if (!(erro instanceof Prisma.PrismaClientKnownRequestError)) return false
  const meta = erro.meta as { driverAdapterError?: { cause?: { originalCode?: string } } } | undefined
  const codigoPostgres = meta?.driverAdapterError?.cause?.originalCode
  return erro.code === 'P2003' || codigoPostgres === '23001' || codigoPostgres === '23503'
}
