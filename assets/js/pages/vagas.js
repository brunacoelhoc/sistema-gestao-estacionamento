/**
 * Lógica da Página de Mapa Visual de Vagas
 * Renderização dinâmica do grid e alternância de status.
 */

let todasalgunsvagas = []

document.addEventListener('DOMContentLoaded', async () => {
  await carregarMapaVagas()

  // Evento do filtro de categoria
  document.getElementById('filtro-tipo-vaga')?.addEventListener('change', e => {
    filtrarVagasPorTipo(e.target.value)
  })
})

// Busca as vagas na API
async function carregarMapaVagas () {
  try {
    todasalgunsvagas = await ApiService.getVagas()
    renderizarGridVagas(todasalgunsvagas)
  } catch (error) {
    console.error('Erro ao carregar mapa de vagas:', error)
    Swal.fire({
      icon: 'error',
      title: 'Erro de Conexão',
      text: 'Não foi possível carregar o mapa de vagas do servidor.'
    })
  }
}

// Renderiza o Grid de Vagas
function renderizarGridVagas (vagasList) {
  const gridContainer = document.getElementById('grid-mapa-vagas')
  gridContainer.innerHTML = ''

  if (!vagasList || vagasList.length === 0) {
    gridContainer.innerHTML = `
      <div class="col-12 text-center py-5 text-muted">
        <i class="fas fa-search me-2"></i>Nenhuma vaga encontrada para esta categoria.
      </div>
    `
    return
  }

  vagasList.forEach(vaga => {
    const card = document.createElement('div')

    // Mapeamento de classe por status
    let statusClass = 'vaga-livre'
    let statusText = 'Livre'
    let iconClass = 'fa-check-circle'

    if (vaga.status === 'Ocupada') {
      statusClass = 'vaga-ocupada'
      statusText = 'Ocupada'
      iconClass = 'fa-car'
    } else if (vaga.status === 'Manutenção') {
      statusClass = 'vaga-manutencao bg-warning-subtle text-dark border-warning'
      statusText = 'Manutenção'
      iconClass = 'fa-tools'
    }

    card.className = `vaga-card ${statusClass} shadow-sm position-relative style="cursor: pointer;"`
    card.setAttribute('role', 'button')
    card.setAttribute('tabindex', '0')
    card.setAttribute(
      'aria-label',
      `Vaga ${vaga.codigo}, Categoria ${vaga.tipo}, Status ${statusText}`
    )

    card.innerHTML = `
      <div class="vaga-codigo"><i class="fas ${iconClass} me-1"></i> ${ApiService.sanitizeText(
      vaga.codigo
    )}</div>
      <div class="vaga-tipo fw-semibold">${ApiService.sanitizeText(
        vaga.tipo
      )}</div>
      <div class="small mt-1 text-opacity-75">${ApiService.sanitizeText(
        vaga.localizacao
      )}</div>
      <div class="mt-2">
        <span class="badge bg-dark text-white text-xs">${statusText}</span>
      </div>
    `

    // Evento para alterar status da vaga (por exemplo, colocar em manutenção)
    card.addEventListener('click', () => abrirOpcoesVaga(vaga))

    gridContainer.appendChild(card)
  })
}

// Filtra vagas por tipo/categoria
function filtrarVagasPorTipo (tipo) {
  if (tipo === 'TODOS') {
    renderizarGridVagas(todasalgunsvagas)
  } else {
    const filtradas = todasalgunsvagas.filter(
      v => v.tipo.toLowerCase() === tipo.toLowerCase()
    )
    renderizarGridVagas(filtradas)
  }
}

// Opções rápidas ao clicar na vaga
async function abrirOpcoesVaga (vaga) {
  const result = await Swal.fire({
    title: `Vaga ${vaga.codigo}`,
    html: `
      <p class="mb-1"><strong>Setor:</strong> ${ApiService.sanitizeText(
        vaga.localizacao
      )}</p>
      <p class="mb-1"><strong>Tipo:</strong> ${ApiService.sanitizeText(
        vaga.tipo
      )}</p>
      <p><strong>Status Atual:</strong> ${ApiService.sanitizeText(
        vaga.status
      )}</p>
    `,
    icon: 'info',
    showCancelButton: true,
    showDenyButton: vaga.status !== 'Ocupada',
    confirmButtonText:
      vaga.status === 'Livre' ? 'Marcar em Manutenção' : 'Liberar Vaga (Livre)',
    confirmButtonColor: vaga.status === 'Livre' ? '#ffc107' : '#198754',
    cancelButtonText: 'Fechar'
  })

  if (result.isConfirmed) {
    const novoStatus = vaga.status === 'Livre' ? 'Manutenção' : 'Livre'
    try {
      await ApiService.updateVagaStatus(vaga.id, novoStatus)
      Swal.fire({
        icon: 'success',
        title: 'Status Atualizado!',
        text: `Vaga ${vaga.codigo} agora está marcado como ${novoStatus}.`,
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
