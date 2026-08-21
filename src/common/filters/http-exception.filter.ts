import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { Logger } from 'pino'

/**
 * Reescreve toda resposta de erro para o formato { erro: string, ...extra }
 * que o front-end (assets/js/models/api.js) espera — o Nest por padrão
 * devolve { statusCode, message, error }, incompatível com o contrato já
 * existente (ex.: leitura de `codigo` para o fluxo de perfil incompleto).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor (private readonly logger: Logger) {}

  catch (exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()

      let corpo: Record<string, unknown>
      if (typeof body === 'string') {
        corpo = { erro: body }
      } else {
        const objeto = body as Record<string, unknown>
        // ValidationPipe (via exceptionFactory) e exceções de negócio lançam
        // BadRequestException/ForbiddenException etc. com `message` — outras
        // (ex.: ProfileCompleteGuard) já lançam o objeto { erro, codigo }
        // pronto, que deve passar direto.
        // 404 "de fábrica" do Express/Nest para rota sem handler nenhum
        // (ex.: "Cannot GET /xyz") — normaliza pra mesma mensagem estática
        // que a API Express usava, em vez de vazar o formato interno da rota.
        const eNotFoundPadrao = status === HttpStatus.NOT_FOUND &&
          typeof objeto.message === 'string' && /^Cannot [A-Z]+ /.test(objeto.message)

        const mensagem = eNotFoundPadrao
          ? 'Rota não encontrada.'
          : typeof objeto.erro === 'string'
            ? objeto.erro
            : (typeof objeto.message === 'string' ? objeto.message : 'Erro na requisição.')
        const { message: _mensagemDescartada, statusCode: _statusDescartado, error: _erroDescartado, ...resto } = objeto
        corpo = { erro: mensagem, ...resto }
      }

      response.status(status).json(corpo)
      return
    }

    // Erro inesperado (ex.: exceção crua do Prisma/driver do Postgres) — não
    // devolvemos a mensagem original pro cliente (pode vazar detalhe interno
    // do servidor), só logamos com detalhe e respondemos algo genérico.
    ;(request as any).log?.error({ err: exception }, 'Erro não tratado na API') ?? this.logger.error({ err: exception }, 'Erro não tratado na API')
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ erro: 'Erro interno do servidor.' })
  }
}
