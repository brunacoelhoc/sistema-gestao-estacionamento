import { IsIn } from 'class-validator'

export class MoverItemPdiDto {
  @IsIn(['cima', 'baixo'])
  direcao!: 'cima' | 'baixo'
}
