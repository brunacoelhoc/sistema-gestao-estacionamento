import { IsIn } from 'class-validator'

export class DecidirTrabalhoExtraDto {
  @IsIn(['aprovada', 'rejeitada'])
  status!: 'aprovada' | 'rejeitada'
}
