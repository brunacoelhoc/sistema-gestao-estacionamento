import { IsIn, IsOptional } from 'class-validator'

export class AtualizarMensalidadeDto {
  @IsIn(['pendente', 'paga', 'cancelada'], { message: 'Status inválido. Use pendente, paga ou cancelada.' })
  status!: string

  @IsOptional()
  @IsIn(['pix', 'cartao_credito', 'cartao_debito', 'dinheiro'])
  formaPagamento?: string | null
}
