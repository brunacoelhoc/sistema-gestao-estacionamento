import { IsNotEmpty, Matches, MaxLength } from 'class-validator'

// Mesmo critério de validação já usado pro avatar (ver AtualizarUsuarioDto):
// só aceita data URI de imagem, com limite de tamanho. Sem isso, o campo
// aceitava qualquer string e era renderizado sem escape em `<img src="...">`
// no comprovante assinado.
export class CadastrarAssinaturaDto {
  @IsNotEmpty({ message: 'Assinatura é obrigatória.' })
  @MaxLength(300000, { message: 'Assinatura inválida.' })
  @Matches(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/, { message: 'Assinatura inválida.' })
  imagemDataUri!: string
}
