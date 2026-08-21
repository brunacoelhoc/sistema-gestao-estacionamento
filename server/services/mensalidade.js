/**
 * Regra de cobrança do mensalista: ele não paga por ticket — paga um ciclo de
 * 30 dias corridos, cobrado de uma vez só na primeira entrada em que não há
 * ciclo vigente (não no cadastro, nem no dia 1 de cada mês calendário). A
 * partir daí, todo ticket que cair dentro desses 30 dias sai isento; quando o
 * ciclo vence, a próxima entrada abre (e cobra) um novo, contando mais 30
 * dias a partir dela.
 */
const mensalidadeRepository = require('../repositories/mensalidadeRepository')

const DURACAO_CICLO_DIAS = 30

function referenciaDe (data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}-${mes}`
}

function calcularFimCiclo (dataInicio) {
  const fim = new Date(dataInicio)
  fim.setDate(fim.getDate() + DURACAO_CICLO_DIAS)
  return fim
}

// Ciclo mais recente do mensalista que ainda cobre a data informada (a data
// de entrada do ticket sendo fechado, normalmente) — null se ele nunca teve
// um ciclo, ou se o último já venceu antes dessa data.
function buscarCicloVigente (tx, mensalistaId, dataReferencia) {
  return mensalidadeRepository.buscarVigente(mensalistaId, dataReferencia, tx)
}

// Abre e já marca como paga (o pagamento acontece na hora, junto do
// fechamento do ticket que disparou a abertura — não existe um estado
// "pendente" intermediário como no modelo antigo por mês calendário).
function abrirNovoCiclo (tx, mensalista, dataInicio, formaPagamento) {
  const dataFim = calcularFimCiclo(dataInicio)

  return mensalidadeRepository.criar({
    mensalistaId: mensalista.id,
    referencia: referenciaDe(dataInicio),
    dataInicio,
    dataFim,
    diasCobrados: DURACAO_CICLO_DIAS,
    diasNoMes: DURACAO_CICLO_DIAS,
    valor: Number(mensalista.valorMensalidade || 0),
    status: 'paga',
    formaPagamento
  }, tx)
}

module.exports = {
  DURACAO_CICLO_DIAS,
  referenciaDe,
  calcularFimCiclo,
  buscarCicloVigente,
  abrirNovoCiclo
}
