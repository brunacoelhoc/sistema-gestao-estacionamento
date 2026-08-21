import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator'

export class EventoDto {
  @IsIn(['visualizacao', 'tempo-na-tela'])
  tipo!: string

  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  @MaxLength(200)
  tela!: string

  @IsOptional()
  @IsInt()
  @Min(0)
  duracaoMs?: number | null

  @IsNumber()
  quando!: number
}

export class RegistrarEventosDto {
  @ValidateNested({ each: true })
  @Type(() => EventoDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  eventos!: EventoDto[]
}
