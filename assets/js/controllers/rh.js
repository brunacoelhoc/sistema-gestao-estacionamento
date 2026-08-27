/**
 * Lógica da página consolidada "Recursos Humanos" (Ponto, Férias,
 * Dados do RH, Notificações e Folha de Pagamento — antes 5
 * páginas separadas). Cada seção roda isolada na própria IIFE pra que uma
 * função/constante de uma seção (ex.: "inicializarPagina", que existia em 3
 * das 5 páginas originais) não sobrescreva a de outra agora que tudo vive no
 * mesmo documento. Só os IDs que colidiam entre seções (page-error,
 * page-error-text, btn-retry-page, sem-perfil-rh) foram renomeados com um
 * prefixo por seção — o resto já era único.
 */

// --- SEÇÃO: MEU PONTO ---
;(function () {
  const DIAS_SEMANA_PONTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  function referenciaAtual () {
    const agora = new Date()
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
  }

  function chaveDataHoje () {
    const agora = new Date()
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
  }

  function formatarHora (dataIso) {
    if (!dataIso) return '-'
    return new Date(dataIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatarDataCurta (chaveData) {
    const [, mes, dia] = chaveData.split('-')
    return `${dia}/${mes}`
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const inputMes = document.getElementById('ponto-mes-referencia')
    if (inputMes) inputMes.value = referenciaAtual()

    document.getElementById('ponto-btn-retry-page')?.addEventListener('click', inicializarPagina)
    document.getElementById('btn-bater-entrada')?.addEventListener('click', baterEntrada)
    document.getElementById('btn-bater-saida')?.addEventListener('click', baterSaida)
    inputMes?.addEventListener('change', () => carregarEspelhoDoMes(inputMes.value))
    document.getElementById('form-solicitar-extra')?.addEventListener('submit', solicitarExtra)
    document.getElementById('form-justificativa')?.addEventListener('submit', registrarJustificativa)
    document.getElementById('form-gerar-espelho')?.addEventListener('submit', gerarEspelhoPonto)

    await inicializarPagina()
  })

  async function inicializarPagina () {
    const erroEl = document.getElementById('ponto-page-error')
    const semPerfilEl = document.getElementById('ponto-sem-perfil-rh')
    const conteudoEl = document.getElementById('conteudo-ponto')
    erroEl?.classList.add('d-none')
    semPerfilEl?.classList.add('d-none')
    conteudoEl?.classList.add('d-none')

    try {
      const perfil = await ApiService.getMeuPerfilRh()
      const admin = typeof AuthService !== 'undefined' && AuthService.ehAdmin()

      if (!perfil && !admin) {
        semPerfilEl?.classList.remove('d-none')
        exibirDadosSimulados()
        return
      }

      conteudoEl?.classList.remove('d-none')

      const tarefas = []

      if (perfil) {
        tarefas.push(
          atualizarStatusHoje(),
          carregarEspelhoDoMes(referenciaAtual()),
          carregarMinhasSolicitacoesExtra()
        )
      } else {
        // Admin sem perfil de RH próprio: ele não é um funcionário em
        // escala, então não faz sentido bater ponto ou ver espelho pessoal —
        // mas ele deve ter acesso total às ferramentas de gestão abaixo.
        ocultarAcoesPessoaisDePonto()
      }

      if (typeof AuthService !== 'undefined' && AuthService.ehRhOuAdmin()) {
        document.getElementById('card-justificativas-rh')?.classList.remove('d-none')
        document.getElementById('card-gerar-espelho')?.classList.remove('d-none')
        document.getElementById('card-aprovacoes-extra')?.classList.remove('d-none')
        tarefas.push(
          carregarFuncionariosParaJustificativa(),
          carregarFuncionariosParaEspelho(),
          carregarAprovacoesPendentes()
        )
      }

      await Promise.all(tarefas)
    } catch (error) {
      console.error('Erro ao carregar seção de ponto:', error)
      erroEl?.classList.remove('d-none')
    }
  }

  function ocultarAcoesPessoaisDePonto () {
    document.getElementById('card-bater-ponto')?.classList.add('d-none')
    document.getElementById('card-espelho-ponto')?.classList.add('d-none')
    document.getElementById('card-solicitar-extra')?.classList.add('d-none')
  }

  async function atualizarStatusHoje () {
    const statusEl = document.getElementById('ponto-hoje-status')
    const btnEntrada = document.getElementById('btn-bater-entrada')
    const btnSaida = document.getElementById('btn-bater-saida')
    if (!statusEl || !btnEntrada || !btnSaida) return

    btnEntrada.classList.add('d-none')
    btnSaida.classList.add('d-none')

    const registros = await ApiService.getMeuPontoDoMes(referenciaAtual())
    const chaveHoje = chaveDataHoje()
    const registroHoje = (registros || []).find(r => String(r.data).slice(0, 10) === chaveHoje)

    if (!registroHoje) {
      statusEl.textContent = 'Você ainda não registrou entrada hoje.'
      btnEntrada.classList.remove('d-none')
    } else if (!registroHoje.horaSaida) {
      statusEl.textContent = `Entrada registrada às ${formatarHora(registroHoje.horaEntrada)}. Não esqueça de registrar a saída.`
      btnSaida.classList.remove('d-none')
    } else {
      statusEl.textContent = `Ponto de hoje concluído — entrada às ${formatarHora(registroHoje.horaEntrada)}, saída às ${formatarHora(registroHoje.horaSaida)}.`
    }
  }

  async function baterEntrada () {
    try {
      await ApiService.registrarEntradaPonto()
      toastSucesso('Entrada registrada!')
      await atualizarStatusHoje()
      await carregarEspelhoDoMes(document.getElementById('ponto-mes-referencia')?.value || referenciaAtual())
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Não foi possível registrar a entrada', text: error.message || 'Tente novamente.' })
    }
  }

  async function baterSaida () {
    try {
      await ApiService.registrarSaidaPonto()
      toastSucesso('Saída registrada!')
      await atualizarStatusHoje()
      await carregarEspelhoDoMes(document.getElementById('ponto-mes-referencia')?.value || referenciaAtual())
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Não foi possível registrar a saída', text: error.message || 'Tente novamente.' })
    }
  }

  function situacaoDoDia (dia) {
    if (dia.falta) return '<span class="badge bg-danger">Falta</span>'
    if (dia.emAberto) return '<span class="badge bg-warning text-dark">Em aberto</span>'
    if (!dia.ehDiaDeEscala && dia.horasForaEscala > 0) return '<span class="badge bg-info text-dark">Fora da escala (autorizado)</span>'
    if (!dia.ehDiaDeEscala) return '<span class="text-muted">-</span>'
    if (dia.horasExtras > 0) return '<span class="badge bg-primary">Com hora extra</span>'
    if (!dia.horaEntrada) return '<span class="text-muted">-</span>'
    return '<span class="badge bg-success">OK</span>'
  }

  function renderizarEspelhoNaTabela (resumo) {
    const tbody = document.getElementById('tbody-ponto-mes')
    if (!tbody) return

    const diasComMovimento = resumo.dias.filter(d => d.ehDiaDeEscala || d.horaEntrada)

    if (diasComMovimento.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Nenhum dia de escala neste mês até agora.</td></tr>'
    } else {
      tbody.innerHTML = diasComMovimento.map(dia => `
        <tr>
          <td>${formatarDataCurta(dia.data)} (${DIAS_SEMANA_PONTO[dia.diaDaSemana]})</td>
          <td>${formatarHora(dia.horaEntrada)}</td>
          <td>${formatarHora(dia.horaSaida)}</td>
          <td>${dia.horasNormais.toFixed(2)}h</td>
          <td>${dia.horasExtras.toFixed(2)}h</td>
          <td>${dia.horasForaEscala.toFixed(2)}h</td>
          <td>${situacaoDoDia(dia)}</td>
        </tr>
      `).join('')
    }

    document.getElementById('total-horas-normais').textContent = `${resumo.totais.horasNormais.toFixed(2)}h`
    document.getElementById('total-horas-extras').textContent = `${resumo.totais.horasExtras.toFixed(2)}h`
    document.getElementById('total-horas-fora-escala').textContent = `${resumo.totais.horasForaEscala.toFixed(2)}h`
    document.getElementById('total-faltas').textContent = `${resumo.totais.faltas} falta(s)`
  }

  async function carregarEspelhoDoMes (referencia) {
    const tbody = document.getElementById('tbody-ponto-mes')
    if (!tbody) return
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Carregando...</td></tr>'

    try {
      const resumo = await ApiService.getResumoPonto(referencia)
      renderizarEspelhoNaTabela(resumo)
    } catch (error) {
      console.error('Erro ao carregar espelho de ponto:', error)
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-3">Não foi possível carregar o espelho de ponto.</td></tr>'
    }
  }

  // Preenche a aba com um exemplo fictício (assets/js/modules/ponto-mock.js)
  // quando o usuário ainda não tem perfil de RH cadastrado — só para o usuário
  // visualizar o layout. Nenhuma ação aqui chama a API: bater ponto e
  // solicitar trabalho extra ficam desabilitados nesse estado.
  function exibirDadosSimulados () {
    document.getElementById('conteudo-ponto')?.classList.remove('d-none')
    document.querySelectorAll('.badge-ponto-simulado').forEach(el => el.classList.remove('d-none'))

    document.getElementById('btn-bater-entrada')?.classList.add('d-none')
    document.getElementById('btn-bater-saida')?.classList.add('d-none')
    const statusEl = document.getElementById('ponto-hoje-status')
    if (statusEl) statusEl.textContent = 'Exemplo: entrada registrada às 08:02. Não esqueça de registrar a saída.'

    const inputMes = document.getElementById('ponto-mes-referencia')
    if (inputMes) inputMes.disabled = true

    if (window.PontoMock) {
      renderizarEspelhoNaTabela(window.PontoMock.gerarEspelhoSimulado())

      const tbodySolic = document.getElementById('tbody-minhas-solicitacoes-extra')
      if (tbodySolic) {
        tbodySolic.innerHTML = window.PontoMock.solicitacoesExtraSimuladas().map(s => `
          <tr>
            <td>${formatarDataCurta(String(s.data).slice(0, 10))}</td>
            <td>${ApiService.sanitizeText(s.motivo)}</td>
            <td>${badgeStatusExtra(s.status)}</td>
          </tr>
        `).join('')
      }
    }

    document.getElementById('form-solicitar-extra')?.querySelectorAll('input, button').forEach(el => { el.disabled = true })
  }

  function badgeStatusExtra (status) {
    const mapa = {
      pendente: '<span class="badge bg-warning text-dark">Pendente</span>',
      aprovada: '<span class="badge bg-success">Aprovada</span>',
      rejeitada: '<span class="badge bg-danger">Rejeitada</span>'
    }
    return mapa[status] || status
  }

  async function carregarMinhasSolicitacoesExtra () {
    const tbody = document.getElementById('tbody-minhas-solicitacoes-extra')
    if (!tbody) return

    try {
      const solicitacoes = await ApiService.getSolicitacoesTrabalhoExtra()
      if (!solicitacoes || solicitacoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Nenhuma solicitação ainda.</td></tr>'
        return
      }
      tbody.innerHTML = solicitacoes.map(s => `
        <tr>
          <td>${formatarDataCurta(String(s.data).slice(0, 10))}</td>
          <td>${ApiService.sanitizeText(s.motivo)}</td>
          <td>${badgeStatusExtra(s.status)}</td>
        </tr>
      `).join('')
    } catch (error) {
      console.error('Erro ao carregar solicitações de trabalho extra:', error)
    }
  }

  async function solicitarExtra (evento) {
    evento.preventDefault()
    const data = document.getElementById('input-extra-data').value
    const motivo = document.getElementById('input-extra-motivo').value.trim()
    if (!data || !motivo) return

    try {
      await ApiService.solicitarTrabalhoExtra(data, motivo)
      toastSucesso('Solicitação enviada! Aguarde a aprovação do RH.')
      document.getElementById('form-solicitar-extra').reset()
      await carregarMinhasSolicitacoesExtra()
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Não foi possível solicitar', text: error.message || 'Tente novamente.' })
    }
  }

  // --- SUBSEÇÕES SÓ PARA RH/ADMIN ---

  async function carregarFuncionariosParaJustificativa () {
    const select = document.getElementById('select-justificativa-funcionario')
    if (!select) return

    try {
      const usuarios = await ApiService.getUsuarios()
      const ativos = (usuarios || []).filter(u => u.ativo !== false)
      select.innerHTML = ativos
        .map(u => `<option value="${u.id}">${ApiService.sanitizeText(u.nome)}</option>`)
        .join('')
    } catch (error) {
      console.error('Erro ao carregar funcionários para justificativa:', error)
    }
  }

  async function registrarJustificativa (evento) {
    evento.preventDefault()
    const usuarioId = document.getElementById('select-justificativa-funcionario').value
    const data = document.getElementById('input-justificativa-data').value
    const tipo = document.getElementById('select-justificativa-tipo').value
    if (!usuarioId || !data || !tipo) return

    try {
      await ApiService.criarJustificativaPonto(usuarioId, data, tipo)
      toastSucesso('Justificativa registrada!')
      document.getElementById('form-justificativa').reset()
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Não foi possível registrar', text: error.message || 'Tente novamente.' })
    }
  }

  async function carregarAprovacoesPendentes () {
    const tbody = document.getElementById('tbody-aprovacoes-extra')
    if (!tbody) return

    try {
      const solicitacoes = await ApiService.getSolicitacoesTrabalhoExtra()
      const pendentes = (solicitacoes || []).filter(s => s.status === 'pendente')

      if (pendentes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Nenhuma solicitação pendente.</td></tr>'
        return
      }

      tbody.innerHTML = pendentes.map(s => `
        <tr>
          <td>${ApiService.sanitizeText(s.usuario?.nome || s.usuarioId)}</td>
          <td>${formatarDataCurta(String(s.data).slice(0, 10))}</td>
          <td>${ApiService.sanitizeText(s.motivo)}</td>
          <td>
            <button type="button" class="btn btn-sm btn-outline-success me-1 btn-aprovar-extra" data-id="${s.id}">
              <i class="fas fa-check" aria-hidden="true"></i> Aprovar
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger btn-rejeitar-extra" data-id="${s.id}">
              <i class="fas fa-times" aria-hidden="true"></i> Rejeitar
            </button>
          </td>
        </tr>
      `).join('')

      tbody.querySelectorAll('.btn-aprovar-extra').forEach(btn => {
        btn.addEventListener('click', () => decidirSolicitacaoExtra(btn.getAttribute('data-id'), 'aprovada'))
      })
      tbody.querySelectorAll('.btn-rejeitar-extra').forEach(btn => {
        btn.addEventListener('click', () => decidirSolicitacaoExtra(btn.getAttribute('data-id'), 'rejeitada'))
      })
    } catch (error) {
      console.error('Erro ao carregar aprovações de trabalho extra:', error)
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-3">Não foi possível carregar as solicitações.</td></tr>'
    }
  }

  async function carregarFuncionariosParaEspelho () {
    const select = document.getElementById('select-espelho-funcionario')
    if (!select) return

    try {
      const usuarios = await ApiService.getUsuarios()
      const ativos = (usuarios || []).filter(u => u.ativo !== false)
      select.innerHTML = ativos
        .map(u => `<option value="${u.id}">${ApiService.sanitizeText(u.nome)}</option>`)
        .join('')
    } catch (error) {
      console.error('Erro ao carregar funcionários para o espelho de ponto:', error)
    }
  }

  async function gerarEspelhoPonto (evento) {
    evento.preventDefault()
    const usuarioId = document.getElementById('select-espelho-funcionario').value
    const referencia = document.getElementById('input-espelho-referencia').value
    if (!usuarioId || !referencia) return

    try {
      await ApiService.gerarEspelhoPonto(usuarioId, referencia)
      toastSucesso('Espelho de ponto gerado e enviado para a caixa de notificações do funcionário!')
      document.getElementById('form-gerar-espelho').reset()
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Não foi possível gerar o espelho', text: error.message || 'Tente novamente.' })
    }
  }

  async function decidirSolicitacaoExtra (id, status) {
    try {
      await ApiService.decidirTrabalhoExtra(id, status)
      toastSucesso(status === 'aprovada' ? 'Solicitação aprovada!' : 'Solicitação rejeitada.')
      await carregarAprovacoesPendentes()
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Não foi possível decidir a solicitação', text: error.message || 'Tente novamente.' })
    }
  }
})()

// --- SEÇÃO: MINHAS FÉRIAS ---
;(function () {
  const ANO_ATUAL = new Date().getFullYear()
  const LIMITE_DIAS_ANO = 60
  const ANTECEDENCIA_MINIMA_DIAS = 90
  const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  let draftInicio = null
  let draftFim = null
  let anoExibido = ANO_ATUAL
  let periodosEquipeCache = null
  let calendarioComListenerAnexado = false
  let minhasSolicitacoesAtuais = []
  let saldoAtual = { disponiveis: LIMITE_DIAS_ANO, usados: 0, aprovados: 0, pendentes: 0 }

  function formatarDataBrFerias (dataIso) {
    if (!dataIso) return '-'
    const partes = String(dataIso).slice(0, 10).split('-')
    if (partes.length !== 3) return '-'
    const [ano, mes, dia] = partes
    return `${dia}/${mes}/${ano}`
  }

  function badgeStatusFerias (status) {
    const mapa = {
      pendente: '<span class="badge bg-warning text-dark">Pendente</span>',
      aprovada: '<span class="badge bg-success">Aprovada</span>',
      rejeitada: '<span class="badge bg-danger">Rejeitada</span>'
    }
    return mapa[status] || status
  }

  function isoLocal (data) {
    const y = data.getFullYear()
    const m = String(data.getMonth() + 1).padStart(2, '0')
    const d = String(data.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  function diferencaDiasIso (isoA, isoB) {
    const a = new Date(isoA + 'T00:00:00')
    const b = new Date(isoB + 'T00:00:00')
    return Math.round((b - a) / 86400000)
  }

  function obterDataMinimaSelecao () {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    hoje.setDate(hoje.getDate() + ANTECEDENCIA_MINIMA_DIAS)
    return isoLocal(hoje)
  }

  // Expande os períodos simulados da equipe (assets/js/modules/ferias-equipe-mock.js)
  // em datas concretas do ano vigente, com status calculado em relação a hoje.
  function obterPeriodosEquipe () {
    if (periodosEquipeCache) return periodosEquipeCache

    const mock = window.FeriasEquipeMock
    periodosEquipeCache = []
    if (!mock) return periodosEquipeCache

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    mock.EQUIPE.forEach(pessoa => {
      pessoa.periodos.forEach(p => {
        const inicio = new Date(ANO_ATUAL, p.mes - 1, p.dia)
        const fim = new Date(inicio)
        fim.setDate(fim.getDate() + p.duracaoDias - 1)

        let status = 'vai-tirar'
        if (fim < hoje) status = 'ja-tirou'
        else if (inicio <= hoje && hoje <= fim) status = 'tirando-agora'

        periodosEquipeCache.push({
          nome: pessoa.nome,
          departamento: pessoa.departamento,
          cor: mock.DEPARTAMENTOS[pessoa.departamento]?.cor || '#adb5bd',
          inicio,
          fim,
          dias: p.duracaoDias,
          status
        })
      })
    })

    return periodosEquipeCache
  }

  function construirMapaDias (solicitacoes) {
    const mapa = {}

    obterPeriodosEquipe().forEach(periodo => {
      let cursor = new Date(periodo.inicio)
      while (cursor <= periodo.fim) {
        const iso = isoLocal(cursor)
        if (!mapa[iso]) mapa[iso] = { equipe: [] }
        mapa[iso].equipe.push(periodo)
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
      }
    })

    ;(solicitacoes || []).forEach(s => {
      if (s.status === 'rejeitada') return
      let cursor = new Date(String(s.dataInicio).slice(0, 10) + 'T00:00:00')
      const fim = new Date(String(s.dataFim).slice(0, 10) + 'T00:00:00')
      while (cursor <= fim) {
        const iso = isoLocal(cursor)
        if (!mapa[iso]) mapa[iso] = { equipe: [] }
        mapa[iso].meu = { status: s.status }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
      }
    })

    return mapa
  }

  function renderizarLegenda () {
    const container = document.getElementById('ferias-legenda-equipe')
    if (!container) return
    const mock = window.FeriasEquipeMock
    container.innerHTML = mock
      ? Object.values(mock.DEPARTAMENTOS).map(d => `
          <span class="fce-legenda-item"><span class="fce-legenda-swatch" style="background:${d.cor}"></span>${d.label}</span>
        `).join('')
      : ''
  }

  function atualizarNavegacaoAno () {
    const label = document.getElementById('ferias-ano-vigente-label')
    if (label) label.textContent = String(anoExibido)

    const btnAnterior = document.getElementById('btn-ferias-ano-anterior')
    if (btnAnterior) btnAnterior.disabled = anoExibido <= ANO_ATUAL

    const btnProximo = document.getElementById('btn-ferias-proximo-ano')
    if (btnProximo) btnProximo.disabled = anoExibido >= ANO_ATUAL + 2
  }

  function renderizarCelulaDia (iso, dia, info, hojeIso) {
    const classes = ['fce-dia']
    const titulo = []

    if (info?.meu) {
      classes.push(info.meu.status === 'aprovada' ? 'fce-minhas-aprovada' : 'fce-minhas-pendente')
      titulo.push(`Suas férias (${info.meu.status === 'aprovada' ? 'aprovadas' : 'pendentes de aprovação'})`)
    }

    let dotsHtml = ''
    if (info?.equipe?.length) {
      const nomesUnicos = [...new Map(info.equipe.map(e => [e.nome, e])).values()]
      dotsHtml = nomesUnicos.slice(0, 4).map(e => `<span class="fce-dot" style="background:${e.cor}"></span>`).join('')
      titulo.push(nomesUnicos.map(e => `${e.nome} (${window.FeriasEquipeMock.DEPARTAMENTOS[e.departamento].label})`).join(', '))
    }

    if (iso === hojeIso) classes.push('fce-hoje')
    if (iso < hojeIso) classes.push('fce-passado')

    const bloqueado = iso < obterDataMinimaSelecao()
    if (bloqueado) {
      classes.push('fce-bloqueado')
      titulo.push(`Antecedência mínima de ${ANTECEDENCIA_MINIMA_DIAS} dias para escolher este dia`)
    }

    if (draftInicio && draftFim) {
      if (iso === draftInicio) classes.push('fce-selecionado-inicio')
      else if (iso === draftFim) classes.push('fce-selecionado-fim')
      else if (iso > draftInicio && iso < draftFim) classes.push('fce-selecionado-meio')
    } else if (draftInicio && iso === draftInicio) {
      classes.push('fce-selecionado-inicio')
    }

    const tituloTexto = (titulo.join(' • ') || `Dia ${dia}`).replace(/"/g, '&quot;')
    return `<button type="button" class="${classes.join(' ')}" data-iso="${iso}" title="${tituloTexto}" aria-label="${tituloTexto}">
      <span class="fce-dia-numero">${dia}</span>
      <span class="fce-dia-dots">${dotsHtml}</span>
    </button>`
  }

  function renderizarMes (ano, mesIndex, mapa, hojeIso) {
    const primeiroDia = new Date(ano, mesIndex, 1)
    const totalDias = new Date(ano, mesIndex + 1, 0).getDate()
    const offsetSemana = primeiroDia.getDay()

    let celulas = ''
    for (let i = 0; i < offsetSemana; i++) celulas += '<div class="fce-dia fce-vazio" aria-hidden="true"></div>'
    for (let dia = 1; dia <= totalDias; dia++) {
      const iso = isoLocal(new Date(ano, mesIndex, dia))
      celulas += renderizarCelulaDia(iso, dia, mapa[iso], hojeIso)
    }

    return `
      <div class="fce-mes">
        <div class="fce-mes-titulo">${NOMES_MESES[mesIndex]}</div>
        <div class="fce-semana-header"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
        <div class="fce-dias-grid">${celulas}</div>
      </div>
    `
  }

  function renderizarCalendarioEquipe (solicitacoes) {
    const container = document.getElementById('ferias-calendario-equipe')
    if (!container) return

    const mapa = construirMapaDias(solicitacoes)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const hojeIso = isoLocal(hoje)

    let html = ''
    for (let mes = 0; mes < 12; mes++) html += renderizarMes(anoExibido, mes, mapa, hojeIso)
    container.innerHTML = html
    atualizarNavegacaoAno()

    if (!calendarioComListenerAnexado) {
      container.addEventListener('click', evento => {
        const botao = evento.target.closest('.fce-dia')
        if (!botao || botao.classList.contains('fce-vazio')) return
        aoClicarDiaCalendario(botao.getAttribute('data-iso'))
      })
      calendarioComListenerAnexado = true
    }
  }

  function aoClicarDiaCalendario (iso) {
    if (iso < obterDataMinimaSelecao()) {
      toastInfo(`Escolha uma data a partir de ${formatarDataBrFerias(obterDataMinimaSelecao())} (mínimo de ${ANTECEDENCIA_MINIMA_DIAS} dias de antecedência).`)
      return
    }

    if (!draftInicio || draftFim) {
      draftInicio = iso
      draftFim = null
    } else if (iso < draftInicio) {
      draftFim = draftInicio
      draftInicio = iso
    } else {
      draftFim = iso
    }

    const inputInicio = document.getElementById('input-ferias-inicio')
    const inputFim = document.getElementById('input-ferias-fim')
    if (inputInicio) inputInicio.value = draftInicio
    if (inputFim) inputFim.value = draftFim || ''

    renderizarResumoSelecao()
    renderizarCalendarioEquipe(minhasSolicitacoesAtuais)
  }

  function renderizarResumoSelecao () {
    const el = document.getElementById('ferias-resumo-selecao')
    if (!el) return

    if (!draftInicio) {
      el.innerHTML = '&nbsp;'
      return
    }

    if (!draftFim) {
      el.innerHTML = `<i class="fas fa-calendar-check text-primary me-1" aria-hidden="true"></i>Início selecionado: <strong>${formatarDataBrFerias(draftInicio)}</strong>. Clique no dia de fim.`
      return
    }

    const dias = diferencaDiasIso(draftInicio, draftFim) + 1
    const excede = dias > saldoAtual.disponiveis
    const classe = excede ? 'text-danger' : 'text-success'
    const icone = excede ? 'fa-triangle-exclamation' : 'fa-circle-check'
    el.innerHTML = `<i class="fas ${icone} ${classe} me-1" aria-hidden="true"></i><span class="${classe}">Selecionado: <strong>${dias} dia(s)</strong> (${formatarDataBrFerias(draftInicio)} a ${formatarDataBrFerias(draftFim)})${excede ? ` — ultrapassa seu saldo de ${saldoAtual.disponiveis} dia(s) disponíveis.` : ` — dentro do seu saldo de ${saldoAtual.disponiveis} dia(s) disponíveis.`}</span>`
  }

  function renderizarSaldoResumo (solicitacoes) {
    const container = document.getElementById('ferias-saldo-resumo')
    if (!container) return

    const doAno = (solicitacoes || []).filter(s => Number(String(s.dataInicio).slice(0, 4)) === ANO_ATUAL)
    const aprovados = doAno.filter(s => s.status === 'aprovada').reduce((t, s) => t + s.dias, 0)
    const pendentes = doAno.filter(s => s.status === 'pendente').reduce((t, s) => t + s.dias, 0)
    const usados = aprovados + pendentes
    const disponiveis = Math.max(0, LIMITE_DIAS_ANO - usados)
    saldoAtual = { disponiveis, usados, aprovados, pendentes }

    const cartoes = [
      { icone: 'fa-umbrella-beach', variante: 'kpi-success', label: 'Dias disponíveis', valor: disponiveis },
      { icone: 'fa-check-circle', variante: 'kpi-primary', label: 'Aprovados', valor: aprovados },
      { icone: 'fa-hourglass-half', variante: 'kpi-warning', label: 'Pendentes de aprovação', valor: pendentes },
      { icone: 'fa-calendar', variante: 'kpi-secondary', label: `Limite anual (${ANO_ATUAL})`, valor: LIMITE_DIAS_ANO }
    ]

    container.innerHTML = cartoes.map(c => `
      <div class="col-12 col-sm-6 col-md-3">
        <div class="card-kpi ${c.variante} h-100">
          <div class="d-flex align-items-center justify-content-between">
            <div>
              <span class="kpi-label">${c.label}</span>
              <div class="kpi-value">${c.valor}</div>
            </div>
            <div class="kpi-icon-bubble"><i class="fas ${c.icone}" aria-hidden="true"></i></div>
          </div>
        </div>
      </div>
    `).join('')
  }

  function renderizarStatusEquipe () {
    const container = document.getElementById('ferias-status-equipe')
    if (!container) return

    const periodos = obterPeriodosEquipe()
    const grupos = {
      'tirando-agora': { titulo: 'De férias agora', icone: 'fa-umbrella-beach', cor: 'text-warning', itens: [] },
      'ja-tirou': { titulo: 'Já tiraram este ano', icone: 'fa-circle-check', cor: 'text-success', itens: [] },
      'vai-tirar': { titulo: 'Ainda vão tirar', icone: 'fa-hourglass-half', cor: 'text-primary', itens: [] }
    }

    periodos.forEach(p => grupos[p.status]?.itens.push(p))
    grupos['ja-tirou'].itens.sort((a, b) => b.fim - a.fim)
    grupos['tirando-agora'].itens.sort((a, b) => a.fim - b.fim)
    grupos['vai-tirar'].itens.sort((a, b) => a.inicio - b.inicio)

    container.innerHTML = Object.values(grupos).map(grupo => `
      <div class="col-12 col-md-4">
        <div class="card shadow-sm h-100">
          <div class="card-header bg-white py-2 fw-semibold">
            <i class="fas ${grupo.icone} ${grupo.cor} me-2" aria-hidden="true"></i>${grupo.titulo}
            <span class="badge bg-secondary-subtle text-secondary-emphasis ms-1">${grupo.itens.length}</span>
          </div>
          <div class="card-body ferias-equipe-lista">
            ${grupo.itens.length === 0
              ? '<p class="text-muted text-xs mb-0">Ninguém neste grupo no momento.</p>'
              : grupo.itens.map(p => `
                <div class="ferias-equipe-item" style="--fce-cor:${p.cor}">
                  <div class="fw-semibold text-xs">${ApiService.sanitizeText(p.nome)}</div>
                  <div class="text-xs text-muted">${window.FeriasEquipeMock.DEPARTAMENTOS[p.departamento].label} · ${formatarDataBrFerias(isoLocal(p.inicio))} a ${formatarDataBrFerias(isoLocal(p.fim))} <span class="badge bg-light text-dark border">${p.dias}d</span></div>
                </div>
              `).join('')}
          </div>
        </div>
      </div>
    `).join('')
  }

  function atualizarVisaoFerias () {
    renderizarSaldoResumo(minhasSolicitacoesAtuais)
    renderizarCalendarioEquipe(minhasSolicitacoesAtuais)
    renderizarStatusEquipe()
    renderizarResumoSelecao()
  }

  document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('ferias-btn-retry-page')?.addEventListener('click', inicializarPagina)
    document.getElementById('form-solicitar-ferias')?.addEventListener('submit', solicitarFerias)
    document.getElementById('input-ferias-inicio')?.addEventListener('change', evento => {
      draftInicio = evento.target.value || null
      if (draftInicio && draftFim && draftFim < draftInicio) draftFim = null
      renderizarResumoSelecao()
      renderizarCalendarioEquipe(minhasSolicitacoesAtuais)
    })
    document.getElementById('input-ferias-fim')?.addEventListener('change', evento => {
      draftFim = evento.target.value || null
      renderizarResumoSelecao()
      renderizarCalendarioEquipe(minhasSolicitacoesAtuais)
    })
    document.getElementById('btn-ferias-ano-anterior')?.addEventListener('click', () => {
      if (anoExibido <= ANO_ATUAL) return
      anoExibido -= 1
      renderizarCalendarioEquipe(minhasSolicitacoesAtuais)
    })
    document.getElementById('btn-ferias-proximo-ano')?.addEventListener('click', () => {
      if (anoExibido >= ANO_ATUAL + 2) return
      anoExibido += 1
      renderizarCalendarioEquipe(minhasSolicitacoesAtuais)
    })
    renderizarLegenda()
    await inicializarPagina()
  })

  async function inicializarPagina () {
    const erroEl = document.getElementById('ferias-page-error')
    const semPerfilEl = document.getElementById('ferias-sem-perfil-rh')
    const conteudoEl = document.getElementById('conteudo-ferias')
    erroEl?.classList.add('d-none')
    semPerfilEl?.classList.add('d-none')
    conteudoEl?.classList.add('d-none')

    // Calendário e status da equipe são dados simulados (ver
    // assets/js/modules/ferias-equipe-mock.js) e aparecem mesmo para quem
    // ainda não tem perfil de RH cadastrado — não dependem de "minhas
    // solicitações", que só existem depois do try abaixo.
    renderizarCalendarioEquipe(minhasSolicitacoesAtuais)
    renderizarStatusEquipe()

    try {
      const perfil = await ApiService.getMeuPerfilRh()
      const admin = typeof AuthService !== 'undefined' && AuthService.ehAdmin()

      if (!perfil && !admin) {
        semPerfilEl?.classList.remove('d-none')
        return
      }

      conteudoEl?.classList.remove('d-none')

      const tarefas = []

      if (perfil) {
        tarefas.push(carregarMinhasFerias())
      } else {
        // Admin sem perfil de RH próprio: ele resolve solicitações, não tira
        // férias como funcionário — some com o saldo/formulário pessoal mas
        // mantém acesso total às aprovações da equipe.
        ocultarAcoesPessoaisDeFerias()
      }

      if (typeof AuthService !== 'undefined' && AuthService.ehRhOuAdmin()) {
        document.getElementById('card-aprovacoes-ferias')?.classList.remove('d-none')
        tarefas.push(carregarAprovacoesPendentesFerias())
      }

      await Promise.all(tarefas)
    } catch (error) {
      console.error('Erro ao carregar seção de férias:', error)
      erroEl?.classList.remove('d-none')
    }
  }

  function ocultarAcoesPessoaisDeFerias () {
    document.getElementById('ferias-texto-direito')?.classList.add('d-none')
    document.getElementById('ferias-saldo-resumo')?.classList.add('d-none')
    document.getElementById('card-solicitar-ferias')?.classList.add('d-none')
    document.getElementById('card-minhas-ferias')?.classList.add('d-none')
  }

  async function carregarMinhasFerias () {
    const tbody = document.getElementById('tbody-minhas-ferias')

    try {
      const solicitacoes = await ApiService.getFerias()
      minhasSolicitacoesAtuais = solicitacoes || []

      if (tbody) {
        tbody.innerHTML = minhasSolicitacoesAtuais.length === 0
          ? '<tr><td colspan="4" class="text-center text-muted py-3">Nenhuma solicitação ainda.</td></tr>'
          : minhasSolicitacoesAtuais.map(s => `
            <tr>
              <td>${formatarDataBrFerias(s.dataInicio)}</td>
              <td>${formatarDataBrFerias(s.dataFim)}</td>
              <td>${s.dias}</td>
              <td>${badgeStatusFerias(s.status)}</td>
            </tr>
          `).join('')
      }
    } catch (error) {
      console.error('Erro ao carregar minhas férias:', error)
      minhasSolicitacoesAtuais = []
    }

    atualizarVisaoFerias()
  }

  async function solicitarFerias (evento) {
    evento.preventDefault()
    const dataInicio = document.getElementById('input-ferias-inicio').value
    const dataFim = document.getElementById('input-ferias-fim').value
    if (!dataInicio || !dataFim) return

    try {
      await ApiService.solicitarFerias(dataInicio, dataFim)
      toastSucesso('Solicitação de férias enviada! Aguarde a aprovação do RH.')
      document.getElementById('form-solicitar-ferias').reset()
      draftInicio = null
      draftFim = null
      await carregarMinhasFerias()
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Não foi possível solicitar', text: error.message || 'Tente novamente.' })
    }
  }

  async function carregarAprovacoesPendentesFerias () {
    const tbody = document.getElementById('tbody-aprovacoes-ferias')
    if (!tbody) return

    try {
      const solicitacoes = await ApiService.getFerias()
      const pendentes = (solicitacoes || []).filter(s => s.status === 'pendente')

      if (pendentes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Nenhuma solicitação pendente.</td></tr>'
        return
      }

      tbody.innerHTML = pendentes.map(s => `
        <tr>
          <td>${ApiService.sanitizeText(s.usuario?.nome || s.usuarioId)}</td>
          <td>${formatarDataBrFerias(s.dataInicio)}</td>
          <td>${formatarDataBrFerias(s.dataFim)}</td>
          <td>${s.dias}</td>
          <td>
            <button type="button" class="btn btn-sm btn-outline-secondary me-1 btn-editar-ferias"
              data-id="${s.id}" data-inicio="${String(s.dataInicio).slice(0, 10)}" data-fim="${String(s.dataFim).slice(0, 10)}">
              <i class="fas fa-pen" aria-hidden="true"></i> Editar
            </button>
            <button type="button" class="btn btn-sm btn-outline-success me-1 btn-aprovar-ferias" data-id="${s.id}">
              <i class="fas fa-check" aria-hidden="true"></i> Aprovar
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger btn-rejeitar-ferias" data-id="${s.id}">
              <i class="fas fa-times" aria-hidden="true"></i> Rejeitar
            </button>
          </td>
        </tr>
      `).join('')

      tbody.querySelectorAll('.btn-editar-ferias').forEach(btn => {
        btn.addEventListener('click', () => abrirModalEditarFerias(
          btn.getAttribute('data-id'), btn.getAttribute('data-inicio'), btn.getAttribute('data-fim'), btn
        ))
      })
      tbody.querySelectorAll('.btn-aprovar-ferias').forEach(btn => {
        btn.addEventListener('click', () => decidirFerias(btn.getAttribute('data-id'), 'aprovada', btn))
      })
      tbody.querySelectorAll('.btn-rejeitar-ferias').forEach(btn => {
        btn.addEventListener('click', () => decidirFerias(btn.getAttribute('data-id'), 'rejeitada', btn))
      })
    } catch (error) {
      console.error('Erro ao carregar aprovações de férias:', error)
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-3">Não foi possível carregar as solicitações.</td></tr>'
    }
  }

  // Desliga os três botões de ação (Editar/Aprovar/Rejeitar) da mesma linha
  // enquanto uma requisição está em andamento — evita clique duplo (duas
  // decisões pra mesma solicitação) e dá feedback visual de "processando".
  function alternarBotoesDaLinha (botao, desabilitado) {
    const linha = botao.closest('tr')
    linha?.querySelectorAll('button').forEach(b => { b.disabled = desabilitado })
  }

  async function decidirFerias (id, status, botao) {
    if (status === 'rejeitada') {
      const confirmacao = await Swal.fire({
        icon: 'warning',
        title: 'Rejeitar solicitação de férias?',
        text: 'O funcionário será notificado e vai precisar enviar um novo pedido caso queira tentar de novo.',
        showCancelButton: true,
        confirmButtonText: 'Sim, rejeitar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc3545'
      })
      if (!confirmacao.isConfirmed) return
    }

    alternarBotoesDaLinha(botao, true)
    try {
      await ApiService.decidirFerias(id, status)
      toastSucesso(status === 'aprovada' ? 'Férias aprovadas!' : 'Solicitação rejeitada.')
      await carregarAprovacoesPendentesFerias()
    } catch (error) {
      alternarBotoesDaLinha(botao, false)
      Swal.fire({ icon: 'error', title: 'Não foi possível decidir a solicitação', text: error.message || 'Tente novamente.' })
    }
  }

  async function abrirModalEditarFerias (id, dataInicioAtual, dataFimAtual, botao) {
    const { value: formValues } = await Swal.fire({
      title: 'Editar solicitação de férias',
      html: `
        <div class="text-start mb-2">
          <label class="form-label fw-bold" for="swal-ferias-inicio">Data de início</label>
          <input id="swal-ferias-inicio" type="date" class="form-control" value="${dataInicioAtual}">
        </div>
        <div class="text-start">
          <label class="form-label fw-bold" for="swal-ferias-fim">Data de fim</label>
          <input id="swal-ferias-fim" type="date" class="form-control" value="${dataFimAtual}">
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Salvar alterações',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const dataInicio = document.getElementById('swal-ferias-inicio').value
        const dataFim = document.getElementById('swal-ferias-fim').value
        if (!dataInicio || !dataFim) {
          Swal.showValidationMessage('Preencha as duas datas.')
          return false
        }
        return { dataInicio, dataFim }
      }
    })

    if (!formValues) return

    alternarBotoesDaLinha(botao, true)
    try {
      await ApiService.editarFerias(id, formValues.dataInicio, formValues.dataFim)
      toastSucesso('Solicitação de férias atualizada!')
      await carregarAprovacoesPendentesFerias()
    } catch (error) {
      alternarBotoesDaLinha(botao, false)
      Swal.fire({ icon: 'error', title: 'Não foi possível editar a solicitação', text: error.message || 'Tente novamente.' })
    }
  }
})()

// --- SEÇÃO: MEUS DADOS DE RH ---
;(function () {
  const DIAS_SEMANA_LABELS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  function formatarMoedaBr (valor) {
    const numero = Number(valor)
    if (Number.isNaN(numero)) return '-'
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatarDataBrPerfilRh (dataIso) {
    if (!dataIso) return '-'
    const partes = String(dataIso).slice(0, 10).split('-')
    if (partes.length !== 3) return '-'
    const [ano, mes, dia] = partes
    return `${dia}/${mes}/${ano}`
  }

  function formatarDiasEscala (dias) {
    if (!Array.isArray(dias) || dias.length === 0) return '-'
    return [...dias].sort((a, b) => a - b).map(d => DIAS_SEMANA_LABELS_CURTO[d]).join(', ')
  }

  document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('perfilrh-btn-retry-page')?.addEventListener('click', carregarMeuPerfilRh)
    document.getElementById('btn-recarregar-contratos')?.addEventListener('click', carregarHistoricoContratos)
    await carregarMeuPerfilRh()
    await carregarAssinatura()
    ligarCanvasAssinatura()
    await carregarOrganograma()
    await carregarHistoricoContratos()
  })

  const MAPA_VALE_TRANSPORTE = { vale_transporte: 'Vale-transporte', vale_combustivel: 'Vale-combustível', nenhum: 'Nenhum' }

  // Renderiza um nó do organograma e seus filhos recursivamente — mesma
  // origem de dados de rh-gestor (PerfilRH.gestorId), mas mostrando a árvore
  // inteira da empresa em vez de só o gestor direto.
  function renderizarNoOrganograma (no, meuId) {
    return `
      <li class="mb-1">
        <div class="d-flex align-items-center gap-2 py-1">
          <i class="fas fa-user-circle text-primary" aria-hidden="true"></i>
          <strong>${ApiService.sanitizeText(no.nome)}</strong>
          <span class="text-muted text-sm">${ApiService.sanitizeText(no.cargo)}</span>
          ${no.usuarioId === meuId ? '<span class="badge bg-primary">Você</span>' : ''}
        </div>
        ${no.filhos.length ? `<ul class="list-unstyled ps-4 border-start">${no.filhos.map(f => renderizarNoOrganograma(f, meuId)).join('')}</ul>` : ''}
      </li>
    `
  }

  async function carregarOrganograma () {
    const container = document.getElementById('rh-organograma')
    if (!container) return
    try {
      const arvore = await ApiService.getOrganograma()
      const meuId = typeof AuthService !== 'undefined' ? AuthService.getSessao()?.id : null
      if (!arvore || arvore.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-2 mb-0">Nenhum funcionário com dados de RH cadastrados ainda.</p>'
        return
      }
      container.innerHTML = `<ul class="list-unstyled mb-0">${arvore.map(no => renderizarNoOrganograma(no, meuId)).join('')}</ul>`
    } catch (error) {
      console.error('Erro ao carregar organograma:', error)
      container.innerHTML = '<p class="text-danger text-center py-2 mb-0">Não foi possível carregar o organograma.</p>'
    }
  }

  // Renderiza um bloco de texto livre (um item por linha) como lista —
  // usado por Direitos/Deveres/Tarefas do PerfilRH.
  function renderizarListaTexto (elementoId, texto) {
    const el = document.getElementById(elementoId)
    if (!el) return
    const linhas = String(texto || '').split('\n').map(l => l.trim()).filter(Boolean)
    if (linhas.length === 0) {
      el.innerHTML = '<li class="text-muted">Não informado.</li>'
      return
    }
    el.innerHTML = linhas.map(linha => `<li>${ApiService.sanitizeText(linha)}</li>`).join('')
  }

  // Ícone do marcador de cada nó do roadmap, por estado — mesmo vocabulário
  // visual usado na Trilha de Carreira e no PDI (ver .roadmap-marker em
  // assets/scss/_components.scss). `iconeFuturo` é parametrizável: na
  // Trilha de Carreira um degrau futuro é um cadeado (você precisa "chegar
  // lá"); no PDI os itens não têm ordem obrigatória entre si (RH pode
  // concluir qualquer um a qualquer momento — ver PdiService.concluir), então
  // "trancado" seria enganoso — usa um círculo vazio em vez disso.
  function iconeMarcadorRoadmap (estado, iconeFuturo = 'fa-lock') {
    if (estado === 'concluido') return 'fa-check'
    if (estado === 'atual') return 'fa-location-dot'
    return iconeFuturo
  }

  async function carregarTrilhaCarreira (perfil) {
    const container = document.getElementById('rh-trilha-carreira')
    if (!container) return
    try {
      const etapas = await ApiService.getEtapasCarreira()
      if (!etapas || etapas.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-2 mb-0">Nenhuma etapa de carreira cadastrada ainda.</p>'
        return
      }

      const indiceAtual = etapas.findIndex(e => e.id === perfil?.etapaCarreiraAtualId)

      container.innerHTML = etapas.map((etapa, indice) => {
        const ehAtual = indice === indiceAtual
        const ehConcluida = indiceAtual >= 0 && indice < indiceAtual
        const estado = ehConcluida ? 'concluido' : ehAtual ? 'atual' : 'futuro'

        return `
          <div class="roadmap-node is-${estado}">
            <div class="roadmap-marker"><i class="fas ${iconeMarcadorRoadmap(estado)}" aria-hidden="true"></i></div>
            <div class="roadmap-label">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <strong>${ApiService.sanitizeText(etapa.titulo)}</strong>
                ${ehAtual ? '<span class="badge bg-primary">Você está aqui</span>' : ''}
                ${etapa.faixaSalarial ? `<span class="badge bg-light text-dark border">${ApiService.sanitizeText(etapa.faixaSalarial)}</span>` : ''}
              </div>
              <p class="text-muted text-sm mb-0 mt-1">${ApiService.sanitizeText(etapa.descricao)}</p>
            </div>
          </div>
        `
      }).join('')

      animarEntradaEmCascata?.(container.querySelectorAll('.roadmap-node'))
    } catch (error) {
      console.error('Erro ao carregar trilha de carreira:', error)
      container.innerHTML = '<p class="text-danger text-center py-2 mb-0">Não foi possível carregar a trilha de carreira.</p>'
    }
  }

  function formatarDataHoraCurtaBr (dataIso) {
    if (!dataIso) return '-'
    return new Date(dataIso).toLocaleDateString('pt-BR')
  }

  async function carregarMeuPdi () {
    const timelineEl = document.getElementById('rh-pdi-timeline')
    const resumoEl = document.getElementById('rh-pdi-resumo')
    const barraEl = document.getElementById('rh-pdi-progress-bar')
    const anelEl = document.getElementById('rh-pdi-anel')
    const anelTextoEl = document.getElementById('rh-pdi-anel-texto')
    if (!timelineEl) return

    try {
      const itens = await ApiService.getMeuPdi()
      if (!itens || itens.length === 0) {
        timelineEl.innerHTML = '<p class="text-muted text-center py-2 mb-0">Nenhum item de PDI cadastrado ainda.</p>'
        if (resumoEl) resumoEl.textContent = '-'
        if (barraEl) barraEl.style.width = '0%'
        if (anelTextoEl) anelTextoEl.textContent = '-'
        return
      }

      const concluidos = itens.filter(i => i.status === 'concluido').length
      const percentual = Math.round((concluidos / itens.length) * 100)
      if (resumoEl) resumoEl.textContent = `${concluidos} de ${itens.length} etapas concluídas (${percentual}%)`
      if (barraEl) {
        barraEl.style.width = `${percentual}%`
        barraEl.setAttribute('aria-valuenow', String(percentual))
      }
      animarAnelProgresso?.(anelEl, percentual)
      if (typeof animarContadorGsap === 'function' && anelTextoEl) {
        animarContadorGsap(anelTextoEl, percentual, { formatar: v => `${Math.round(v)}%` })
      } else if (anelTextoEl) {
        anelTextoEl.textContent = `${percentual}%`
      }

      // O primeiro item ainda pendente (na ordem do PDI) é "a etapa atual" —
      // mesma linguagem visual (nó pulsando) da Trilha de Carreira, mesmo o
      // PDI não tendo um índice de posição único como EtapaCarreira.
      const indiceAtual = itens.findIndex(i => i.status !== 'concluido')

      timelineEl.innerHTML = itens.map((item, indice) => {
        const concluido = item.status === 'concluido'
        const estado = concluido ? 'concluido' : indice === indiceAtual ? 'atual' : 'futuro'

        return `
          <div class="roadmap-node is-${estado}">
            <div class="roadmap-marker"><i class="fas ${iconeMarcadorRoadmap(estado, 'fa-circle')}" aria-hidden="true"></i></div>
            <div class="roadmap-label">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <strong>${ApiService.sanitizeText(item.titulo)}</strong>
                <span class="badge ${concluido ? 'bg-success' : estado === 'atual' ? 'bg-primary' : 'bg-secondary'}">${concluido ? 'Concluído' : estado === 'atual' ? 'Em andamento' : 'Pendente'}</span>
              </div>
              ${item.descricao ? `<p class="text-muted text-sm mb-0 mt-1">${ApiService.sanitizeText(item.descricao)}</p>` : ''}
              ${concluido ? `<p class="text-muted text-xs mb-0 mt-1">Concluído em ${formatarDataHoraCurtaBr(item.concluidoEm)}</p>` : ''}
            </div>
          </div>
        `
      }).join('')

      animarEntradaEmCascata?.(timelineEl.querySelectorAll('.roadmap-node'))
    } catch (error) {
      console.error('Erro ao carregar PDI:', error)
      timelineEl.innerHTML = '<p class="text-danger text-center py-2 mb-0">Não foi possível carregar o PDI.</p>'
    }
  }

  document.addEventListener('DOMContentLoaded', carregarMeuPdi)

  async function carregarAssinatura () {
    const blocoCadastrada = document.getElementById('assinatura-ja-cadastrada')
    const blocoCadastro = document.getElementById('assinatura-cadastro')
    if (!blocoCadastrada || !blocoCadastro) return

    try {
      const assinatura = await ApiService.getMinhaAssinatura()
      if (assinatura) {
        document.getElementById('assinatura-preview-cadastrada').src = assinatura.imagemDataUri
        blocoCadastrada.classList.remove('d-none')
        blocoCadastro.classList.add('d-none')
      } else {
        blocoCadastro.classList.remove('d-none')
        blocoCadastrada.classList.add('d-none')
      }
    } catch (error) {
      console.error('Erro ao carregar assinatura eletrônica:', error)
    }
  }

  function ligarCanvasAssinatura () {
    const canvas = document.getElementById('assinatura-canvas')
    const btnLimpar = document.getElementById('btn-limpar-assinatura')
    const btnSalvar = document.getElementById('btn-salvar-assinatura')
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#212529'

    let desenhando = false
    let houveTraco = false

    function posicaoNoCanvas (evento) {
      const rect = canvas.getBoundingClientRect()
      return {
        x: (evento.clientX - rect.left) * (canvas.width / rect.width),
        y: (evento.clientY - rect.top) * (canvas.height / rect.height)
      }
    }

    canvas.addEventListener('pointerdown', evento => {
      desenhando = true
      houveTraco = true
      const { x, y } = posicaoNoCanvas(evento)
      ctx.beginPath()
      ctx.moveTo(x, y)
      canvas.setPointerCapture(evento.pointerId)
    })

    canvas.addEventListener('pointermove', evento => {
      if (!desenhando) return
      const { x, y } = posicaoNoCanvas(evento)
      ctx.lineTo(x, y)
      ctx.stroke()
    })

    const pararDeDesenhar = () => { desenhando = false }
    canvas.addEventListener('pointerup', pararDeDesenhar)
    canvas.addEventListener('pointerleave', pararDeDesenhar)

    btnLimpar?.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      houveTraco = false
    })

    btnSalvar?.addEventListener('click', async () => {
      if (!houveTraco) {
        Swal.fire({ icon: 'warning', title: 'Assinatura vazia', text: 'Desenhe sua assinatura antes de salvar.' })
        return
      }

      try {
        await ApiService.cadastrarAssinatura(canvas.toDataURL('image/png'))
        toastSucesso('Assinatura cadastrada!')
        await carregarAssinatura()
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Erro ao salvar assinatura',
          text: error.message || 'Comportamento inesperado. Tente novamente.'
        })
      }
    })
  }

  async function carregarMeuPerfilRh () {
    const erroEl = document.getElementById('perfilrh-page-error')
    const semPerfilEl = document.getElementById('perfilrh-sem-perfil-rh')
    const conteudoEl = document.getElementById('conteudo-perfil-rh')
    erroEl?.classList.add('d-none')
    semPerfilEl?.classList.add('d-none')
    conteudoEl?.classList.add('d-none')

    try {
      const perfil = await ApiService.getMeuPerfilRh()
      if (!perfil) {
        semPerfilEl?.classList.remove('d-none')
        return
      }

      document.getElementById('rh-cargo').textContent = perfil.cargo
      document.getElementById('rh-vaga-origem').textContent = perfil.vagaOrigem || 'Não informada.'
      document.getElementById('rh-contrato').textContent = perfil.tipoContrato === 'pj' ? 'PJ (Pessoa Jurídica)' : 'CLT'
      document.getElementById('rh-admissao').textContent = formatarDataBrPerfilRh(perfil.dataAdmissao)
      document.getElementById('rh-dias-escala').textContent = formatarDiasEscala(perfil.diasEscala)
      document.getElementById('rh-horas').textContent = `${perfil.horasPorDia}h por dia`
      const horasPorSemana = perfil.horasPorDia * (perfil.diasEscala?.length || 0)
      document.getElementById('rh-horas-semana').textContent = `${horasPorSemana}h por semana`
      document.getElementById('rh-horas-mes').textContent = `${Math.round(horasPorSemana * (52 / 12) * 10) / 10}h por mês`
      document.getElementById('rh-hora-inicio').textContent = perfil.horaInicioEscala
      document.getElementById('rh-salario').textContent = formatarMoedaBr(perfil.salarioBase)
      document.getElementById('rh-banco').textContent = perfil.bancoNome
      document.getElementById('rh-agencia').textContent = perfil.agencia
      document.getElementById('rh-conta').textContent = perfil.contaBancaria

      const gestorEl = document.getElementById('rh-gestor')
      if (gestorEl) {
        gestorEl.textContent = perfil.gestor
          ? `${perfil.gestor.nome}${perfil.gestor.perfilRH?.cargo ? ` (${perfil.gestor.perfilRH.cargo})` : ''}`
          : 'Ainda não definido — fale com o RH.'
      }

      renderizarListaTexto('rh-lista-direitos', perfil.direitos)
      renderizarListaTexto('rh-lista-deveres', perfil.deveres)
      renderizarListaTexto('rh-lista-tarefas', perfil.tarefas)

      document.getElementById('rh-beneficio-vale').textContent = MAPA_VALE_TRANSPORTE[perfil.tipoValeTransporte] || 'Nenhum'
      document.getElementById('rh-beneficio-bonus').textContent = perfil.bonusDesempenho != null ? formatarMoedaBr(perfil.bonusDesempenho) : 'Não definido.'
      document.getElementById('rh-beneficio-obs').textContent = perfil.observacoesBeneficios || 'Nenhuma.'

      await carregarTrilhaCarreira(perfil)

      conteudoEl?.classList.remove('d-none')
    } catch (error) {
      console.error('Erro ao carregar meus dados de RH:', error)
      erroEl?.classList.remove('d-none')
    }
  }
})()

// --- SEÇÃO: CONTRATO DE TRABALHO ---
// Fora de qualquer IIFE de propósito: chamado tanto pela seção "MEUS DADOS
// DE RH" (histórico de versões) quanto por "NOTIFICAÇÕES" (botão de
// assinar/baixar direto na notificação) — as duas seções são IIFEs isoladas
// sem escopo compartilhado.
function badgeStatusContrato (status) {
  const mapa = {
    pendente_assinatura: '<span class="badge bg-warning text-dark">Aguardando assinatura</span>',
    assinado: '<span class="badge bg-success">Assinado</span>'
  }
  return mapa[status] || status
}

function acoesContrato (contrato) {
  if (contrato.status === 'assinado') {
    return `<button type="button" class="btn btn-sm btn-outline-primary btn-baixar-contrato-versao" data-id="${contrato.id}"><i class="fas fa-download me-1" aria-hidden="true"></i>Baixar PDF</button>`
  }
  return `<button type="button" class="btn btn-sm btn-success btn-assinar-contrato-versao" data-id="${contrato.id}"><i class="fas fa-signature me-1" aria-hidden="true"></i>Revisar e Assinar</button>`
}

async function carregarHistoricoContratos () {
  const tbody = document.getElementById('tbody-contratos-trabalho')
  if (!tbody) return
  tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Carregando...</td></tr>'
  try {
    const contratos = await ApiService.getContratosTrabalho()
    if (!contratos || contratos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Nenhuma versão de contrato gerada ainda.</td></tr>'
      return
    }
    tbody.innerHTML = contratos.map(c => `
      <tr>
        <td>v${c.numeroVersao}</td>
        <td>${new Date(c.geradoEm).toLocaleDateString('pt-BR')}</td>
        <td>${badgeStatusContrato(c.status)}</td>
        <td>${acoesContrato(c)}</td>
      </tr>
    `).join('')
    tbody.querySelectorAll('.btn-assinar-contrato-versao').forEach(btn => {
      btn.addEventListener('click', () => assinarContratoTrabalho(btn.getAttribute('data-id')))
    })
    tbody.querySelectorAll('.btn-baixar-contrato-versao').forEach(btn => {
      btn.addEventListener('click', () => baixarContratoTrabalhoPdf(btn.getAttribute('data-id')))
    })
  } catch (error) {
    console.error('Erro ao carregar histórico de contratos:', error)
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-3">Não foi possível carregar o histórico.</td></tr>'
  }
}

async function assinarContratoTrabalho (id) {
  const confirmacao = await Swal.fire({
    icon: 'question',
    title: 'Assinar esta versão do contrato?',
    text: 'Sua assinatura eletrônica cadastrada será aplicada a este documento. Depois de assinado, o PDF fica disponível e a versão não pode mais ser alterada.',
    showCancelButton: true,
    confirmButtonText: 'Sim, assinar',
    cancelButtonText: 'Cancelar'
  })
  if (!confirmacao.isConfirmed) return

  try {
    await ApiService.assinarContratoTrabalho(id)
    toastSucesso('Contrato assinado!')
    await carregarHistoricoContratos()
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Não foi possível assinar',
      text: error.message || 'Cadastre sua assinatura eletrônica em "Dados do RH" antes de assinar documentos.'
    })
  }
}

async function baixarContratoTrabalhoPdf (id) {
  try {
    const blob = await ApiService.baixarPdfContratoTrabalho(id)
    baixarArquivoExportado(blob, 'contrato-de-trabalho.pdf', 'application/pdf')
  } catch (error) {
    Swal.fire({ icon: 'error', title: 'Não foi possível baixar o contrato', text: error.message || 'Tente novamente.' })
  }
}

// --- SEÇÃO: NOTIFICAÇÕES ---
;(function () {
  function formatarDataHoraBr (dataIso) {
    if (!dataIso) return '-'
    return new Date(dataIso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  const ICONES_TIPO_NOTIFICACAO = {
    folha_ponto: 'fa-calendar-days',
    holerite: 'fa-file-invoice-dollar',
    ferias: 'fa-umbrella-beach',
    geral: 'fa-bell',
    contrato: 'fa-file-signature'
  }

  // Notificações simuladas (não vêm do backend) para visualizar o layout
  // da caixa de entrada com dados variados. São mescladas com as reais e
  // marcadas com o selo "Exemplo".
  const NOTIFICACOES_SIMULADAS = [
    {
      id: 'mock-1',
      tipo: 'folha_ponto',
      titulo: 'Espelho de ponto de agosto/2026 disponível',
      mensagem: 'Seu espelho de ponto do mês está pronto para revisão e assinatura.',
      criadoEm: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      lida: false,
      simulada: true,
      folhaPontoId: 'mock-folha-1',
      folhaPonto: { status: 'gerado' }
    },
    {
      id: 'mock-2',
      tipo: 'holerite',
      titulo: 'Holerite de agosto/2026 disponível',
      mensagem: 'Seu holerite já pode ser revisado, assinado e baixado.',
      criadoEm: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      lida: false,
      simulada: true,
      holeriteId: 'mock-holerite-1',
      holerite: { status: 'gerado' }
    },
    {
      id: 'mock-3',
      tipo: 'ferias',
      titulo: 'Solicitação de férias aprovada',
      mensagem: 'Suas férias de 12/09 a 02/10 foram aprovadas pelo seu gestor.',
      criadoEm: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      lida: true,
      simulada: true
    },
    {
      id: 'mock-4',
      tipo: 'geral',
      titulo: 'Bem-vindo(a) ao portal de RH',
      mensagem: 'Aqui você acompanha ponto, férias, folha de pagamento e mais.',
      criadoEm: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      lida: true,
      simulada: true
    },
    {
      id: 'mock-5',
      tipo: 'holerite',
      titulo: 'Holerite de julho/2026 assinado',
      mensagem: 'Seu holerite já foi assinado e está disponível para download.',
      criadoEm: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      lida: true,
      simulada: true,
      holeriteId: 'mock-holerite-2',
      holerite: { status: 'pago' }
    }
  ]

  function comSimulacoes (notificacoes) {
    return [...NOTIFICACOES_SIMULADAS, ...(notificacoes || [])]
      .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
  }

  document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('notif-btn-retry-page')?.addEventListener('click', carregarNotificacoes)
    await carregarNotificacoes()
  })

  async function carregarNotificacoes () {
    const erroEl = document.getElementById('notif-page-error')
    const listaEl = document.getElementById('lista-notificacoes')
    erroEl?.classList.add('d-none')
    if (listaEl) listaEl.innerHTML = '<p class="text-muted text-center py-4">Carregando...</p>'

    try {
      const notificacoes = comSimulacoes(await ApiService.getMinhasNotificacoes())
      renderizarNotificacoes(notificacoes)
      atualizarBadgeNaoLidas(notificacoes)
    } catch (error) {
      console.error('Erro ao carregar notificações:', error)
      erroEl?.classList.remove('d-none')
      if (listaEl) listaEl.innerHTML = ''
    }
  }

  function atualizarBadgeNaoLidas (notificacoes) {
    const badge = document.getElementById('badge-notificacoes-nao-lidas')
    if (!badge) return
    const naoLidas = notificacoes.filter(n => !n.lida).length
    if (naoLidas > 0) {
      badge.textContent = naoLidas
      badge.classList.remove('d-none')
    } else {
      badge.classList.add('d-none')
    }
  }

  function botaoMarcarLida (notificacao) {
    if (notificacao.lida) return ''
    return `
            <button type="button" class="btn btn-sm btn-outline-secondary btn-marcar-lida" data-id="${notificacao.id}">
              Marcar como lida
            </button>
          `
  }

  function botaoDocumento (notificacao) {
    if (notificacao.tipo === 'folha_ponto' && notificacao.folhaPontoId) {
      if (notificacao.folhaPonto?.status === 'assinado') {
        return `
            <button type="button" class="btn btn-sm btn-primary btn-baixar-espelho" data-id="${notificacao.folhaPontoId}">
              <i class="fas fa-download me-1" aria-hidden="true"></i>Baixar PDF
            </button>
          `
      }
      return `
            <button type="button" class="btn btn-sm btn-success btn-assinar-espelho" data-id="${notificacao.folhaPontoId}">
              <i class="fas fa-signature me-1" aria-hidden="true"></i>Revisar e Assinar
            </button>
          `
    }

    if (notificacao.tipo === 'holerite' && notificacao.holeriteId) {
      if (notificacao.holerite?.status === 'assinado' || notificacao.holerite?.status === 'pago') {
        return `
            <button type="button" class="btn btn-sm btn-primary btn-baixar-holerite" data-id="${notificacao.holeriteId}">
              <i class="fas fa-download me-1" aria-hidden="true"></i>Baixar PDF
            </button>
          `
      }
      return `
            <button type="button" class="btn btn-sm btn-success btn-assinar-holerite" data-id="${notificacao.holeriteId}">
              <i class="fas fa-signature me-1" aria-hidden="true"></i>Revisar e Assinar
            </button>
          `
    }

    if (notificacao.tipo === 'contrato' && notificacao.contratoId) {
      if (notificacao.contrato?.status === 'assinado') {
        return `
            <button type="button" class="btn btn-sm btn-primary btn-baixar-contrato-notif" data-id="${notificacao.contratoId}">
              <i class="fas fa-download me-1" aria-hidden="true"></i>Baixar PDF
            </button>
          `
      }
      return `
            <button type="button" class="btn btn-sm btn-success btn-assinar-contrato-notif" data-id="${notificacao.contratoId}">
              <i class="fas fa-signature me-1" aria-hidden="true"></i>Revisar e Assinar
            </button>
          `
    }

    return ''
  }

  function renderizarNotificacoes (notificacoes) {
    const listaEl = document.getElementById('lista-notificacoes')
    if (!listaEl) return

    if (notificacoes.length === 0) {
      listaEl.innerHTML = '<p class="text-muted text-center py-4">Nenhuma notificação por enquanto.</p>'
      return
    }

    listaEl.innerHTML = notificacoes.map(n => `
      <div class="card shadow-sm ${n.lida ? '' : 'border-primary'}" data-id="${n.id}">
        <div class="card-body py-3 d-flex align-items-start gap-3">
          <i class="fas ${ICONES_TIPO_NOTIFICACAO[n.tipo] || 'fa-bell'} text-primary fs-5 mt-1" aria-hidden="true"></i>
          <div class="flex-grow-1">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <strong>${ApiService.sanitizeText(n.titulo)}</strong>
              ${n.lida ? '' : '<span class="badge bg-primary">Nova</span>'}
              ${n.simulada ? '<span class="badge bg-secondary">Exemplo</span>' : ''}
            </div>
            <p class="mb-1">${ApiService.sanitizeText(n.mensagem)}</p>
            <span class="text-muted text-xs">${formatarDataHoraBr(n.criadoEm)}</span>
          </div>
          <div class="d-flex flex-column gap-1 align-items-end">
            ${botaoDocumento(n)}
            ${botaoMarcarLida(n)}
          </div>
        </div>
      </div>
    `).join('')

    listaEl.querySelectorAll('.btn-assinar-espelho').forEach(btn => {
      btn.addEventListener('click', () => assinarEspelhoPonto(btn.getAttribute('data-id')))
    })
    listaEl.querySelectorAll('.btn-baixar-espelho').forEach(btn => {
      btn.addEventListener('click', () => baixarEspelhoPontoPdf(btn.getAttribute('data-id')))
    })
    listaEl.querySelectorAll('.btn-assinar-holerite').forEach(btn => {
      btn.addEventListener('click', () => assinarHolerite(btn.getAttribute('data-id')))
    })
    listaEl.querySelectorAll('.btn-baixar-holerite').forEach(btn => {
      btn.addEventListener('click', () => baixarHoleritePdf(btn.getAttribute('data-id')))
    })
    listaEl.querySelectorAll('.btn-assinar-contrato-notif').forEach(btn => {
      btn.addEventListener('click', () => assinarContratoTrabalho(btn.getAttribute('data-id')))
    })
    listaEl.querySelectorAll('.btn-baixar-contrato-notif').forEach(btn => {
      btn.addEventListener('click', () => baixarContratoTrabalhoPdf(btn.getAttribute('data-id')))
    })

    listaEl.querySelectorAll('.btn-marcar-lida').forEach(btn => {
      btn.addEventListener('click', () => marcarComoLida(btn.getAttribute('data-id')))
    })
  }

  function ehSimulada (id) {
    return String(id).startsWith('mock-')
  }

  async function marcarComoLida (id) {
    if (ehSimulada(id)) {
      const notificacao = NOTIFICACOES_SIMULADAS.find(n => n.id === id)
      if (notificacao) notificacao.lida = true
      await carregarNotificacoes()
      return
    }

    try {
      await ApiService.marcarNotificacaoComoLida(id)
      await carregarNotificacoes()
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error)
    }
  }

  async function assinarEspelhoPonto (folhaPontoId) {
    const confirmacao = await Swal.fire({
      icon: 'question',
      title: 'Assinar espelho de ponto?',
      text: 'Sua assinatura eletrônica cadastrada será aplicada a este documento. Depois de assinado, ele fica disponível para download.',
      showCancelButton: true,
      confirmButtonText: 'Sim, assinar',
      cancelButtonText: 'Cancelar'
    })
    if (!confirmacao.isConfirmed) return

    if (ehSimulada(folhaPontoId)) {
      const notificacao = NOTIFICACOES_SIMULADAS.find(n => n.folhaPontoId === folhaPontoId)
      if (notificacao) { notificacao.lida = true; notificacao.folhaPonto = { status: 'assinado' } }
      toastSucesso('Espelho de ponto assinado! (exemplo simulado)')
      await carregarNotificacoes()
      return
    }

    try {
      await ApiService.assinarEspelhoPonto(folhaPontoId)
      toastSucesso('Espelho de ponto assinado!')
      await carregarNotificacoes()
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Não foi possível assinar',
        text: error.message || 'Cadastre sua assinatura eletrônica em "Dados do RH" antes de assinar documentos.'
      })
    }
  }

  async function baixarEspelhoPontoPdf (folhaPontoId) {
    if (ehSimulada(folhaPontoId)) {
      Swal.fire({ icon: 'info', title: 'Notificação de exemplo', text: 'Esta notificação é apenas uma simulação visual — não existe um PDF real para baixar.' })
      return
    }

    try {
      const blob = await ApiService.baixarPdfEspelhoPonto(folhaPontoId)
      baixarArquivoExportado(blob, 'espelho-de-ponto.pdf', 'application/pdf')
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Não foi possível baixar o PDF', text: error.message || 'Tente novamente.' })
    }
  }

  async function assinarHolerite (holeriteId) {
    const confirmacao = await Swal.fire({
      icon: 'question',
      title: 'Assinar holerite?',
      text: 'Sua assinatura eletrônica cadastrada será aplicada a este documento. Depois de assinado, ele fica disponível para download.',
      showCancelButton: true,
      confirmButtonText: 'Sim, assinar',
      cancelButtonText: 'Cancelar'
    })
    if (!confirmacao.isConfirmed) return

    if (ehSimulada(holeriteId)) {
      const notificacao = NOTIFICACOES_SIMULADAS.find(n => n.holeriteId === holeriteId)
      if (notificacao) { notificacao.lida = true; notificacao.holerite = { status: 'assinado' } }
      toastSucesso('Holerite assinado! (exemplo simulado)')
      await carregarNotificacoes()
      return
    }

    try {
      await ApiService.assinarHolerite(holeriteId)
      toastSucesso('Holerite assinado!')
      await carregarNotificacoes()
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Não foi possível assinar',
        text: error.message || 'Cadastre sua assinatura eletrônica em "Dados do RH" antes de assinar documentos.'
      })
    }
  }

  async function baixarHoleritePdf (holeriteId) {
    if (ehSimulada(holeriteId)) {
      Swal.fire({ icon: 'info', title: 'Notificação de exemplo', text: 'Esta notificação é apenas uma simulação visual — não existe um PDF real para baixar.' })
      return
    }

    try {
      const blob = await ApiService.baixarPdfHolerite(holeriteId)
      baixarArquivoExportado(blob, 'holerite.pdf', 'application/pdf')
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Não foi possível baixar o PDF', text: error.message || 'Tente novamente.' })
    }
  }
})()

// --- SEÇÃO: FOLHA DE PAGAMENTO ---
;(function () {
  function formatarMoedaHolerite (valor) {
    const numero = Number(valor)
    if (Number.isNaN(numero)) return '-'
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function badgeStatusHolerite (status) {
    const mapa = {
      gerado: '<span class="badge bg-warning text-dark">Aguardando assinatura</span>',
      assinado: '<span class="badge bg-info text-dark">Assinado</span>',
      pago: '<span class="badge bg-success">Pago</span>'
    }
    return mapa[status] || status
  }

  document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('folha-btn-retry-page')?.addEventListener('click', inicializarPagina)
    document.getElementById('btn-recarregar-holerites')?.addEventListener('click', carregarHolerites)
    document.getElementById('form-gerar-holerite')?.addEventListener('submit', gerarHolerite)
    await inicializarPagina()
  })

  async function inicializarPagina () {
    const erroEl = document.getElementById('folha-page-error')
    erroEl?.classList.add('d-none')

    const podeGerenciar = typeof AuthService !== 'undefined' && AuthService.ehRhOuAdmin()

    try {
      const tarefas = [carregarHolerites()]
      if (podeGerenciar) {
        document.getElementById('folha-card-gerar-holerite')?.classList.remove('d-none')
        tarefas.push(carregarFuncionarios())
      }
      await Promise.all(tarefas)
    } catch (error) {
      console.error('Erro ao carregar seção de folha de pagamento:', error)
      erroEl?.classList.remove('d-none')
    }
  }

  async function carregarFuncionarios () {
    const select = document.getElementById('select-holerite-funcionario')
    if (!select) return

    try {
      const usuarios = await ApiService.getUsuarios()
      const ativos = (usuarios || []).filter(u => u.ativo !== false)
      select.innerHTML = ativos
        .map(u => `<option value="${u.id}">${ApiService.sanitizeText(u.nome)}</option>`)
        .join('')
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error)
    }
  }

  async function gerarHolerite (evento) {
    evento.preventDefault()
    const usuarioId = document.getElementById('select-holerite-funcionario').value
    const referencia = document.getElementById('input-holerite-referencia').value
    if (!usuarioId || !referencia) return

    try {
      await ApiService.gerarHolerite(usuarioId, referencia)
      toastSucesso('Holerite gerado e enviado para a caixa de notificações do funcionário!')
      document.getElementById('form-gerar-holerite').reset()
      await carregarHolerites()
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Não foi possível gerar o holerite', text: error.message || 'Tente novamente.' })
    }
  }

  function acoesHolerite (holerite, podeGerenciar) {
    const botoes = []
    if (holerite.status === 'assinado' || holerite.status === 'pago') {
      botoes.push(`
        <button type="button" class="btn btn-sm btn-outline-primary btn-baixar-holerite-rh" data-id="${holerite.id}">
          <i class="fas fa-download" aria-hidden="true"></i>
        </button>
      `)
    }
    if (holerite.status === 'assinado' && podeGerenciar) {
      botoes.push(`
        <button type="button" class="btn btn-sm btn-outline-success btn-pagar-holerite" data-id="${holerite.id}">
          <i class="fas fa-money-bill-wave me-1" aria-hidden="true"></i>Marcar como pago
        </button>
      `)
    }
    return botoes.join(' ') || '<span class="text-muted text-xs">Aguardando o funcionário assinar</span>'
  }

  async function carregarHolerites () {
    const tbody = document.getElementById('tbody-holerites')
    if (!tbody) return
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Carregando...</td></tr>'

    const podeGerenciar = typeof AuthService !== 'undefined' && AuthService.ehRhOuAdmin()

    try {
      const holerites = await ApiService.getHolerites()
      if (!holerites || holerites.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Nenhum holerite gerado ainda.</td></tr>'
        return
      }

      tbody.innerHTML = holerites.map(h => `
        <tr>
          <td>${ApiService.sanitizeText(h.usuario?.nome || h.usuarioId)}</td>
          <td>${h.referencia}</td>
          <td>${formatarMoedaHolerite(h.salarioLiquido)}</td>
          <td>${badgeStatusHolerite(h.status)}</td>
          <td>${acoesHolerite(h, podeGerenciar)}</td>
        </tr>
      `).join('')

      tbody.querySelectorAll('.btn-pagar-holerite').forEach(btn => {
        btn.addEventListener('click', () => pagarHolerite(btn.getAttribute('data-id')))
      })
      tbody.querySelectorAll('.btn-baixar-holerite-rh').forEach(btn => {
        btn.addEventListener('click', () => baixarHoleriteRh(btn.getAttribute('data-id')))
      })
    } catch (error) {
      console.error('Erro ao carregar holerites:', error)
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-3">Não foi possível carregar o histórico.</td></tr>'
    }
  }

  async function pagarHolerite (id) {
    const confirmacao = await Swal.fire({
      icon: 'question',
      title: 'Marcar como pago?',
      text: 'Isto simula o pagamento (não integra nenhum banco de verdade) e não pode ser desfeito.',
      showCancelButton: true,
      confirmButtonText: 'Sim, marcar como pago',
      cancelButtonText: 'Cancelar'
    })
    if (!confirmacao.isConfirmed) return

    try {
      await ApiService.pagarHolerite(id)
      toastSucesso('Holerite marcado como pago (simulado)!')
      await carregarHolerites()
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Não foi possível marcar como pago', text: error.message || 'Tente novamente.' })
    }
  }

  async function baixarHoleriteRh (id) {
    try {
      const blob = await ApiService.baixarPdfHolerite(id)
      baixarArquivoExportado(blob, 'holerite.pdf', 'application/pdf')
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Não foi possível baixar o PDF', text: error.message || 'Tente novamente.' })
    }
  }
})()

// --- SEÇÃO: AUDITORIA (só RH/admin) ---
;(function () {
  let registrosAtuais = []

  function formatarDataHoraBr (dataIso) {
    if (!dataIso) return '-'
    const data = new Date(dataIso)
    if (Number.isNaN(data.getTime())) return '-'
    return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof AuthService === 'undefined' || !AuthService.ehRhOuAdmin()) return

    document.getElementById('rh-tab-auditoria-item')?.classList.remove('d-none')
    document.getElementById('auditoria-btn-retry-page')?.addEventListener('click', () => carregarAuditoria())
    document.getElementById('form-filtro-auditoria')?.addEventListener('submit', evento => {
      evento.preventDefault()
      carregarAuditoria()
    })
    document.getElementById('btn-exportar-auditoria-csv')?.addEventListener('click', () => exportarAuditoria('csv'))
    document.getElementById('btn-exportar-auditoria-excel')?.addEventListener('click', () => exportarAuditoria('excel'))

    carregarAuditoria()
  })

  async function carregarAuditoria () {
    const tbody = document.getElementById('tbody-auditoria')
    const erroEl = document.getElementById('auditoria-page-error')
    if (!tbody) return

    erroEl?.classList.add('d-none')
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Carregando...</td></tr>'

    const entidade = document.getElementById('input-auditoria-entidade')?.value.trim()
    const entidadeId = document.getElementById('input-auditoria-entidade-id')?.value.trim()

    try {
      const registros = await ApiService.getAuditoria({ entidade, entidadeId })
      registrosAtuais = registros || []

      if (registrosAtuais.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Nenhum registro encontrado.</td></tr>'
        return
      }

      tbody.innerHTML = registrosAtuais.map(r => `
        <tr>
          <td>${formatarDataHoraBr(r.criadoEm)}</td>
          <td>${ApiService.sanitizeText(r.usuario?.nome || r.usuarioId)}</td>
          <td>${ApiService.sanitizeText(AuthService.rotuloPapel(r.papel))}</td>
          <td>${ApiService.sanitizeText(r.acao)}</td>
          <td>${ApiService.sanitizeText(r.entidade)} <span class="text-muted text-xs">${ApiService.sanitizeText(r.entidadeId)}</span></td>
          <td>
            <button type="button" class="btn btn-sm btn-outline-secondary btn-detalhes-auditoria" data-id="${r.id}">
              <i class="fas fa-eye me-1" aria-hidden="true"></i>Ver
            </button>
          </td>
        </tr>
      `).join('')

      tbody.querySelectorAll('.btn-detalhes-auditoria').forEach(btn => {
        btn.addEventListener('click', () => abrirModalDetalhesAuditoria(btn.getAttribute('data-id')))
      })
    } catch (error) {
      console.error('Erro ao carregar auditoria:', error)
      erroEl?.classList.remove('d-none')
      tbody.innerHTML = ''
    }
  }

  function abrirModalDetalhesAuditoria (id) {
    const registro = registrosAtuais.find(r => r.id === id)
    if (!registro) return

    const formatarJson = valor => (valor === null || valor === undefined)
      ? '<span class="text-muted">— nenhum dado —</span>'
      : `<pre class="text-start bg-light p-2 rounded text-xs mb-0" style="max-height:220px;overflow:auto">${ApiService.sanitizeText(JSON.stringify(valor, null, 2))}</pre>`

    Swal.fire({
      title: 'Detalhes da ação',
      width: '650px',
      html: `
        <div class="text-start mb-3">
          <div><strong>Ação:</strong> ${ApiService.sanitizeText(registro.acao)}</div>
          <div><strong>Entidade:</strong> ${ApiService.sanitizeText(registro.entidade)} <span class="text-muted text-xs">${ApiService.sanitizeText(registro.entidadeId)}</span></div>
          <div><strong>Quem fez:</strong> ${ApiService.sanitizeText(registro.usuario?.nome || registro.usuarioId)} (${ApiService.sanitizeText(AuthService.rotuloPapel(registro.papel))})</div>
          <div><strong>Quando:</strong> ${formatarDataHoraBr(registro.criadoEm)}</div>
        </div>
        <div class="text-start mb-2">
          <label class="form-label fw-bold mb-1">Antes</label>
          ${formatarJson(registro.dadosAntes)}
        </div>
        <div class="text-start">
          <label class="form-label fw-bold mb-1">Depois</label>
          ${formatarJson(registro.dadosDepois)}
        </div>
      `,
      confirmButtonText: 'Fechar'
    })
  }

  function exportarAuditoria (formato) {
    const colunas = [
      { chave: 'dataHora', rotulo: 'Data/Hora' },
      { chave: 'usuario', rotulo: 'Usuário' },
      { chave: 'papel', rotulo: 'Papel' },
      { chave: 'acao', rotulo: 'Ação' },
      { chave: 'entidade', rotulo: 'Entidade' },
      { chave: 'entidadeId', rotulo: 'ID da Entidade' },
      { chave: 'dadosAntes', rotulo: 'Dados Antes' },
      { chave: 'dadosDepois', rotulo: 'Dados Depois' }
    ]

    const linhas = registrosAtuais.map(r => ({
      dataHora: formatarDataHoraBr(r.criadoEm),
      usuario: r.usuario?.nome || r.usuarioId,
      papel: AuthService.rotuloPapel(r.papel),
      acao: r.acao,
      entidade: r.entidade,
      entidadeId: r.entidadeId,
      dadosAntes: r.dadosAntes ? JSON.stringify(r.dadosAntes) : '',
      dadosDepois: r.dadosDepois ? JSON.stringify(r.dadosDepois) : ''
    }))

    if (formato === 'excel') {
      exportarParaExcel('auditoria-parkgestao.xlsx', 'Auditoria', colunas, linhas)
    } else {
      exportarParaCSV('auditoria-parkgestao.csv', colunas, linhas)
    }
  }
})()
