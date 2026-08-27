import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator'
import { IsDiasEscalaValidos } from '../../common/dias-escala-validos.decorator'

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

// Um único DTO "definir" (não Criar/Atualizar separados): PATCH /rh-perfil/:id
// faz upsert — RH sempre reenvia o perfil completo, seja cadastrando pela
// primeira vez ou editando depois. Evita a ambiguidade de um PATCH parcial
// num upsert (o que fazer com campos obrigatórios ausentes na criação?).
export class DefinirPerfilRhDto {
  @IsString({ message: 'Cargo é obrigatório.' })
  @IsNotEmpty({ message: 'Cargo é obrigatório.' })
  @Transform(trim)
  cargo!: string

  @IsNumber({}, { message: 'Salário-base é obrigatório.' })
  @Min(0, { message: 'Salário-base não pode ser negativo.' })
  salarioBase!: number

  @IsOptional()
  @IsIn(['clt', 'pj'])
  tipoContrato?: string

  @IsString({ message: 'Data de admissão é obrigatória.' })
  @IsNotEmpty({ message: 'Data de admissão é obrigatória.' })
  dataAdmissao!: string

  @IsOptional()
  @IsString()
  dataDemissao?: string | null

  @IsDiasEscalaValidos()
  diasEscala!: number[]

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Horas por dia deve ser pelo menos 1.' })
  @Max(12, { message: 'Horas por dia não pode passar de 12.' })
  horasPorDia?: number

  // Horário previsto de entrada nos dias de escala — usado pelo cálculo de
  // ponto pra apurar atraso (tolerância de 20min) e hora extra.
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Horário de início deve estar no formato HH:mm.' })
  horaInicioEscala?: string

  @IsString({ message: 'Banco é obrigatório.' })
  @IsNotEmpty({ message: 'Banco é obrigatório.' })
  @Transform(trim)
  bancoNome!: string

  @IsString({ message: 'Agência é obrigatória.' })
  @IsNotEmpty({ message: 'Agência é obrigatória.' })
  @Transform(trim)
  agencia!: string

  @IsString({ message: 'Conta bancária é obrigatória.' })
  @IsNotEmpty({ message: 'Conta bancária é obrigatória.' })
  @Transform(trim)
  contaBancaria!: string

  // Opcionais: perfis existentes não tinham esses campos antes de existirem
  // — RH preenche quando quiser, sem forçar re-cadastro imediato de todo
  // mundo. Texto livre, um item por linha (o front separa em lista).
  @IsOptional()
  @IsString()
  @Transform(trim)
  direitos?: string

  @IsOptional()
  @IsString()
  @Transform(trim)
  deveres?: string

  @IsOptional()
  @IsString()
  @Transform(trim)
  tarefas?: string

  // Únicos itens de benefício que variam por funcionário — o resto da lista
  // de benefícios é política fixa da empresa, igual para todos (ver
  // contrato-trabalho.pdf.ts/BENEFICIOS), não é dado de perfil.
  @IsOptional()
  @IsIn(['vale_transporte', 'vale_combustivel', 'nenhum'])
  tipoValeTransporte?: string

  @IsOptional()
  @IsNumber({}, { message: 'Bônus por desempenho deve ser numérico.' })
  @Min(0, { message: 'Bônus por desempenho não pode ser negativo.' })
  bonusDesempenho?: number

  @IsOptional()
  @IsString()
  @Transform(trim)
  observacoesBeneficios?: string

  @IsOptional()
  @IsString()
  etapaCarreiraAtualId?: string | null

  // Vaga/processo seletivo que originou a contratação — texto livre, mesma
  // lógica de direitos/deveres/tarefas.
  @IsOptional()
  @IsString()
  @Transform(trim)
  vagaOrigem?: string

  // A quem o funcionário responde diretamente. null explícito remove o
  // vínculo (RH reenvia o perfil inteiro no PATCH — ver comentário da classe).
  @IsOptional()
  @IsString()
  gestorId?: string | null
}
