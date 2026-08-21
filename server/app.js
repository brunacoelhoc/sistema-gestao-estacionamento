require('dotenv/config')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const pinoHttp = require('pino-http')

const logger = require('./config/logger')
const authRoutes = require('./routes/auth')
const usuariosRoutes = require('./routes/usuarios')
const mensalistasRoutes = require('./routes/mensalistas')
const mensalidadesRoutes = require('./routes/mensalidades')
const vagasRoutes = require('./routes/vagas')
const tarifasRoutes = require('./routes/tarifas')
const ticketsRoutes = require('./routes/tickets')
const analyticsRoutes = require('./routes/analytics')

const app = express()

// CORS_ORIGIN (opcional): lista de origens separadas por vírgula. Sem essa
// variável a API aceita qualquer origem — cômodo em dev (o front roda via
// Live Server em porta variável). Em produção, sem CORS_ORIGIN configurado,
// a API passa a NEGAR requisições cross-origin em vez de aceitar qualquer
// uma — `cors()` sem opções reflete qualquer Origin (equivalente a
// `Access-Control-Allow-Origin: *`), o que é seguro demais pra abrir mão só
// porque ninguém configurou a variável.
const origensPermitidas = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origem => origem.trim())
  : null

const emProducao = process.env.NODE_ENV === 'production'
if (!origensPermitidas && emProducao) {
  logger.warn('[CORS] CORS_ORIGIN não configurado em produção — bloqueando requisições cross-origin até ser configurado.')
}

app.use(helmet())
app.use(cors(
  origensPermitidas
    ? { origin: origensPermitidas }
    : (emProducao ? { origin: false } : undefined)
))
app.use(express.json())
// serializers customizados: o padrão do pino-http despeja todos os headers
// de request/response em toda linha, o que afoga o log útil (método, rota,
// status, usuário, duração) em ruído.
app.use(pinoHttp({
  logger,
  customProps: req => ({ usuarioId: req.usuario?.id || null }),
  serializers: {
    req: req => ({ method: req.method, url: req.url }),
    res: res => ({ statusCode: res.statusCode })
  }
}))

app.get('/health', (req, res) => res.json({ ok: true }))

app.use('/auth', authRoutes)
app.use('/usuarios', usuariosRoutes)
app.use('/mensalistas', mensalistasRoutes)
app.use('/mensalidades', mensalidadesRoutes)
app.use('/vagas', vagasRoutes)
app.use('/tarifas', tarifasRoutes)
app.use('/tickets', ticketsRoutes)
app.use('/analytics', analyticsRoutes)

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' })
})

app.use((erro, req, res, next) => {
  ;(req.log || logger).error({ err: erro }, 'Erro não tratado na API')

  // Só devolvemos erro.message pro cliente quando ele foi lançado de propósito
  // pelo nosso próprio código (erro.status setado, ver server/controllers/tickets.js).
  // Erros inesperados (ex.: exceções do Prisma/driver do Postgres) chegam sem
  // `.status` e podem trazer caminho de arquivo do servidor na mensagem —
  // nesses casos respondemos algo genérico e deixamos o detalhe só no log.
  const status = erro.status || 500
  const mensagem = erro.status ? erro.message : 'Erro interno do servidor.'
  res.status(status).json({ erro: mensagem })
})

module.exports = app
