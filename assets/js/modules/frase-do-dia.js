/**
 * "Biscoito da Sorte" — frase filosófica/motivacional exibida uma vez a cada
 * login, lembrando quem usa o sistema de que a vida não é só trabalho.
 *
 * Fluxo: login.js marca uma "flag" em sessionStorage no momento do login
 * bem-sucedido; a primeira página carregada depois disso (o Dashboard) lê
 * essa flag, mostra a frase e a apaga — assim ela aparece só uma vez por
 * login, não a cada navegação entre páginas.
 */

const FRASES_MOTIVACIONAIS = [
  'Grandes jornadas começam com pequenos atos de coragem — hoje é um bom dia para o seu.',
  'Cuide do seu trabalho com dedicação, mas não esqueça de cuidar de quem te espera em casa.',
  'O sucesso de um dia não se mede só em tarefas concluídas, mas também em sorrisos trocados.',
  'Produtividade sem propósito é só pressa. Lembre-se do porquê você faz o que faz.',
  'Um copo d’água, uma pausa, um respiro: pequenos cuidados sustentam grandes conquistas.',
  'Você não é a sua lista de tarefas. É a soma de tudo que ama fazer fora dela também.',
  'A paciência de hoje é o profissional — e a pessoa — mais tranquila de amanhã.',
  'Ligue para alguém que você ama antes do fim do expediente. O trabalho espera; as pessoas, nem sempre.',
  'Erros são só rascunhos de acertos futuros. Siga em frente.',
  'O melhor investimento do seu dia pode ser cinco minutos de silêncio só para você.',
  'Feito é melhor que perfeito — principalmente quando o perfeito rouba tempo do seu descanso.',
  'Sua energia é limitada; escolha com carinho onde vai gastá-la hoje.',
  'Antes de resolver o próximo problema, respire fundo. Ele pode esperar dez segundos.',
  'A gentileza que você oferece hoje pode ser o motivo do sorriso de alguém amanhã.',
  'Metas movem o corpo, mas é o propósito que move a alma.',
  'Você já superou cem por cento dos seus piores dias até aqui. Este também vai passar.',
  'Trabalhe como se cada tarefa importasse, mas viva como se cada momento fosse único — porque é.',
  'Uma boa noite de sono vale mais que uma hora extra mal dormida.',
  'O relógio marca o tempo do trabalho; o coração marca o tempo que realmente importa.',
  'Celebre as pequenas vitórias — elas são os tijolos das grandes conquistas.'
]

const FRASE_SESSION_FLAG = 'parkgestao:mostrarFraseLogin'

/** Chamado no momento do login bem-sucedido (login.js). */
function marcarParaMostrarFraseNoProximoCarregamento () {
  try {
    sessionStorage.setItem(FRASE_SESSION_FLAG, '1')
  } catch (erro) {
    // sessionStorage indisponível: sem problema, só não mostra a frase desta vez.
  }
}

/** Chamado ao carregar o Dashboard — mostra a frase só se acabou de logar. */
function mostrarFraseMotivacionalSeAplicavel () {
  if (typeof Swal === 'undefined') return

  let deveMostrar = false
  try {
    deveMostrar = sessionStorage.getItem(FRASE_SESSION_FLAG) === '1'
    sessionStorage.removeItem(FRASE_SESSION_FLAG)
  } catch (erro) {
    return
  }
  if (!deveMostrar) return

  const frase =
    FRASES_MOTIVACIONAIS[Math.floor(Math.random() * FRASES_MOTIVACIONAIS.length)]

  const sessao =
    typeof AuthService !== 'undefined' ? AuthService.getSessao() : null
  const primeiroNome = sessao?.nome ? sessao.nome.trim().split(/\s+/)[0] : ''

  Swal.fire({
    title: primeiroNome ? `Bem-vindo(a), ${primeiroNome}! 🥠` : 'Bem-vindo(a)! 🥠',
    html: `
      <div class="text-center">
        <i class="fas fa-cookie-bite fs-1 text-warning mb-3" aria-hidden="true"></i>
        <p class="fs-5 fst-italic mb-0">"${frase}"</p>
      </div>
    `,
    confirmButtonText: 'Vamos lá! 💪',
    confirmButtonColor: '#0e3a2f'
  })
}

window.marcarParaMostrarFraseNoProximoCarregamento =
  marcarParaMostrarFraseNoProximoCarregamento
window.mostrarFraseMotivacionalSeAplicavel = mostrarFraseMotivacionalSeAplicavel
