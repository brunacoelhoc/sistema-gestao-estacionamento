import { Expose, Transform, Type } from 'class-transformer'
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class AtualizarTarifaDto {
  @IsOptional()
  @IsString({ message: 'Categoria é obrigatória.' })
  @IsNotEmpty({ message: 'Categoria é obrigatória.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  categoria?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valor?: number

  // @Expose() é necessário aqui: sem ela, o class-transformer só roda o
  // @Transform de uma propriedade que exista no payload de origem — como
  // quem chega é `valor`, não `valorHora`, o alias nunca rodaria.
  @IsOptional()
  @Expose()
  @Transform(({ obj }) => {
    const bruto = obj.valorHora ?? obj.valor
    return bruto === undefined || bruto === null || bruto === '' ? bruto : Number(bruto)
  })
  @IsNumber({}, { message: 'Valor por hora é obrigatório.' })
  @Min(0, { message: 'Valor por hora não pode ser negativo.' })
  valorHora?: number
}
