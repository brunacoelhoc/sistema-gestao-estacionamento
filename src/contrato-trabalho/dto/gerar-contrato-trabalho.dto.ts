import { IsNotEmpty, IsString } from 'class-validator'

export class GerarContratoTrabalhoDto {
  @IsString({ message: 'Funcionário é obrigatório.' })
  @IsNotEmpty({ message: 'Funcionário é obrigatório.' })
  usuarioId!: string
}
