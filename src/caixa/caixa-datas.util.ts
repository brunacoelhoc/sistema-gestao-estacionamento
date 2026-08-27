// Mesmo padrão de RegistroPonto.data (ver src/ponto/ponto-datas.util.ts):
// meia-noite local representando "o dia", sem hora associada. Só para Date
// construído localmente nesta mesma execução (ex.: dataSemHora(new Date())).
export function dataSemHora (data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate())
}

// Colunas @db.Date (CaixaDiario.data) voltam do Postgres como meia-noite UTC
// do dia gravado, não meia-noite local (mesmo comportamento documentado em
// ponto-datas.util.ts) — por isso o intervalo do dia usa getters UTC quando
// a Date vem do banco, não getters locais (que podem retroceder um dia em
// fuso atrás de UTC).
export function rangeDoDiaDoBanco (dataDoBanco: Date): { inicio: Date, fim: Date } {
  const inicio = new Date(Date.UTC(dataDoBanco.getUTCFullYear(), dataDoBanco.getUTCMonth(), dataDoBanco.getUTCDate()))
  const fim = new Date(Date.UTC(dataDoBanco.getUTCFullYear(), dataDoBanco.getUTCMonth(), dataDoBanco.getUTCDate() + 1))
  return { inicio, fim }
}
