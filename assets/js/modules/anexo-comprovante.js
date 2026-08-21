/**
 * Leitura do anexo de comprovante de pagamento (Mensalidade.comprovanteAnexo)
 * — imagem ou PDF enviado na baixa manual de uma cobrança em Faturamento,
 * guardado como data URI base64 (mesmo padrão do avatar do usuário, ver
 * redimensionarImagemParaAvatar em assets/js/modules/auth.js).
 *
 * Usado só por assets/js/controllers/faturamento.js.
 */

const ANEXO_COMPROVANTE_TIPOS_ACEITOS = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
const ANEXO_COMPROVANTE_TAMANHO_MAXIMO_BYTES = 4 * 1024 * 1024 // 4MB — cabe na folga de main.ts (limite de 6mb no corpo, já com overhead do base64)
const ANEXO_COMPROVANTE_MAIOR_LADO_MAXIMO_PX = 1600 // downscale de fotos de celular antes de guardar

function lerComprovanteComoDataURI (arquivo) {
  return new Promise((resolve, reject) => {
    if (!ANEXO_COMPROVANTE_TIPOS_ACEITOS.includes(arquivo.type)) {
      reject(new Error('Envie uma imagem (PNG/JPEG/WEBP) ou um PDF.'))
      return
    }
    if (arquivo.size > ANEXO_COMPROVANTE_TAMANHO_MAXIMO_BYTES) {
      reject(new Error('Arquivo muito grande (máximo 4MB).'))
      return
    }

    const leitor = new FileReader()
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))

    // PDF não tem como ser redimensionado no cliente — só base64 direto.
    if (arquivo.type === 'application/pdf') {
      leitor.onload = () => resolve(leitor.result)
      leitor.readAsDataURL(arquivo)
      return
    }

    leitor.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'))
      img.onload = () => {
        const escala = Math.min(1, ANEXO_COMPROVANTE_MAIOR_LADO_MAXIMO_PX / Math.max(img.width, img.height))
        const largura = Math.round(img.width * escala)
        const altura = Math.round(img.height * escala)
        const canvas = document.createElement('canvas')
        canvas.width = largura
        canvas.height = altura
        canvas.getContext('2d').drawImage(img, 0, 0, largura, altura)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = leitor.result
    }
    leitor.readAsDataURL(arquivo)
  })
}

// Abre o anexo numa nova aba — funciona tanto pra imagem quanto pra PDF,
// já que o browser sabe renderizar um data URI de qualquer um dos dois.
//
// O elemento é montado via DOM (createElement + propriedade "src"), nunca
// por template string em innerHTML/document.write: o valor de "dataUri" vem
// do backend, mas nada garante que outra camada não vá afrouxar a validação
// no futuro — se isso acontecer, um "src" atribuído via propriedade não tem
// como quebrar pra fora do atributo e injetar HTML/script, diferente de
// interpolar a string direto numa tag.
function abrirAnexoComprovante (dataUri) {
  const nova = window.open()
  if (!nova) return

  const ehPdf = dataUri.startsWith('data:application/pdf')
  const elemento = nova.document.createElement(ehPdf ? 'iframe' : 'img')
  elemento.src = dataUri
  if (ehPdf) {
    Object.assign(elemento.style, { border: '0', width: '100%', height: '100vh' })
  } else {
    Object.assign(elemento.style, { maxWidth: '100%', display: 'block', margin: '0 auto' })
  }

  nova.document.body.appendChild(elemento)
}

window.lerComprovanteComoDataURI = lerComprovanteComoDataURI
window.abrirAnexoComprovante = abrirAnexoComprovante
