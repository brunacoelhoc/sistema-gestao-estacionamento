import 'reflect-metadata'
import 'dotenv/config'
import helmet from 'helmet'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { validationExceptionFactory } from './common/validation-exception-factory'
import { logger } from './config/logger'

async function bootstrap () {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true })

  // CORS_ORIGIN (opcional): lista de origens separadas por vírgula. Sem essa
  // variável a API aceita qualquer origem — cômodo em dev (o front roda via
  // Live Server em porta variável), mas deve ser configurada em produção.
  const origensPermitidas = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origem => origem.trim())
    : null

  if (!origensPermitidas && process.env.NODE_ENV === 'production') {
    logger.warn('[CORS] CORS_ORIGIN não configurado em produção — aceitando requisições de qualquer origem.')
  }

  app.use(helmet())
  app.use(cors(origensPermitidas ? { origin: origensPermitidas } : undefined))
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
  app.useGlobalFilters(new HttpExceptionFilter())
  app.enableShutdownHooks()

  const port = process.env.PORT || 3001
  await app.listen(port)
  logger.info(`[Boot] API rodando na porta ${port}`)
}

bootstrap()
