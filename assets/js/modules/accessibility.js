/**
 * Módulo de Acessibilidade — Alto Contraste, Dislexia, Daltonismo, Tamanho de
 * Fonte e Redução de Movimento.
 *
 * IMPORTANTE: este é um site MPA (multipágina) — cada navegação recarrega o
 * documento inteiro. Por isso, toda preferência aqui é salva no
 * localStorage e reaplicada imediatamente ao carregar QUALQUER página
 * (antes mesmo do DOMContentLoaded, já que o script usa `defer`), para
 * evitar que o usuário perca a preferência ao clicar em um link do menu.
 *
 * Este arquivo é carregado como <script defer>, então o DOM já está
 * disponível quando ele executa — não é preciso esperar DOMContentLoaded.
 */

const AC_STORAGE_KEYS = {
  fontScale: 'parkgestao:fontScale',
  highContrast: 'parkgestao:highContrast',
  dyslexicFont: 'parkgestao:dyslexicFont',
  reduceMotion: 'parkgestao:reduceMotion',
  daltonismo: 'parkgestao:daltonismo'
}

const AC_FONT_SCALE_MIN = 0.85
const AC_FONT_SCALE_MAX = 1.4
const AC_FONT_SCALE_STEP = 0.1
const AC_FONT_SCALE_DEFAULT = 1

// ---------------------------------------------------------------------------
// Acesso seguro ao localStorage (pode falhar em navegação anônima/privada em
// navegadores antigos, ou se o usuário desabilitou armazenamento local)
// ---------------------------------------------------------------------------
function acLerStorage (chave) {
  try {
    return localStorage.getItem(chave)
  } catch (erro) {
    console.warn(
      'Acessibilidade: não foi possível ler preferências salvas.',
      erro
    )
    return null
  }
}

function acSalvarStorage (chave, valor) {
  try {
    localStorage.setItem(chave, valor)
  } catch (erro) {
    console.warn('Acessibilidade: não foi possível salvar preferências.', erro)
  }
}

function acLerBooleano (chave) {
  return acLerStorage(chave) === 'true'
}

function acLerNumero (chave, padrao) {
  const valor = parseFloat(acLerStorage(chave))
  return Number.isFinite(valor) ? valor : padrao
}

// ---------------------------------------------------------------------------
// Aplicação de cada preferência ao documento
// ---------------------------------------------------------------------------
function acAplicarClasseBody (classe, ativo) {
  document.body.classList.toggle(classe, ativo)
}

function acAplicarReduceMotion (ativo) {
  // O CSS cobre tanto html.reduce-motion quanto body.reduce-motion —
  // aplicamos nos dois por segurança.
  document.documentElement.classList.toggle('reduce-motion', ativo)
  document.body.classList.toggle('reduce-motion', ativo)
}

function acAplicarDaltonismo (tipo) {
  document.body.classList.remove('protanopia', 'deuteranopia', 'tritanopia')
  if (tipo && tipo !== 'normal') {
    document.body.classList.add(tipo)
  }
}

function acAplicarFontScale (escala) {
  const escalaLimitada = Math.min(
    AC_FONT_SCALE_MAX,
    Math.max(AC_FONT_SCALE_MIN, escala)
  )
  document.documentElement.style.fontSize = `${escalaLimitada * 100}%`
  return escalaLimitada
}

function acAtualizarAriaPressed (idBotao, ativo) {
  document.getElementById(idBotao)?.setAttribute('aria-pressed', String(ativo))
}

// ---------------------------------------------------------------------------
// 1. Aplica todas as preferências salvas IMEDIATAMENTE (antes de qualquer
//    interação do usuário nesta página), para não haver "flash" do estado
//    padrão antes de reaplicar o que já era esperado.
// ---------------------------------------------------------------------------
acAplicarFontScale(
  acLerNumero(AC_STORAGE_KEYS.fontScale, AC_FONT_SCALE_DEFAULT)
)
acAplicarClasseBody(
  'high-contrast',
  acLerBooleano(AC_STORAGE_KEYS.highContrast)
)
acAplicarClasseBody(
  'dyslexic-font',
  acLerBooleano(AC_STORAGE_KEYS.dyslexicFont)
)
acAplicarReduceMotion(acLerBooleano(AC_STORAGE_KEYS.reduceMotion))
acAplicarDaltonismo(acLerStorage(AC_STORAGE_KEYS.daltonismo) || 'normal')

// ---------------------------------------------------------------------------
// 2. Liga os controles da barra de acessibilidade (presente em todas as páginas)
// ---------------------------------------------------------------------------
document.getElementById('btn-font-increase')?.addEventListener('click', () => {
  ajustarFonte(AC_FONT_SCALE_STEP)
})

document.getElementById('btn-font-decrease')?.addEventListener('click', () => {
  ajustarFonte(-AC_FONT_SCALE_STEP)
})

document.getElementById('btn-font-reset')?.addEventListener('click', () => {
  acAplicarFontScale(AC_FONT_SCALE_DEFAULT)
  acSalvarStorage(AC_STORAGE_KEYS.fontScale, String(AC_FONT_SCALE_DEFAULT))
})

document.getElementById('btn-contrast')?.addEventListener('click', () => {
  alternarPreferenciaBooleana(
    'high-contrast',
    AC_STORAGE_KEYS.highContrast,
    'btn-contrast'
  )
})

document.getElementById('btn-dyslexic')?.addEventListener('click', () => {
  alternarPreferenciaBooleana(
    'dyslexic-font',
    AC_STORAGE_KEYS.dyslexicFont,
    'btn-dyslexic'
  )
})

document.getElementById('btn-motion')?.addEventListener('click', () => {
  const novoEstado = !document.body.classList.contains('reduce-motion')
  acAplicarReduceMotion(novoEstado)
  acSalvarStorage(AC_STORAGE_KEYS.reduceMotion, String(novoEstado))
  acAtualizarAriaPressed('btn-motion', novoEstado)

  // Se o Vanta.js já estiver rodando nesta página, para na hora — não
  // precisa esperar um recarregamento para a preferência fazer efeito.
  if (novoEstado && typeof window.pararVantaSeAtivo === 'function') {
    window.pararVantaSeAtivo()
  }
})

document.getElementById('select-daltonism')?.addEventListener('change', e => {
  acAplicarDaltonismo(e.target.value)
  acSalvarStorage(AC_STORAGE_KEYS.daltonismo, e.target.value)
})

function alternarPreferenciaBooleana (classe, chaveStorage, idBotao) {
  const novoEstado = !document.body.classList.contains(classe)
  acAplicarClasseBody(classe, novoEstado)
  acSalvarStorage(chaveStorage, String(novoEstado))
  acAtualizarAriaPressed(idBotao, novoEstado)
}

function ajustarFonte (delta) {
  const atual = acLerNumero(AC_STORAGE_KEYS.fontScale, AC_FONT_SCALE_DEFAULT)
  const nova = acAplicarFontScale(atual + delta)
  acSalvarStorage(AC_STORAGE_KEYS.fontScale, String(nova))
}

// ---------------------------------------------------------------------------
// 3. Sincroniza o estado visual dos controles (aria-pressed, valor do select)
//    com a preferência que acabou de ser aplicada nesta página.
// ---------------------------------------------------------------------------
acAtualizarAriaPressed(
  'btn-contrast',
  acLerBooleano(AC_STORAGE_KEYS.highContrast)
)
acAtualizarAriaPressed(
  'btn-dyslexic',
  acLerBooleano(AC_STORAGE_KEYS.dyslexicFont)
)
acAtualizarAriaPressed(
  'btn-motion',
  acLerBooleano(AC_STORAGE_KEYS.reduceMotion)
)

const acSelectDaltonismo = document.getElementById('select-daltonism')
if (acSelectDaltonismo) {
  acSelectDaltonismo.value =
    acLerStorage(AC_STORAGE_KEYS.daltonismo) || 'normal'
}
