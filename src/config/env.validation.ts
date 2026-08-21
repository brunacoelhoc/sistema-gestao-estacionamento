const OBRIGATORIAS = ['JWT_SECRET', 'DATABASE_URL']

// Confere as variáveis de ambiente obrigatórias antes de qualquer outra
// coisa subir (rotas, Prisma, etc.). Sem isso, a API sobe "normalmente" e só
// falha de forma confusa na primeira requisição que precisar de JWT_SECRET
// ou DATABASE_URL — preferível recusar o boot com um erro claro.
export function validate (config: Record<string, unknown>) {
  const faltando = OBRIGATORIAS.filter(nome => !config[nome])
  if (faltando.length > 0) {
    console.error(
      `[Boot] Variáveis de ambiente obrigatórias ausentes: ${faltando.join(', ')}. ` +
      'Configure o arquivo .env (veja .env.example) antes de iniciar o servidor.'
    )
    process.exit(1)
  }
  return config
}
