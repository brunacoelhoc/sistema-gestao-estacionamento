// Valida req.body contra um schema Zod antes do controller rodar. Em caso de
// erro, devolve 400 com a mensagem do primeiro campo inválido — consistente
// entre todas as rotas, em vez de cada controller escrever sua própria
// checagem manual (`if (!campo) ...`) com texto e formato diferentes.
function validar (schema) {
  return (req, res, next) => {
    const resultado = schema.safeParse(req.body)
    if (!resultado.success) {
      const primeiraMensagem = resultado.error.issues[0]?.message || 'Dados inválidos.'
      return res.status(400).json({ erro: primeiraMensagem })
    }
    req.body = resultado.data
    next()
  }
}

module.exports = validar
