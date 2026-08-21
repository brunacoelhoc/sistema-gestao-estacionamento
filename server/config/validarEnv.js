// Confere as variáveis de ambiente obrigatórias antes de qualquer outra coisa
// subir (rotas, Prisma, etc.). Sem isso, a API sobe "normalmente" e só falha
// de forma confusa na primeira requisição que precisar de JWT_SECRET ou
// DATABASE_URL — preferível recusar o boot com um erro claro.
const OBRIGATORIAS = ['JWT_SECRET', 'DATABASE_URL']

function validarEnv () {
  const faltando = OBRIGATORIAS.filter(nome => !process.env[nome])
  if (faltando.length > 0) {
    // Usa console.error (não o logger) de propósito: validarEnv roda antes do
    // require('./logger') em index.js, e falhar o boot aqui não deve depender
    // de mais nenhum módulo ter carregado com sucesso.
    console.error(
      `[Boot] Variáveis de ambiente obrigatórias ausentes: ${faltando.join(', ')}. ` +
      'Configure o arquivo .env (veja .env.example) antes de iniciar o servidor.'
    )
    process.exit(1)
  }
}

module.exports = validarEnv
