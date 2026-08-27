// Utilitários de data/hora do módulo de ponto. Tudo em horário local do
// servidor (mesmo critério simplificado já usado no resto do projeto — ver
// formatarDataBr no front, que também não normaliza fuso horário à parte).

export const TOLERANCIA_ATRASO_MINUTOS = 20

export function dataSemHora (data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate())
}

export function chaveDataLocal (data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

// Colunas @db.Date (RegistroPonto.data, SolicitacaoTrabalhoExtra.data)
// voltam do Postgres/@prisma/adapter-pg como meia-noite UTC do dia gravado
// (confirmado empiricamente: um Date de meia-noite LOCAL gravado é lido de
// volta como "AAAA-MM-DDT00:00:00.000Z"). Em fuso atrás de UTC (ex.:
// America/Sao_Paulo, UTC-3), ler esse valor com getters locais (getDate())
// retrocede um dia. Por isso: getters UTC para Date vindo do banco,
// chaveDataLocal (getters locais) só para Date construído localmente nesta
// mesma execução (loop de dias, dataSemHora(new Date()), parseDataLocal).
export function chaveDataDoBanco (data: Date): string {
  const ano = data.getUTCFullYear()
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(data.getUTCDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

// "YYYY-MM-DD" -> meia-noite local (não usar `new Date(string)` direto: o
// parser ISO trata a string como UTC, o que pode voltar um dia por causa do
// fuso do servidor).
export function parseDataLocal (chaveData: string): Date {
  const [ano, mes, dia] = chaveData.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

export function combinarDataHora (chaveData: string, horaMinuto: string): Date {
  const [ano, mes, dia] = chaveData.split('-').map(Number)
  const [hora, minuto] = horaMinuto.split(':').map(Number)
  return new Date(ano, mes - 1, dia, hora, minuto)
}

export function diferencaEmMinutos (a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 60000
}

// Nunca negativo: um horário de saída anterior ao de início considerado
// (dado inconsistente/relógio) não deve gerar horas negativas no cálculo.
export function diferencaEmHoras (fim: Date, inicio: Date): number {
  return Math.max(0, (fim.getTime() - inicio.getTime()) / 3600000)
}

export function arredondar2 (numero: number): number {
  return Math.round(numero * 100) / 100
}
