// Único lugar que define "quem enxerga dado de RH de terceiros" (ponto,
// férias, perfil de RH, folha de pagamento). Antes da introdução do papel
// `gestor`, vários services testavam só `role !== 'funcionario'` pra liberar
// acesso a dado de terceiro — funcionava enquanto só existiam 2 papéis, mas
// deixaria `gestor` (que só deveria ver funcionários + desempenho, nunca
// ponto/férias/salário de terceiros) passar pela mesma checagem por engano.
// Daí centralizar num allowlist explícito, não num "not X".
export function ehGestaoDeRh (role: string): boolean {
  return role === 'admin' || role === 'rh'
}
