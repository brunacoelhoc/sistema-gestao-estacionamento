/**
 * Regra de cobrança do mensalista: ele não paga por ticket, paga um ciclo
 * mensal (Mensalidade). O ciclo nasce cheio quando o mensalista fica ativo
 * (cadastro ou reativação); se for inativado antes do fim do mês, o ciclo em
 * aberto é fechado na hora com valor proporcional aos dias em que esteve
 * ativo naquele mês.
 */

function diasNoMes (ano, mesIndex) {
  return new Date(ano, mesIndex + 1, 0).getDate()
}

function referenciaDe (data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}-${mes}`
}

async function abrirCiclo (tx, mensalista, dataInicio = new Date()) {
  const referencia = referenciaDe(dataInicio)
  const totalDias = diasNoMes(dataInicio.getFullYear(), dataInicio.getMonth())
  const dataFim = new Date(
    dataInicio.getFullYear(),
    dataInicio.getMonth() + 1,
    0,
    23, 59, 59, 999
  )

  const existente = await tx.mensalidade.findUnique({
    where: { mensalistaId_referencia: { mensalistaId: mensalista.id, referencia } }
  })
  if (existente) {
    // Já existe um ciclo neste mês. Se ele tinha sido encerrado antecipado
    // (reativação no mesmo mês em que foi inativado), volta a cobrir o mês
    // inteiro — sem isso, os dias entre a reativação e o fim do mês ficariam
    // sem nenhum ciclo cobrando por eles.
    if (existente.status === 'pendente' && existente.dataFim < dataFim) {
      return tx.mensalidade.update({
        where: { id: existente.id },
        data: {
          dataFim,
          diasCobrados: totalDias,
          valor: Number(mensalista.valorMensalidade || 0)
        }
      })
    }
    return existente
  }

  return tx.mensalidade.create({
    data: {
      mensalistaId: mensalista.id,
      referencia,
      dataInicio,
      dataFim,
      diasCobrados: totalDias,
      diasNoMes: totalDias,
      valor: Number(mensalista.valorMensalidade || 0),
      status: 'pendente'
    }
  })
}

async function encerrarCicloAntecipado (tx, mensalista, dataFim = new Date()) {
  const referencia = referenciaDe(dataFim)

  const ciclo = await tx.mensalidade.findUnique({
    where: { mensalistaId_referencia: { mensalistaId: mensalista.id, referencia } }
  })
  if (!ciclo || ciclo.status !== 'pendente') return ciclo

  const diasCorridos = Math.max(
    1,
    Math.ceil((dataFim - ciclo.dataInicio) / (1000 * 60 * 60 * 24))
  )
  const diasCobrados = Math.min(diasCorridos, ciclo.diasNoMes)
  const valorMensalidade = Number(mensalista.valorMensalidade || 0)
  const valorProporcional = Number(
    ((valorMensalidade * diasCobrados) / ciclo.diasNoMes).toFixed(2)
  )

  return tx.mensalidade.update({
    where: { id: ciclo.id },
    data: { dataFim, diasCobrados, valor: valorProporcional }
  })
}

module.exports = { diasNoMes, referenciaDe, abrirCiclo, encerrarCicloAntecipado }
