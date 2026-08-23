/**
 * Exportação genérica de tabelas para CSV e Excel (SheetJS), reaproveitada
 * pelas páginas de Tickets, Mensalistas e Vagas & Tarifas — mesmo padrão de
 * exportação já usado no relatório da página de Métricas.
 */

function baixarArquivoExportado (conteudo, nomeArquivo, tipoMime) {
  const blob = new Blob([conteudo], { type: tipoMime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function avisarExportacaoVazia () {
  if (typeof Swal === 'undefined') return
  Swal.fire({
    icon: 'info',
    title: 'Nada para exportar',
    text: 'Não há registros para exportar com os filtros/busca atuais.'
  })
}

// Neutraliza CSV/Formula Injection: se o valor (incluindo campos de texto
// livre digitados por operadores, ex.: motivoCancelamento) começa com um
// caractere que Excel/Sheets interpretam como início de fórmula, prefixa
// com uma aspas simples pra forçar o programa a tratar a célula como texto
// em vez de executar o conteúdo.
const REGEX_INICIO_FORMULA = /^[=+\-@\t\r]/
function neutralizarFormula (valor) {
  const texto = String(valor ?? '')
  return REGEX_INICIO_FORMULA.test(texto) ? `'${texto}` : texto
}

/**
 * @param {string} nomeArquivo ex.: "tickets-parkgestao.csv"
 * @param {{chave: string, rotulo: string}[]} colunas
 * @param {Object[]} linhas Itens já "achatados" (valores prontos para exibição)
 */
function exportarParaCSV (nomeArquivo, colunas, linhas) {
  if (!linhas || linhas.length === 0) {
    avisarExportacaoVazia()
    return
  }

  const escapar = valor => {
    const texto = neutralizarFormula(valor)
    return /["\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
  }

  const cabecalho = colunas.map(c => escapar(c.rotulo)).join(';')
  const corpo = linhas
    .map(linha => colunas.map(c => escapar(linha[c.chave])).join(';'))
    .join('\n')

  // BOM UTF-8 para o Excel reconhecer a acentuação; separador ";" (padrão do
  // Excel configurado em pt-BR, que usa "," como decimal).
  const BOM_UTF8 = '﻿'
  const conteudo = BOM_UTF8 + cabecalho + '\n' + corpo

  baixarArquivoExportado(conteudo, nomeArquivo, 'text/csv;charset=utf-8;')
}

/**
 * @param {string} nomeArquivo ex.: "tickets-parkgestao.xlsx"
 * @param {string} nomeAba
 * @param {{chave: string, rotulo: string}[]} colunas
 * @param {Object[]} linhas
 */
function exportarParaExcel (nomeArquivo, nomeAba, colunas, linhas) {
  if (typeof XLSX === 'undefined') {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Não foi possível gerar o Excel',
        text: 'A biblioteca de exportação não carregou. Verifique sua conexão e tente novamente.'
      })
    }
    return
  }

  if (!linhas || linhas.length === 0) {
    avisarExportacaoVazia()
    return
  }

  const dadosPlanilha = linhas.map(linha => {
    const objeto = {}
    colunas.forEach(c => {
      objeto[c.rotulo] = neutralizarFormula(linha[c.chave])
    })
    return objeto
  })

  const planilha = XLSX.utils.json_to_sheet(dadosPlanilha)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, planilha, nomeAba.slice(0, 31))
  XLSX.writeFile(workbook, nomeArquivo)
}

window.exportarParaCSV = exportarParaCSV
window.exportarParaExcel = exportarParaExcel
