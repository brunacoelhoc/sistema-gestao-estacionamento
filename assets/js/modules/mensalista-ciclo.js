/**
 * Prévia, no cliente, do fechamento de ticket de um mensalista: prevê se vai
 * cobrar um novo ciclo de 30 dias ou sair isento porque já existe um ciclo
 * vigente. Espelha a mesma regra usada de verdade no fechamento (ver
 * buscarCicloVigente em src/mensalidade-ciclo/mensalidade-ciclo.service.ts)
 * para a prévia mostrada antes de confirmar nunca divergir do valor cobrado
 * pelo backend.
 *
 * Usado por assets/js/controllers/tickets.js e
 * assets/js/controllers/dashboard.js — ambos têm sua própria tela de
 * "Fechar Ticket" com a mesma prévia de valor.
 */
function preverCicloMensalista (mensalidades, dataEntradaTicket, valorMensalidade, duracaoCicloDias = 30) {
  const dataEntrada = new Date(dataEntradaTicket)

  const cicloVigente = (mensalidades || [])
    .filter(m => new Date(m.dataFim) >= dataEntrada)
    .sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio))[0] || null

  if (cicloVigente) {
    return { cobraAgora: false, valor: 0, dataFim: new Date(cicloVigente.dataFim) }
  }

  const dataFimNovoCiclo = new Date(dataEntrada)
  dataFimNovoCiclo.setDate(dataFimNovoCiclo.getDate() + duracaoCicloDias)
  return { cobraAgora: true, valor: Number(valorMensalidade || 0), dataFim: dataFimNovoCiclo }
}

function formatarDataCicloMensalista (data) {
  const d = new Date(data)
  return isNaN(d) ? '-' : d.toLocaleDateString('pt-BR')
}

window.preverCicloMensalista = preverCicloMensalista
window.formatarDataCicloMensalista = formatarDataCicloMensalista
