/**
 * Sombra nas bordas de tabelas com rolagem horizontal (.table-responsive).
 * Em telas estreitas essas tabelas viram um scroller horizontal, mas sem
 * nenhuma pista visual parecem só "cortadas" — como se faltasse coluna, em
 * vez de dar a entender que dá pra arrastar pro lado pra ver o resto.
 *
 * As tabelas são populadas via fetch depois do carregamento da página, então
 * um MutationObserver reavalia a rolagem sempre que o conteúdo mudar.
 */

function avaliarScrollHorizontal (container) {
  const rolavel = container.scrollWidth > container.clientWidth + 1
  container.classList.toggle('tem-scroll-horizontal', rolavel)
  if (!rolavel) return

  const atualizarBordas = () => {
    const noInicio = container.scrollLeft <= 1
    const noFim =
      container.scrollLeft + container.clientWidth >= container.scrollWidth - 1
    container.classList.toggle('scroll-no-inicio', noInicio)
    container.classList.toggle('scroll-no-fim', noFim)
  }

  atualizarBordas()
  if (!container.dataset.scrollHintLigado) {
    container.dataset.scrollHintLigado = 'true'
    container.addEventListener('scroll', atualizarBordas, { passive: true })
  }
}

function inicializarScrollHintTabelas () {
  const containers = document.querySelectorAll('.table-responsive')
  if (containers.length === 0) return

  const avaliarTodos = () => containers.forEach(avaliarScrollHorizontal)
  avaliarTodos()

  containers.forEach(container => {
    const observer = new MutationObserver(() => avaliarScrollHorizontal(container))
    observer.observe(container, { childList: true, subtree: true })
  })

  window.addEventListener('resize', avaliarTodos)
}

document.addEventListener('DOMContentLoaded', inicializarScrollHintTabelas)
