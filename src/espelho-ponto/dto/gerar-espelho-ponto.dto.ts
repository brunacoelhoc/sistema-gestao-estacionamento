import { IsNotEmpty, IsString, Matches } from 'class-validator'

export class GerarEspelhoPontoDto {
  @IsString({ message: 'Funcionário é obrigatório.' })
  @IsNotEmpty({ message: 'Funcionário é obrigatório.' })
  usuarioId!: string

  @Matches(/^\d{4}-\d{2}$/, { message: 'Referência deve estar no formato YYYY-MM.' })
  referencia!: string
}
