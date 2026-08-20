/**
 * Módulo de Paginação Genérica
 * Cria um paginador para uma tabela: guarda a lista completa de itens,
 * renderiza só a página atual e mantém os controles (texto "Mostrando X–Y de
 * Z", botões anterior/próxima e o seletor de itens por página) sincronizados.
 * Reaproveitado nas telas de Tickets, Vagas, Tarifas, Mensalistas e
 * Funcionários.
 */
function criarPaginador ({
  idSufixo,
  tbodyId,
  tamanhoPadrao = 10,
  renderLinha,
  colspanVazio,
  textoVazio,
  aposRenderizar
}) {
  const estado = { itens: [], pagina: 1, tamanho: tamanhoPadrao }

  function renderizar () {
    const tbody = document.getElementById(tbodyId)
    if (!tbody) return
    tbody.innerHTML = ''

    const infoEl = document.getElementById(`paginacao-info-${idSufixo}`)
    const labelEl = document.getElementById(`pagina-atual-label-${idSufixo}`)
    const btnAnterior = document
      .getElementById(`btn-pagina-anterior-${idSufixo}`)
      ?.closest('.page-item')
    const btnProxima = document
      .getElementById(`btn-pagina-proxima-${idSufixo}`)
      ?.closest('.page-item')

    const total = estado.itens.length

    if (total === 0) {
      tbody.innerHTML = `<tr><td colspan="${colspanVazio}" class="text-center py-4 text-muted">${textoVazio}</td></tr>`
      if (infoEl) infoEl.textContent = 'Mostrando 0 de 0'
      if (labelEl) labelEl.textContent = '1'
      btnAnterior?.classList.add('disabled')
      btnProxima?.classList.add('disabled')
      return
    }

    const totalPaginas = Math.max(1, Math.ceil(total / estado.tamanho))
    estado.pagina = Math.min(estado.pagina, totalPaginas)
    const inicio = (estado.pagina - 1) * estado.tamanho
    const fim = Math.min(inicio + estado.tamanho, total)

    estado.itens.slice(inicio, fim).forEach(item => renderLinha(item, tbody))
    aposRenderizar?.(tbody)

    if (infoEl)
      infoEl.textContent = `Mostrando ${inicio + 1}–${fim} de ${total}`
    if (labelEl) labelEl.textContent = `${estado.pagina} de ${totalPaginas}`
    btnAnterior?.classList.toggle('disabled', estado.pagina === 1)
    btnProxima?.classList.toggle('disabled', estado.pagina === totalPaginas)
  }

  document
    .getElementById(`btn-pagina-anterior-${idSufixo}`)
    ?.addEventListener('click', () => {
      if (estado.pagina > 1) {
        estado.pagina--
        renderizar()
      }
    })

  document
    .getElementById(`btn-pagina-proxima-${idSufixo}`)
    ?.addEventListener('click', () => {
      const totalPaginas = Math.max(
        1,
        Math.ceil(estado.itens.length / estado.tamanho)
      )
      if (estado.pagina < totalPaginas) {
        estado.pagina++
        renderizar()
      }
    })

  document
    .getElementById(`select-tamanho-pagina-${idSufixo}`)
    ?.addEventListener('change', e => {
      estado.tamanho = Number(e.target.value) || tamanhoPadrao
      estado.pagina = 1
      renderizar()
    })

  return {
    definirItens (itens) {
      estado.itens = itens
      estado.pagina = 1
      renderizar()
    },
    renderizarNovamente: renderizar
  }
}

window.criarPaginador = criarPaginador
