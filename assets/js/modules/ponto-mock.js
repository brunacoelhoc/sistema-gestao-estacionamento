// Dados simulados do espelho de ponto (não vêm do backend). Usados só para
// exibir um exemplo de como a aba "Ponto" fica preenchida quando o usuário
// ainda não tem perfil de RH cadastrado (ver assets/js/controllers/rh.js).
// As datas são geradas em relação ao mês atual, então continuam fazendo
// sentido não importa em que dia a página seja aberta.
;(function () {
  function pad (numero) {
    return String(numero).padStart(2, '0')
  }

  // Dias com algo digno de nota, pelo padrão de dia-do-mês (1-31):
  // um com falta e um com hora extra — só para o exemplo mostrar os
  // diferentes badges de situação (ver situacaoDoDia em rh.js).
  const DIA_FALTA_EXEMPLO = 3
  const DIA_HORA_EXTRA_EXEMPLO = 7

  function gerarEspelhoSimulado () {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = hoje.getMonth()
    const ultimoDiaComMovimento = hoje.getDate()

    const dias = []
    const totais = { horasNormais: 0, horasExtras: 0, horasForaEscala: 0, faltas: 0 }

    for (let dia = 1; dia <= ultimoDiaComMovimento; dia++) {
      const dataDoDia = new Date(ano, mes, dia)
      const diaDaSemana = dataDoDia.getDay()
      const chaveData = `${ano}-${pad(mes + 1)}-${pad(dia)}`
      const ehFimDeSemana = diaDaSemana === 0 || diaDaSemana === 6
      const ehUltimoDia = dia === ultimoDiaComMovimento

      if (ehFimDeSemana) {
        dias.push({
          data: chaveData, diaDaSemana, ehDiaDeEscala: false,
          horaEntrada: null, horaSaida: null,
          horasNormais: 0, horasExtras: 0, horasForaEscala: 0,
          falta: false, emAberto: false
        })
        continue
      }

      if (dia === DIA_FALTA_EXEMPLO && !ehUltimoDia) {
        totais.faltas += 1
        dias.push({
          data: chaveData, diaDaSemana, ehDiaDeEscala: true,
          horaEntrada: null, horaSaida: null,
          horasNormais: 0, horasExtras: 0, horasForaEscala: 0,
          falta: true, emAberto: false
        })
        continue
      }

      if (ehUltimoDia) {
        totais.horasNormais += 8
        dias.push({
          data: chaveData, diaDaSemana, ehDiaDeEscala: true,
          horaEntrada: `${chaveData}T08:03:00`, horaSaida: null,
          horasNormais: 8, horasExtras: 0, horasForaEscala: 0,
          falta: false, emAberto: true
        })
        continue
      }

      const temHoraExtra = dia === DIA_HORA_EXTRA_EXEMPLO
      const horasExtras = temHoraExtra ? 1.5 : 0
      totais.horasNormais += 8
      totais.horasExtras += horasExtras

      dias.push({
        data: chaveData, diaDaSemana, ehDiaDeEscala: true,
        horaEntrada: `${chaveData}T08:02:00`,
        horaSaida: `${chaveData}T${temHoraExtra ? '18:32' : '17:01'}:00`,
        horasNormais: 8, horasExtras, horasForaEscala: 0,
        falta: false, emAberto: false
      })
    }

    return { dias, totais }
  }

  function solicitacoesExtraSimuladas () {
    const hoje = new Date()
    const referencia = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`
    return [
      { data: `${referencia}-05T00:00:00`, motivo: 'Cobertura de plantão no feriado', status: 'aprovada' },
      { data: `${referencia}-18T00:00:00`, motivo: 'Evento especial no estacionamento', status: 'pendente' }
    ]
  }

  window.PontoMock = { gerarEspelhoSimulado, solicitacoesExtraSimuladas }
})()
