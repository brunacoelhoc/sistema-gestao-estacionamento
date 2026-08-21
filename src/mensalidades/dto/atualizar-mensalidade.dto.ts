import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator'

// SVG fica de fora de propósito — data URI de SVG pode carregar <script>
// embutido, e o anexo é reaberto depois numa nova aba sem sanitização.
// Âncora no fim (com $) é essencial: sem ela, bastava a string COMEÇAR com o
// prefixo esperado para passar, deixando qualquer coisa (inclusive HTML/JS)
// entrar depois — o valor é reaberto cru no front (ver anexo-comprovante.js).
const REGEX_ANEXO_COMPROVANTE = /^data:(image\/(png|jpe?g|webp)|application\/pdf);base64,[A-Za-z0-9+/]+={0,2}$/

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

  // Comprovante de pagamento (opcional) — data URI base64 de imagem ou PDF,
  // anexado na baixa manual. Tamanho já limitado no corpo da requisição
  // (ver app.useBodyParser em main.ts); o MaxLength aqui é só uma segunda
  // trava, redundante de propósito.
  @IsOptional()
  @IsString()
  @Matches(REGEX_ANEXO_COMPROVANTE, { message: 'Anexo deve ser uma imagem (PNG/JPEG/WEBP) ou PDF.' })
  @MaxLength(6_000_000, { message: 'Arquivo do comprovante é grande demais.' })
  comprovanteAnexo?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  comprovanteNomeArquivo?: string
}
