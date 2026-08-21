require('dotenv/config')
require('./config/validarEnv')()
const app = require('./app')
const logger = require('./config/logger')

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  logger.info(`API rodando em http://localhost:${PORT}`)
})
