import { Matches } from 'class-validator'

export class SolicitarFeriasDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de início deve estar no formato YYYY-MM-DD.' })
  dataInicio!: string

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de fim deve estar no formato YYYY-MM-DD.' })
  dataFim!: string
}
