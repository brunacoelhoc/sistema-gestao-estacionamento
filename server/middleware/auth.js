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

// Bloqueia rotas de negócio para contas criadas via Google que ainda não
// completaram o cadastro com um CPF válido (ver POST /usuarios/:id e
// views/completar-cadastro.html). `codigo` permite o front-end distinguir
// este 403 de um 403 genérico (ex.: requireAdmin) e redirecionar para a tela
// de conclusão de cadastro em vez de só mostrar um erro.
function requireProfileComplete (req, res, next) {
  if (req.usuario?.cpfPendente) {
    return res.status(403).json({
      erro: 'Cadastro incompleto: informe seu CPF para continuar.',
      codigo: 'PERFIL_INCOMPLETO'
    })
  }
  next()
}

module.exports = { requireAuth, requireAdmin, requireProfileComplete }
