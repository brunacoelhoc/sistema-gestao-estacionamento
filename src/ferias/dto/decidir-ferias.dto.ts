import { IsIn } from 'class-validator'

export class DecidirFeriasDto {
  @IsIn(['aprovada', 'rejeitada'])
  status!: 'aprovada' | 'rejeitada'
}
