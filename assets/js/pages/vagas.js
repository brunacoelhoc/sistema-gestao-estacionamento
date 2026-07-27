/**
 * Lógica da Página de Mapa Visual de Vagas
 * Renderização dinâmica do grid e alternância de status.
 */

let todasVagas = []

document.addEventListener('DOMContentLoaded', async () => {
  await carregarMapaVagas()

  // Evento do filtro de categoria
  document.getElementById('filtro-tipo-vaga')?.addEventListener('change', e => {
    filtrarVagasPorTipo(e.target.value)
  })

  // Botão "Tentar novamente" do banner de erro global da página
  document.getElementById('btn-retry-page')?.addEventListener('click', () => {
    carregarMapaVagas()
  })
})

// Mapeamento único de status -> classe do card, classe do badge, ícone e texto.
// Mantém tudo em UM lugar para não repetir (e desalinhar) essa lógica em vários pontos.
const STATUS_VAGA = {
  livre: {
    cardClass: 'vaga-livre',
    badgeClass: 'status-livre',
    icon: 'fa-check-circle',
    texto: 'Livre'
  },
  ocupada: {
    cardClass: 'vaga-ocupada',
    badgeClass: 'status-ocupada',
    icon: 'fa-car',
    texto: 'Ocupada'
  },
  manutencao: {
    cardClass: 'vaga-manutencao',
    badgeClass: 'status-manutencao',
    icon: 'fa-tools',
    texto: 'Manutenção'
  }
}

// Busca as vagas na API
async function carregarMapaVagas () {
  const gridContainer = document.getElementById('grid-mapa-vagas')
  const pageError = document.getElementById('page-error')
  const pageErrorText = document.getElementById('page-error-text')

  pageError?.classList.add('d-none')
  gridContainer?.setAttribute('aria-busy', 'true')

  try {
    todasVagas = await ApiService.getVagas()
    renderizarGridVagas(todasVagas)
  } catch (error) {
    console.error('Erro ao carregar mapa de vagas:', error)

    if (pageError && pageErrorText) {
      pageErrorText.textContent =
        'Não foi possível carregar o mapa de vagas. Verifique sua conexão e tente novamente.'
      pageError.classList.remove('d-none')
    }

    Swal.fire({
      icon: 'error',
      title: 'Erro de Conexão',
      text: 'Não foi possível carregar o mapa de vagas do servidor.'
    })
  } finally {
    gridContainer?.setAttribute('aria-busy', 'false')
  }
}

// Renderiza o Grid de Vagas
function renderizarGridVagas (vagasList) {
  const gridContainer = document.getElementById('grid-mapa-vagas')
  gridContainer.innerHTML = ''

  if (!vagasList || vagasList.length === 0) {
    const vazio = document.createElement('div')
    vazio.className = 'text-center py-5 text-muted'
    vazio.style.gridColumn = '1 / -1' // ocupa a linha inteira do grid
    vazio.innerHTML =
      '<i class="fas fa-search me-2" aria-hidden="true"></i>Nenhuma vaga encontrada para esta categoria.'
    gridContainer.appendChild(vazio)
    return
  }

  vagasList.forEach(vaga => {
    // Normaliza para minúsculo — o db.json é a fonte de verdade, mas isso
    // protege contra pequenas inconsistências de digitação nos dados.
    const statusKey = (vaga.status || '').toLowerCase()
    const info = STATUS_VAGA[statusKey] || STATUS_VAGA.livre

    const card = document.createElement('div')
    card.className = `vaga-card ${info.cardClass} is-interativo shadow-sm position-relative`
    card.setAttribute('role', 'button')
    card.setAttribute('tabindex', '0')
    card.setAttribute(
      'aria-label',
      `Vaga ${vaga.codigo}, categoria ${vaga.tipo}, status ${info.texto}`
    )

    const localizacaoHtml = vaga.localizacao
      ? `<div class="small mt-1 text-opacity-75">${ApiService.sanitizeText(
          vaga.localizacao
        )}</div>`
      : ''

    card.innerHTML = `
      <div class="vaga-codigo">${ApiService.sanitizeText(vaga.codigo)}</div>
      <div class="vaga-tipo fw-semibold">${ApiService.sanitizeText(
        vaga.tipo
      )}</div>
      ${localizacaoHtml}
      <div class="mt-2">
        <span class="badge-status ${info.badgeClass}">
          <i class="fas ${info.icon}" aria-hidden="true"></i> ${info.texto}
        </span>
      </div>
    `

    // Clique com mouse
    card.addEventListener('click', () => abrirOpcoesVaga(vaga))

    // Ativação por teclado (Enter/Espaço) — um <div role="button"> não
    // recebe isso de graça como um <button> nativo receberia.
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        abrirOpcoesVaga(vaga)
      }
    })

    gridContainer.appendChild(card)
  })
}

// Filtra vagas por tipo/categoria
function filtrarVagasPorTipo (tipo) {
  if (tipo === 'TODOS') {
    renderizarGridVagas(todasVagas)
  } else {
    const filtradas = todasVagas.filter(
      v => v.tipo.toLowerCase() === tipo.toLowerCase()
    )
    renderizarGridVagas(filtradas)
  }
}

// Opções rápidas ao clicar na vaga
async function abrirOpcoesVaga (vaga) {
  const statusKey = (vaga.status || '').toLowerCase()

  // Regra de negócio: o status "ocupada" só pode mudar automaticamente, ao
  // fechar o ticket correspondente (ver paginas/tickets.html). Por isso,
  // uma vaga ocupada só mostra informações aqui — sem ação de alterar status.
  if (statusKey === 'ocupada') {
    await Swal.fire({
      title: `Vaga ${ApiService.sanitizeText(vaga.codigo)}`,
      html: `
        <p class="mb-1"><strong>Tipo:</strong> ${ApiService.sanitizeText(
          vaga.tipo
        )}</p>
        <p class="mb-0"><strong>Status Atual:</strong> Ocupada</p>
        <p class="text-muted small mt-2 mb-0">
          Para liberar esta vaga, feche o ticket correspondente na tela de Tickets.
        </p>
      `,
      icon: 'info',
      confirmButtonText: 'Fechar'
    })
    return
  }

  const vaiParaManutencao = statusKey === 'livre'
  const novoStatus = vaiParaManutencao ? 'manutencao' : 'livre'

  const result = await Swal.fire({
    title: `Vaga ${ApiService.sanitizeText(vaga.codigo)}`,
    html: `
      <p class="mb-1"><strong>Tipo:</strong> ${ApiService.sanitizeText(
        vaga.tipo
      )}</p>
      <p class="mb-0"><strong>Status Atual:</strong> ${
        STATUS_VAGA[statusKey]?.texto || 'Livre'
      }</p>
    `,
    icon: 'info',
    showCancelButton: true,
    confirmButtonText: vaiParaManutencao
      ? 'Marcar em Manutenção'
      : 'Liberar (marcar como Livre)',
    // Cores derivadas da paleta do projeto (tons escuros, não os pastéis
    // claros — pastel puro como fundo sólido de botão dá baixo contraste
    // com o texto branco padrão do SweetAlert2, ~1.4:1).
    confirmButtonColor: vaiParaManutencao ? '#4a2c00' : '#0e3a2f', // $color-pendente-text / $color-sucesso-text
    cancelButtonText: 'Fechar'
  })

  if (result.isConfirmed) {
    try {
      await ApiService.updateVagaStatus(vaga.id, novoStatus)
      Swal.fire({
        icon: 'success',
        title: 'Status Atualizado!',
        text: `Vaga ${vaga.codigo} agora está marcada como ${STATUS_VAGA[novoStatus].texto}.`,
        timer: 1500,
        showConfirmButton: false
      })
      await carregarMapaVagas()
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Erro ao atualizar vaga',
        text: error.message
      })
    }
  }
}
