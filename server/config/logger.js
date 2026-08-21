const pino = require('pino')

// Logs em texto colorido no terminal durante o desenvolvimento; em produção
// (NODE_ENV=production) sai JSON puro, uma linha por evento, pronto para ser
// coletado por qualquer agregador de log (CloudWatch, Loki, etc.).
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production'
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' }
      }
})

module.exports = logger
