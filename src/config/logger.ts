import type { ConfigService } from '@nestjs/config'
import pino from 'pino'

export function createLogger (configService: ConfigService) {
  const nodeEnv = configService.get<string>('NODE_ENV')
  return pino({
    level: configService.get<string>('LOG_LEVEL', 'info'),
    transport: nodeEnv === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' }
        }
  })
}
