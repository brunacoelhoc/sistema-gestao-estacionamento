export function mascararCpf (cpf: string | null | undefined): string | null {
  if (!cpf) return null
  const digitos = cpf.replace(/\D/g, '')
  if (digitos.length < 4) return '***.***.***-**'
  return `***.***.**${digitos.slice(-4, -2)}-${digitos.slice(-2)}`
}
