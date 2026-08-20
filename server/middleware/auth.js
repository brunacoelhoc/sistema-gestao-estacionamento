const jwt = require('jsonwebtoken')

function requireAuth (req, res, next) {
  const [, token] = (req.headers.authorization || '').split(' ')
  if (!token) {
    return res.status(401).json({ erro: 'Token de autenticação ausente.' })
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch (erro) {
    return res.status(401).json({ erro: 'Token de autenticação inválido ou expirado.' })
  }
}

function requireAdmin (req, res, next) {
  if (req.usuario?.role !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' })
  }
  next()
}

module.exports = { requireAuth, requireAdmin }
