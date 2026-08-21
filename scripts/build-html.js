/**
 * Aplica os parciais de views/partials/ (navbar, footer, barra de
 * acessibilidade) nos HTMLs estáticos, substituindo o conteúdo entre
 * marcadores `<!-- PARTIAL:nome --> ... <!-- /PARTIAL:nome -->`.
 *
 * Corre como parte de `npm run build` — o resultado (os próprios
 * index.html/views/*.html já com o conteúdo injetado) é commitado, igual já
 * acontece hoje com assets/css/style.css gerado do Sass.
 */
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..')
const DIR_PARTIALS = path.join(RAIZ, 'views', 'partials')

const ALVOS = [
  { arquivo: 'index.html', tipo: 'root', partials: ['accessibility-bar', 'navbar', 'footer'] },
  { arquivo: 'views/tickets.html', tipo: 'views', partials: ['accessibility-bar', 'navbar', 'footer'] },
  { arquivo: 'views/funcionarios.html', tipo: 'views', partials: ['accessibility-bar', 'navbar', 'footer'] },
  { arquivo: 'views/mensalistas.html', tipo: 'views', partials: ['accessibility-bar', 'navbar', 'footer'] },
  { arquivo: 'views/vagas-tarifas.html', tipo: 'views', partials: ['accessibility-bar', 'navbar', 'footer'] },
  { arquivo: 'views/metricas.html', tipo: 'views', partials: ['accessibility-bar', 'navbar', 'footer'] },
  { arquivo: 'views/sobre.html', tipo: 'views', partials: ['accessibility-bar', 'navbar', 'footer'] },
  { arquivo: 'views/login.html', tipo: 'views', partials: ['accessibility-bar'] },
  { arquivo: 'views/completar-cadastro.html', tipo: 'views', partials: ['accessibility-bar'] }
]

// index.html mora na raiz do projeto; views/*.html precisam subir um nível
// para chegar na raiz (TO_ROOT) e não precisam de prefixo para outra página
// dentro da própria pasta views/ (TO_VIEWS).
function resolverTokens (conteudo, tipo) {
  const toRoot = tipo === 'root' ? '' : '../'
  const toViews = tipo === 'root' ? 'views/' : ''
  return conteudo.replace(/\{\{TO_ROOT\}\}/g, toRoot).replace(/\{\{TO_VIEWS\}\}/g, toViews)
}

function lerPartial (nome) {
  return fs.readFileSync(path.join(DIR_PARTIALS, `${nome}.html`), 'utf8').replace(/\r?\n$/, '')
}

function aplicarPartials () {
  let arquivosAlterados = 0

  for (const alvo of ALVOS) {
    const caminhoCompleto = path.join(RAIZ, alvo.arquivo)
    let conteudo = fs.readFileSync(caminhoCompleto, 'utf8')
    const original = conteudo

    for (const nome of alvo.partials) {
      const marcador = new RegExp(
        `(<!-- PARTIAL:${nome} -->\\r?\\n)[\\s\\S]*?(\\r?\\n[ \\t]*<!-- /PARTIAL:${nome} -->)`
      )
      if (!marcador.test(conteudo)) {
        throw new Error(`Marcador PARTIAL:${nome} não encontrado em ${alvo.arquivo}`)
      }

      const partialResolvido = resolverTokens(lerPartial(nome), alvo.tipo)
      conteudo = conteudo.replace(marcador, `$1${partialResolvido}$2`)
    }

    if (conteudo !== original) {
      fs.writeFileSync(caminhoCompleto, conteudo)
      arquivosAlterados++
    }
  }

  console.log(`[build-html] ${ALVOS.length} arquivo(s) verificado(s), ${arquivosAlterados} atualizado(s).`)
}

aplicarPartials()
