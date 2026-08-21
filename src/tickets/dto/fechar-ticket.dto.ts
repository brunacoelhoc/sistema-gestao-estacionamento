import { Transform } from 'class-transformer'
import { IsOptional, IsString, MinLength } from 'class-validator'

export class FecharTicketDto {
  // Mesmo motivo do AbrirTicketDto: ApiService.fecharTicket manda
  // `formaPagamento: null` por padrão quando a tela não escolhe uma forma
  // de pagamento específica.
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  formaPagamento?: string | null
}
