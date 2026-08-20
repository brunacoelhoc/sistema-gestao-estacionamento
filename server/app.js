require('dotenv/config')
const express = require('express')
const cors = require('cors')

const authRoutes = require('./routes/auth')
const usuariosRoutes = require('./routes/usuarios')
const mensalistasRoutes = require('./routes/mensalistas')
const mensalidadesRoutes = require('./routes/mensalidades')
const vagasRoutes = require('./routes/vagas')
const tarifasRoutes = require('./routes/tarifas')
const ticketsRoutes = require('./routes/tickets')

const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => res.json({ ok: true }))

app.use('/auth', authRoutes)
app.use('/usuarios', usuariosRoutes)
app.use('/mensalistas', mensalistasRoutes)
app.use('/mensalidades', mensalidadesRoutes)
app.use('/vagas', vagasRoutes)
app.use('/tarifas', tarifasRoutes)
app.use('/tickets', ticketsRoutes)

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' })
})

// eslint-disable-next-line no-unused-vars
app.use((erro, req, res, next) => {
  console.error('[API Error]', erro)
  res.status(erro.status || 500).json({ erro: erro.message || 'Erro interno do servidor.' })
})

module.exports = app
