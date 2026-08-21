import 'reflect-metadata'
import 'dotenv/config'
import helmet from 'helmet'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { validationExceptionFactory } from './common/validation-exception-factory'
import { createLogger } from './config/logger'

async function bootstrap () {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true })
  const configService = app.get(ConfigService)
  const logger = createLogger(configService)

  // CORS_ORIGIN (opcional): lista de origens separadas por vírgula. Sem essa
  // variável a API aceita qualquer origem — cômodo em dev (o front roda via
  // Live Server em porta variável). Em produção, sem CORS_ORIGIN configurado,
  // a API passa a NEGAR requisições cross-origin em vez de aceitar qualquer
  // uma — `cors()` sem opções reflete qualquer Origin (equivalente a
  // `Access-Control-Allow-Origin: *`), o que é seguro demais pra abrir mão só
  // porque ninguém configurou a variável.
  const corsOrigin = configService.get<string>('CORS_ORIGIN')
  const origensPermitidas = corsOrigin
    ? corsOrigin.split(',').map(origem => origem.trim())
    : null

  const emProducao = configService.get<string>('NODE_ENV') === 'production'
  if (!origensPermitidas && emProducao) {
    logger.warn('[CORS] CORS_ORIGIN não configurado em produção — bloqueando requisições cross-origin até ser configurado.')
  }

  // Limite padrão do Express (100kb) é curto demais pro anexo de
  // comprovante em Mensalidade, que viaja como data URI base64 no corpo do
  // PATCH — 6mb dá margem confortável pra um arquivo de até uns 4mb (o
  // encode base64 acrescenta ~33% de overhead), sem abrir espaço demais
  // pra abuso de payload.
  app.useBodyParser('json', { limit: '6mb' })

  app.use(helmet())
  app.use(cors(
    origensPermitidas
      ? { origin: origensPermitidas }
      : (emProducao ? { origin: false } : undefined)
  ))
  // serializers customizados: o padrão do pino-http despeja todos os headers
  // de request/response em toda linha, o que afoga o log útil (método, rota,
  // status, usuário, duração) em ruído.
  app.use(pinoHttp({
    logger,
    customProps: (req: any) => ({ usuarioId: req.usuario?.id || null }),
    serializers: {
      req: (req: any) => ({ method: req.method, url: req.url }),
      res: (res: any) => ({ statusCode: res.statusCode })
    }
  }))

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: validationExceptionFactory
  }))
  app.useGlobalFilters(new HttpExceptionFilter(logger))
  app.enableShutdownHooks()

  const port = configService.get<string>('PORT', '3001')
  await app.listen(port)
  logger.info(`[Boot] API rodando na porta ${port}`)
}

bootstrap()
