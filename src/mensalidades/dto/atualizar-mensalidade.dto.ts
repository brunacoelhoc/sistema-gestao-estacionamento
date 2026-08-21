import { IsIn, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator'

export class AtualizarMensalidadeDto {
  @IsIn(['pendente', 'paga', 'cancelada'], { message: 'Status inválido. Use pendente, paga ou cancelada.' })
  status!: string

  @IsOptional()
  @IsIn(['pix', 'cartao_credito', 'cartao_debito', 'dinheiro'])
  formaPagamento?: string | null

  // Obrigatório só ao cancelar — é a justificativa que alimenta o relatório
  // de motivos de perda em Faturamento.
  @ValidateIf(o => o.status === 'cancelada')
  @IsString({ message: 'Informe o motivo do cancelamento.' })
  @IsNotEmpty({ message: 'Informe o motivo do cancelamento.' })
  motivoCancelamento?: string
}
