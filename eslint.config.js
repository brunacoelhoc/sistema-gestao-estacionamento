const neostandard = require('neostandard')
const globals = require('globals')

module.exports = [
  ...neostandard({
    ts: true,
    filesTs: ['src/**/*.ts'],
    ignores: [
      ...neostandard.resolveIgnoresFromGitignore(),
      'assets/css/**',
      'assets/js/vendor/**'
    ]
  }),
  {
    files: ['prisma/**/*.js', 'scripts/**/*.js', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    // Front-end estático: scripts carregados via <script defer src="...">,
    // sem bundler nem import/export — sourceType 'script', não 'module', e
    // cada arquivo compartilha o escopo global do window com os demais (daí
    // os globais "do projeto" abaixo: funções/classes definidas num arquivo
    // e usadas em outro, sem nenhum import explícito).
    files: ['assets/js/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Bibliotecas de terceiros carregadas via CDN (ver <script> em
        // index.html/views/*.html)
        bootstrap: 'readonly',
        Swal: 'readonly',
        gsap: 'readonly',
        google: 'readonly',
        XLSX: 'readonly',
        Chart: 'readonly',
        // Definidos num arquivo (ex.: assets/js/models/api.js) e usados em
        // outro — arquitetura de scripts globais, sem bundler.
        API_BASE_URL: 'readonly',
        ApiService: 'readonly',
        AuthService: 'readonly',
        LGPDModule: 'readonly',
        MENSAGEM_SENHA_FRACA: 'readonly',
        SENHA_VALIDADE_DIAS: 'readonly',
        abrirAnexoComprovante: 'readonly',
        abrirModalTrocaSenhaObrigatoria: 'readonly',
        animarContadorGsap: 'readonly',
        animarAnelProgresso: 'readonly',
        animarEntradaEmCascata: 'readonly',
        avisarExportacaoVazia: 'readonly',
        avaliarForcaSenha: 'readonly',
        lerComprovanteComoDataURI: 'readonly',
        criarPaginador: 'readonly',
        exportarParaCSV: 'readonly',
        exportarParaExcel: 'readonly',
        gerarComprovanteTicketPDF: 'readonly',
        gerarSenhaTemporaria: 'readonly',
        inicializarMenuUsuario: 'readonly',
        ligarIndicadorForcaSenha: 'readonly',
        ligarMascaraCpf: 'readonly',
        ligarMascaraPlaca: 'readonly',
        ligarMascaraTelefone: 'readonly',
        marcarParaMostrarFraseNoProximoCarregamento: 'readonly',
        mostrarFraseMotivacionalSeAplicavel: 'readonly',
        preverCicloMensalista: 'readonly',
        formatarDataCicloMensalista: 'readonly',
        toastInfo: 'readonly',
        toastSucesso: 'readonly',
        validarEstruturaCpf: 'readonly',
        validarPlaca: 'readonly'
      }
    },
    rules: {
      // Padrão comum de plugins do Bootstrap (new bootstrap.Tooltip(el) etc.)
      // instanciados só pelo efeito colateral, sem guardar referência.
      'no-new': 'off',
      // jsPDF é o nome oficial da lib (CDN), apesar do "j" minúsculo.
      'new-cap': ['error', { newIsCapExceptions: ['jsPDF'] }]
    }
  }
]
