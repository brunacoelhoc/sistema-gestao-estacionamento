import { IsNotEmpty, IsString } from 'class-validator'

export class GoogleDto {
  @IsString({ message: 'Não foi possível ler os dados da conta Google.' })
  @IsNotEmpty({ message: 'Não foi possível ler os dados da conta Google.' })
  credential!: string
}
