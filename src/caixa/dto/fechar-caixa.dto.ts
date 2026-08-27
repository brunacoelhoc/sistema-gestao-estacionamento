import { Transform, Type } from 'class-transformer'
import { IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class FecharCaixaDto {
  // Valor contado fisicamente ao fechar — comparado no backend contra
  // valorEsperadoFechamento para apurar sobra/falta (ver CaixaService.fechar).
  @IsNumber({}, { message: 'Informe o valor contado em caixa.' })
  @Min(0, { message: 'O valor em caixa não pode ser negativo.' })
  @Type(() => Number)
  valorFechamento!: number

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  observacoes?: string
}
