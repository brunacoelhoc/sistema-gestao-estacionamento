/**
 * Módulo de Integração com API (backend Express + PostgreSQL) & Regras de Negócio
 * DevSecOps: Tratamento de erros, sanitização contra XSS e isolamento de regras.
 */

const API_BASE_URL = 'http://localhost:3001'

class ApiService {
  // --- MÉTODOS AUXILIARES DE SEGURANÇA & SANITIZAÇÃO ---
  static sanitizeText (str) {
    if (!str && str !== 0) return ''
    const temp = document.createElement('div')
    temp.textContent = String(str)
    return temp.innerHTML
  }

  // Checagem de Saúde do Servidor (Evita travamentos "Verificando servidor...")
  static async checkHealth () {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // Timeout de 3s

      const response = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      return response.ok
    } catch (error) {
      console.warn('[API Health Check Failed]:', error)
      return false
    }
  }

  // Constantes de regra de cobrança (tolerância de cortesia, duração do
  // ciclo de mensalista) usadas só pra prévia de valor mostrada antes de
  // confirmar o fechamento de um ticket — ver AppController.config no
  // backend, fonte única dessas regras. Endpoint público (não exige
  // sessão), mesmo padrão de checkHealth.
  static async getConfig () {
    const response = await fetch(`${API_BASE_URL}/config`)
    if (!response.ok) throw new Error('Não foi possível carregar as configurações do servidor.')
    return await response.json()
  }

  // Token da sessão atual (ver AuthService.salvarSessao) — anexado em toda
  // requisição autenticada via header Authorization.
  static getToken () {
    return (typeof AuthService !== 'undefined' && AuthService.getSessao()?.token) || null
  }

  static async request (endpoint, options = {}) {
    try {
      const token = this.getToken()
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }

      const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        ...options,
        headers
      })

      if (!response.ok) {
        let mensagem = `Erro HTTP: ${response.status} - ${response.statusText}`
        let codigo = null
        try {
          const corpo = await response.json()
          if (corpo?.erro) mensagem = corpo.erro
          codigo = corpo?.codigo || null
        } catch (erroDeParse) {
          // Resposta sem corpo JSON (ex.: erro de rede/proxy) — mantém a
          // mensagem genérica montada acima.
        }

        // 401 com token presente = sessão expirada/inválida, não falha de
        // rede. Sem isto, cada chamada protegida falhava em silêncio e a
        // tela só mostrava "verifique sua conexão", escondendo a causa real.
        if (response.status === 401 && token && typeof AuthService !== 'undefined') {
          AuthService.tratarSessaoExpirada()
        }

        // 403 com este código = conta do Google sem CPF tentando acessar uma
        // rota de negócio (ver requireProfileComplete no backend). O guard
        // inline de cada página já cobre a navegação direta; isto cobre o
        // caso de uma aba já aberta antes do cadastro ser completado.
        if (response.status === 403 && codigo === 'PERFIL_INCOMPLETO') {
          const caminho = window.location.pathname.includes('/views/')
            ? 'completar-cadastro.html'
            : 'views/completar-cadastro.html'
          if (!window.location.pathname.endsWith('completar-cadastro.html')) {
            window.location.href = caminho
          }
        }

        throw new Error(mensagem)
      }

      // Tratamento para requisições sem corpo na resposta (ex: DELETE 204)
      if (response.status === 204) {
        return true
      }

      // Um handler do Nest que devolve `null` (ex.: "ainda não tem perfil de
      // RH cadastrado") manda um corpo vazio (0 bytes), não a string "null"
      // — response.json() direto quebra nisso com "Unexpected end of JSON
      // input". Lê como texto primeiro e só faz parse se não estiver vazio.
      const texto = await response.text()
      return texto ? JSON.parse(texto) : null
    } catch (error) {
      console.error(`[API Error] Falha em /${endpoint}:`, error)
      throw error
    }
  }

  // --- REQUISICÕES MENSALISTAS ---
  static async getMensalistas () {
    return await this.request('mensalistas')
  }

  static async getMensalistaPorId (id) {
    if (!id) return null
    return await this.request(`mensalistas/${encodeURIComponent(id)}`)
  }

  // Checagem de duplicidade feita no servidor — evita ter que trazer o CPF
  // de todo mundo pro navegador só pra comparar localmente.
  static async verificarCpfMensalistaDuplicado (cpf, excluirId) {
    if (!cpf) return false
    const params = new URLSearchParams({ cpf })
    if (excluirId) params.set('excluirId', excluirId)
    const resultado = await this.request(`mensalistas/verificar-cpf?${params.toString()}`)
    return Boolean(resultado?.duplicado)
  }

  static async getMensalistaByPlaca (placa) {
    if (!placa) return null
    const mensalistas = await this.getMensalistas()
    const placaSanitizada = this.sanitizeText(placa).toUpperCase().trim()
    return (
      mensalistas.find(
        m => m.placa && m.placa.toUpperCase().trim() === placaSanitizada
      ) || null
    )
  }

  static async createMensalista (data) {
    const payload = {
      nome: this.sanitizeText(data.nome),
      cpf: this.sanitizeText(data.cpf),
      placa: this.sanitizeText(data.placa).toUpperCase().trim(),
      ativo: data.ativo !== undefined ? Boolean(data.ativo) : true,
      telefone: this.sanitizeText(data.telefone || ''),
      valorMensalidade: Number(data.valorMensalidade || data.valor) || 0,
      categoriaPlano: this.sanitizeText(data.categoriaPlano || 'Mensal Integral'),
      ...(data.email ? { email: this.sanitizeText(data.email) } : {})
    }

    return await this.request('mensalistas', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

  static async updateMensalista (id, data) {
    const payload = {}
    if (data.nome !== undefined) payload.nome = this.sanitizeText(data.nome)
    if (data.cpf !== undefined) payload.cpf = this.sanitizeText(data.cpf)
    if (data.placa !== undefined) { payload.placa = this.sanitizeText(data.placa).toUpperCase().trim() }
    if (data.telefone !== undefined) { payload.telefone = this.sanitizeText(data.telefone) }
    if (data.ativo !== undefined) payload.ativo = Boolean(data.ativo)
    if (data.valorMensalidade !== undefined || data.valor !== undefined) {
      payload.valorMensalidade = Number(data.valorMensalidade || data.valor) || 0
    }
    if (data.categoriaPlano !== undefined) payload.categoriaPlano = this.sanitizeText(data.categoriaPlano)
    if (data.email !== undefined) payload.email = data.email ? this.sanitizeText(data.email) : null

    return await this.request(`mensalistas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  }

  static async deleteMensalista (id) {
    return await this.request(`mensalistas/${id}`, {
      method: 'DELETE'
    })
  }

  // --- REQUISIÇÕES MENSALIDADES (ciclo de 30 dias de cobrança do mensalista) ---
  // O ticket em si não gera cobrança pra mensalista ativo — quem cobra é o
  // ciclo (Mensalidade), aberto e já pago na primeira entrada sem ciclo
  // vigente (ver TicketsService.fechar / MensalidadeCicloService no backend).
  static async getMensalidades (mensalistaId) {
    const query = mensalistaId ? `?mensalistaId=${encodeURIComponent(mensalistaId)}` : ''
    return await this.request(`mensalidades${query}`)
  }

  // KPIs agregados de faturamento (MRR, recebido no mês, ticket médio, sem
  // ciclo ativo) já calculados no servidor — ver MensalidadesService.calcularKpis.
  static async getMensalidadesKpis () {
    return await this.request('mensalidades/kpis')
  }

  // Aceita tanto uma string de status (compatibilidade com chamadas antigas)
  // quanto um objeto { status, formaPagamento, motivoCancelamento,
  // comprovanteAnexo, comprovanteNomeArquivo }.
  static async updateMensalidade (id, dados) {
    const payload = typeof dados === 'string' ? { status: dados } : dados
    return await this.request(`mensalidades/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  }

  static async enviarLembreteMensalidade (id) {
    return await this.request(`mensalidades/${id}/lembrete`, {
      method: 'POST'
    })
  }

  // --- REQUISIÇÃO MÉTRICAS (admin-only) ---
  // KPIs/gráficos já vêm calculados do servidor — a tela nunca baixa a
  // lista crua de tickets/mensalidades/mensalistas/vagas (ver
  // src/metricas/metricas.service.ts).
  static async getMetricas (periodo) {
    const query = periodo ? `?periodo=${encodeURIComponent(periodo)}` : ''
    return await this.request(`metricas${query}`)
  }

  // --- REQUISICÕES VAGAS ---
  static async getVagas () {
    return await this.request('vagas')
  }

  static async createVaga (data) {
    const payload = {
      codigo: this.sanitizeText(data.codigo).toUpperCase(),
      tipo: this.sanitizeText(data.tipo || 'comum').toLowerCase(),
      status: this.sanitizeText(data.status || 'livre').toLowerCase(),
      acessivel: Boolean(data.acessivel)
    }

    return await this.request('vagas', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

  static async updateVaga (id, data) {
    const payload = {}
    if (data.codigo !== undefined) { payload.codigo = this.sanitizeText(data.codigo).toUpperCase() }
    if (data.tipo !== undefined) { payload.tipo = this.sanitizeText(data.tipo).toLowerCase() }
    if (data.status !== undefined) { payload.status = String(data.status).toLowerCase() }
    if (data.acessivel !== undefined) { payload.acessivel = Boolean(data.acessivel) }

    return await this.request(`vagas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  }

  static async updateVagaStatus (id, status) {
    const statusNormalizado = String(status).toLowerCase()
    return await this.request(`vagas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: statusNormalizado })
    })
  }

  static async deleteVaga (id) {
    return await this.request(`vagas/${id}`, {
      method: 'DELETE'
    })
  }

  // --- REQUISICÕES TARIFAS ---
  static async getTarifas () {
    return await this.request('tarifas')
  }

  static async createTarifa (data) {
    const payload = {
      categoria: this.sanitizeText(data.categoria || 'Geral'),
      valorHora: Number(data.valorHora || data.valor) || 0
    }

    return await this.request('tarifas', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

  static async updateTarifa (id, data) {
    const payload = {}
    if (data.categoria !== undefined) { payload.categoria = this.sanitizeText(data.categoria) }
    if (data.valorHora !== undefined || data.valor !== undefined) {
      payload.valorHora = Number(data.valorHora || data.valor) || 0
    }

    return await this.request(`tarifas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  }

  static async deleteTarifa (id) {
    return await this.request(`tarifas/${id}`, {
      method: 'DELETE'
    })
  }

  // --- REQUISIÇÕES CAIXA DIÁRIO ---
  // Um registro por dia: aberto com o valor em espécie contado na hora (ver
  // CaixaService.abrir), fechado comparando o valor contado contra o
  // esperado (abertura + tickets pagos em dinheiro no dia — ver
  // CaixaService.fechar). Backend também recusa registrar ticket sem o
  // caixa do dia aberto (ver TicketsService.abrir), então esta tela sempre
  // confere o status antes de deixar abrir o modal de novo ticket.
  static async getCaixaHoje () {
    return await this.request('caixa/hoje')
  }

  static async abrirCaixa (valorAbertura) {
    return await this.request('caixa/abrir', {
      method: 'POST',
      body: JSON.stringify({ valorAbertura: Number(valorAbertura) })
    })
  }

  static async fecharCaixa (id, { valorFechamento, observacoes = '' } = {}) {
    return await this.request(`caixa/${id}/fechar`, {
      method: 'POST',
      body: JSON.stringify({ valorFechamento: Number(valorFechamento), observacoes: this.sanitizeText(observacoes) })
    })
  }

  // --- REQUISICÕES TICKETS & REGRAS DE NEGÓCIO ---
  /**
   * Sem `params`, devolve a lista completa (histórico inteiro — usado só
   * pela tela de Vagas hoje). Com `{ page, pageSize, status, termo }`, pede
   * uma página filtrada ao backend — usado pela tabela da tela de Tickets.
   * `{ status, termo }` sem `page` também é aceito: devolve a lista
   * completa já filtrada — o Dashboard usa `{ status: 'aberto' }` pra
   * tabela de tickets ativos (os KPIs agregados vêm de getDashboardKpis),
   * e a exportação (CSV/Excel) usa pra pegar todo o resultado, não só uma
   * página (ver TicketsController.listar em src/tickets/tickets.controller.ts).
   */
  static async getTickets (params) {
    if (!params) return await this.request('tickets')

    const query = new URLSearchParams()
    if (params.page) query.set('page', params.page)
    if (params.pageSize) query.set('pageSize', params.pageSize)
    if (params.status) query.set('status', params.status)
    if (params.termo) query.set('termo', params.termo)

    const qs = query.toString()
    return await this.request(`tickets${qs ? `?${qs}` : ''}`)
  }

  // KPIs do painel principal (vagas por status, faturamento, ticket médio,
  // tempo médio) já calculados no servidor — ver DashboardService.calcularKpis.
  static async getDashboardKpis (tipo) {
    const query = tipo && tipo !== 'todos' ? `?tipo=${encodeURIComponent(tipo)}` : ''
    return await this.request(`dashboard/kpis${query}`)
  }

  // Ranking de vagas por quantidade de tickets já registrados — ver
  // DashboardService.calcularRankingVagas.
  static async getRankingVagas () {
    return await this.request('dashboard/ranking-vagas')
  }

  /**
   * Criação/Abertura de Ticket.
   * A regra de negócio (checar se a vaga está livre, resolver mensalista
   * pela placa, marcar a vaga como ocupada) roda no backend numa única
   * transação — ver TicketsService.abrir em src/tickets/tickets.service.ts.
   * @param {Object} params - { placa, vagaId, tarifaId, mensalistaId }
   */
  static async criarTicket ({ placa, vagaId, tarifaId, mensalistaId = null }) {
    return await this.request('tickets', {
      method: 'POST',
      body: JSON.stringify({
        placa: this.sanitizeText(placa),
        vagaId: String(vagaId),
        tarifaId: tarifaId ? String(tarifaId) : null,
        mensalistaId: mensalistaId ? String(mensalistaId) : null
      })
    })
  }

  /**
   * Fechamento de Ticket. O cálculo do valor cobrado (tolerância, tarifa
   * por hora, mensalista) roda inteiramente no backend — o front nunca
   * calcula nem envia o valor, só recebe de volta o ticket já fechado.
   */
  static async fecharTicket (ticketId, { formaPagamento = null } = {}) {
    return await this.request(`tickets/${ticketId}/fechar`, {
      method: 'POST',
      body: JSON.stringify({ formaPagamento })
    })
  }

  static async deleteTicket (id) {
    return await this.request(`tickets/${id}`, {
      method: 'DELETE'
    })
  }

  // O PDF do comprovante é gerado no backend a partir do ticket já
  // persistido — esta chamada só dispara o envio, não carrega nem manda
  // nenhum anexo (ver TicketsService.enviarComprovanteEmail).
  static async enviarComprovanteTicketEmail (ticketId) {
    return await this.request(`tickets/${ticketId}/comprovante-email`, {
      method: 'POST'
    })
  }

  // --- AUTENTICAÇÃO (backend Express: hash de senha com bcrypt + JWT) ---
  static async login (cpf, senha) {
    return await this.request('auth/login', {
      method: 'POST',
      body: JSON.stringify({ cpf: this.sanitizeText(cpf), senha })
    })
  }

  static async registrar ({ nome, cpf, email, senha, telefone, aceitouTermos }) {
    return await this.request('auth/registrar', {
      method: 'POST',
      body: JSON.stringify({
        nome: this.sanitizeText(nome),
        cpf: this.sanitizeText(cpf),
        email: this.sanitizeText(email).toLowerCase().trim(),
        senha,
        telefone: this.sanitizeText(telefone),
        aceitouTermos: Boolean(aceitouTermos)
      })
    })
  }

  // Manda o ID token bruto — a verificação de assinatura acontece no
  // backend (POST /auth/google), nunca no navegador.
  static async loginGoogle (credential) {
    return await this.request('auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
    })
  }

  static async solicitarResetSenha (email) {
    return await this.request('auth/reset/solicitar', {
      method: 'POST',
      body: JSON.stringify({ email: this.sanitizeText(email).toLowerCase().trim() })
    })
  }

  static async confirmarResetSenha (email, codigo, novaSenha) {
    return await this.request('auth/reset/confirmar', {
      method: 'POST',
      body: JSON.stringify({
        email: this.sanitizeText(email).toLowerCase().trim(),
        codigo,
        novaSenha
      })
    })
  }

  // --- REQUISIÇÕES USUÁRIOS (Perfil / Admin) ---
  //
  // GET /usuarios e POST /usuarios exigem sessão de admin (o backend barra
  // com 401/403) — só a tela de Funcionários, restrita a admin, deve chamar
  // getUsuarios/getUsuarioPorCpf/getUsuarioPorEmail/createUsuario. Fluxos
  // públicos (login, cadastro, Google, reset de senha) usam os métodos de
  // autenticação acima, que não dependem de listar usuários.
  static async getUsuarios () {
    return await this.request('usuarios')
  }

  static async getUsuarioPorEmail (email) {
    if (!email) return null
    const usuarios = await this.getUsuarios()
    const emailNormalizado = this.sanitizeText(email).toLowerCase().trim()
    return (
      usuarios.find(
        u => (u.email || '').toLowerCase().trim() === emailNormalizado
      ) || null
    )
  }

  static async getUsuarioPorId (id) {
    if (!id) return null
    return await this.request(`usuarios/${encodeURIComponent(id)}`)
  }

  // Checagem de duplicidade feita no servidor — a listagem só traz o CPF
  // mascarado, então não dá mais pra comparar localmente contra a lista.
  static async getUsuarioPorCpf (cpf, excluirId) {
    if (!cpf) return false
    const params = new URLSearchParams({ cpf })
    if (excluirId) params.set('excluirId', excluirId)
    const resultado = await this.request(`usuarios/verificar-cpf?${params.toString()}`)
    return Boolean(resultado?.duplicado)
  }

  static async createUsuario (data) {
    // CriarUsuarioDto (backend) só aceita estes campos — com
    // forbidNonWhitelisted:true, mandar qualquer propriedade a mais (ex.:
    // avatar, ativo, aceitouTermos, provedor, criadoEm) derruba a requisição
    // inteira com 400, mesmo essas propriedades sendo hardcoded no server.
    const payload = {
      nome: this.sanitizeText(data.nome),
      cpf: this.sanitizeText(data.cpf || ''),
      email: this.sanitizeText(data.email).toLowerCase().trim(),
      senha: data.senha || '',
      telefone: this.sanitizeText(data.telefone || ''),
      endereco: this.sanitizeText(data.endereco || ''),
      dataNascimento: data.dataNascimento || '',
      role: ['admin', 'rh', 'gestor'].includes(data.role) ? data.role : 'funcionario'
    }

    return await this.request('usuarios', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

  static async updateUsuario (id, data) {
    const payload = {}
    if (data.nome !== undefined) payload.nome = this.sanitizeText(data.nome)
    if (data.cpf !== undefined) payload.cpf = this.sanitizeText(data.cpf)
    if (data.email !== undefined) { payload.email = this.sanitizeText(data.email).toLowerCase().trim() }
    if (data.senha !== undefined && data.senha !== '') payload.senha = data.senha
    if (data.senhaAtual !== undefined) payload.senhaAtual = data.senhaAtual
    if (data.telefone !== undefined) { payload.telefone = this.sanitizeText(data.telefone) }
    if (data.endereco !== undefined) { payload.endereco = this.sanitizeText(data.endereco) }
    if (data.dataNascimento !== undefined) { payload.dataNascimento = data.dataNascimento }
    if (data.avatar !== undefined) payload.avatar = data.avatar
    if (data.role !== undefined) { payload.role = ['admin', 'rh', 'gestor'].includes(data.role) ? data.role : 'funcionario' }
    if (data.ativo !== undefined) payload.ativo = Boolean(data.ativo)

    return await this.request(`usuarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  }

  // --- REQUISIÇÕES DE RH (perfil de RH do funcionário) ---

  static async getMeuPerfilRh () {
    return await this.request('rh-perfil/me')
  }

  static async getPerfilRh (usuarioId) {
    return await this.request(`rh-perfil/${usuarioId}`)
  }

  static async getCargosRh () {
    return await this.request('rh-perfil/cargos')
  }

  static async getOrganograma () {
    return await this.request('rh-perfil/organograma')
  }

  // --- REQUISIÇÃO DE DESEMPENHO (gestor/rh/admin) ---

  static async getDesempenho (referencia) {
    const params = referencia ? `?referencia=${encodeURIComponent(referencia)}` : ''
    return await this.request(`desempenho${params}`)
  }

  // --- REQUISIÇÕES DE PONTO ---

  static async registrarEntradaPonto () {
    return await this.request('ponto/entrada', { method: 'POST' })
  }

  static async registrarSaidaPonto () {
    return await this.request('ponto/saida', { method: 'POST' })
  }

  static async getMeuPontoDoMes (referencia) {
    return await this.request(`ponto?referencia=${encodeURIComponent(referencia)}`)
  }

  static async getResumoPonto (referencia, usuarioId) {
    const params = new URLSearchParams({ referencia })
    if (usuarioId) params.set('usuarioId', usuarioId)
    return await this.request(`ponto/resumo?${params.toString()}`)
  }

  static async solicitarTrabalhoExtra (data, motivo) {
    return await this.request('ponto/trabalho-extra', {
      method: 'POST',
      body: JSON.stringify({ data, motivo: this.sanitizeText(motivo) })
    })
  }

  static async getSolicitacoesTrabalhoExtra (usuarioId) {
    const params = usuarioId ? `?usuarioId=${encodeURIComponent(usuarioId)}` : ''
    return await this.request(`ponto/trabalho-extra${params}`)
  }

  static async decidirTrabalhoExtra (id, status) {
    return await this.request(`ponto/trabalho-extra/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    })
  }

  static async criarJustificativaPonto (usuarioId, data, tipo, descricao) {
    return await this.request('ponto/justificativas', {
      method: 'POST',
      body: JSON.stringify({ usuarioId, data, tipo, descricao: this.sanitizeText(descricao || '') })
    })
  }

  static async getJustificativasPonto (usuarioId) {
    const params = usuarioId ? `?usuarioId=${encodeURIComponent(usuarioId)}` : ''
    return await this.request(`ponto/justificativas${params}`)
  }

  // --- REQUISIÇÕES DE ESPELHO DE PONTO MENSAL ---

  static async gerarEspelhoPonto (usuarioId, referencia) {
    return await this.request('espelho-ponto/gerar', {
      method: 'POST',
      body: JSON.stringify({ usuarioId, referencia })
    })
  }

  static async getEspelhosPonto (usuarioId) {
    const params = usuarioId ? `?usuarioId=${encodeURIComponent(usuarioId)}` : ''
    return await this.request(`espelho-ponto${params}`)
  }

  static async assinarEspelhoPonto (id) {
    return await this.request(`espelho-ponto/${id}/assinar`, { method: 'POST' })
  }

  // Não usa `request()`: a resposta é um PDF binário, não JSON.
  static async baixarPdfEspelhoPonto (id) {
    const response = await fetch(`${API_BASE_URL}/espelho-ponto/${id}/pdf`, {
      headers: { Authorization: `Bearer ${this.getToken()}` }
    })
    if (!response.ok) {
      throw new Error('Não foi possível baixar o PDF do espelho de ponto.')
    }
    return await response.blob()
  }

  // --- REQUISIÇÕES DE FOLHA DE PAGAMENTO / HOLERITE ---

  static async gerarHolerite (usuarioId, referencia) {
    return await this.request('folha-pagamento/gerar', {
      method: 'POST',
      body: JSON.stringify({ usuarioId, referencia })
    })
  }

  static async getHolerites (usuarioId) {
    const params = usuarioId ? `?usuarioId=${encodeURIComponent(usuarioId)}` : ''
    return await this.request(`folha-pagamento${params}`)
  }

  static async assinarHolerite (id) {
    return await this.request(`folha-pagamento/${id}/assinar`, { method: 'POST' })
  }

  static async pagarHolerite (id) {
    return await this.request(`folha-pagamento/${id}/pagar`, { method: 'POST' })
  }

  // Não usa `request()`: a resposta é um PDF binário, não JSON.
  static async baixarPdfHolerite (id) {
    const response = await fetch(`${API_BASE_URL}/folha-pagamento/${id}/pdf`, {
      headers: { Authorization: `Bearer ${this.getToken()}` }
    })
    if (!response.ok) {
      throw new Error('Não foi possível baixar o PDF do holerite.')
    }
    return await response.blob()
  }

  // --- REQUISIÇÕES DE NOTIFICAÇÕES (caixa de entrada) ---

  static async getMinhasNotificacoes () {
    return await this.request('notificacoes')
  }

  static async marcarNotificacaoComoLida (id) {
    return await this.request(`notificacoes/${id}/lida`, { method: 'PATCH' })
  }

  // --- REQUISIÇÕES DE FÉRIAS ---

  static async solicitarFerias (dataInicio, dataFim) {
    return await this.request('ferias', {
      method: 'POST',
      body: JSON.stringify({ dataInicio, dataFim })
    })
  }

  static async getFerias (usuarioId) {
    const params = usuarioId ? `?usuarioId=${encodeURIComponent(usuarioId)}` : ''
    return await this.request(`ferias${params}`)
  }

  static async decidirFerias (id, status) {
    return await this.request(`ferias/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    })
  }

  static async editarFerias (id, dataInicio, dataFim) {
    return await this.request(`ferias/${id}/datas`, {
      method: 'PATCH',
      body: JSON.stringify({ dataInicio, dataFim })
    })
  }

  // --- REQUISIÇÕES DE ASSINATURA ELETRÔNICA (cadastro único) ---

  static async getMinhaAssinatura () {
    return await this.request('assinatura-eletronica/me')
  }

  static async cadastrarAssinatura (imagemDataUri) {
    return await this.request('assinatura-eletronica/me', {
      method: 'POST',
      body: JSON.stringify({ imagemDataUri })
    })
  }

  static async definirPerfilRh (usuarioId, dados) {
    const payload = {
      cargo: this.sanitizeText(dados.cargo),
      salarioBase: Number(dados.salarioBase),
      tipoContrato: dados.tipoContrato === 'pj' ? 'pj' : 'clt',
      dataAdmissao: dados.dataAdmissao,
      dataDemissao: dados.dataDemissao || null,
      diasEscala: dados.diasEscala,
      horasPorDia: Number(dados.horasPorDia),
      horaInicioEscala: dados.horaInicioEscala,
      bancoNome: this.sanitizeText(dados.bancoNome),
      agencia: this.sanitizeText(dados.agencia),
      contaBancaria: this.sanitizeText(dados.contaBancaria),
      direitos: this.sanitizeText(dados.direitos || ''),
      deveres: this.sanitizeText(dados.deveres || ''),
      tarefas: this.sanitizeText(dados.tarefas || ''),
      tipoValeTransporte: ['vale_transporte', 'vale_combustivel'].includes(dados.tipoValeTransporte) ? dados.tipoValeTransporte : 'nenhum',
      bonusDesempenho: dados.bonusDesempenho === '' || dados.bonusDesempenho == null ? null : Number(dados.bonusDesempenho),
      observacoesBeneficios: this.sanitizeText(dados.observacoesBeneficios || ''),
      vagaOrigem: this.sanitizeText(dados.vagaOrigem || ''),
      gestorId: dados.gestorId || null,
      etapaCarreiraAtualId: dados.etapaCarreiraAtualId || null
    }
    return await this.request(`rh-perfil/${usuarioId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  }

  // --- REQUISIÇÕES DE CONTRATO DE TRABALHO (versionado, assinado) ---

  static async gerarContratoTrabalho (usuarioId) {
    return await this.request('contrato-trabalho/gerar', {
      method: 'POST',
      body: JSON.stringify({ usuarioId })
    })
  }

  static async getContratosTrabalho (usuarioId) {
    const params = usuarioId ? `?usuarioId=${encodeURIComponent(usuarioId)}` : ''
    return await this.request(`contrato-trabalho${params}`)
  }

  static async assinarContratoTrabalho (id) {
    return await this.request(`contrato-trabalho/${id}/assinar`, { method: 'POST' })
  }

  // Não usa `request()`: a resposta é um PDF binário, não JSON.
  static async baixarPdfContratoTrabalho (id) {
    const response = await fetch(`${API_BASE_URL}/contrato-trabalho/${id}/pdf`, {
      headers: { Authorization: `Bearer ${this.getToken()}` }
    })
    if (!response.ok) {
      throw new Error('Não foi possível baixar o PDF do contrato.')
    }
    return await response.blob()
  }

  // --- REQUISIÇÕES DE TRILHA DE CARREIRA (catálogo global) ---

  static async getEtapasCarreira () {
    return await this.request('etapas-carreira')
  }

  static async criarEtapaCarreira (dados) {
    return await this.request('etapas-carreira', {
      method: 'POST',
      body: JSON.stringify({
        ordem: Number(dados.ordem),
        titulo: this.sanitizeText(dados.titulo),
        faixaSalarial: this.sanitizeText(dados.faixaSalarial || ''),
        descricao: this.sanitizeText(dados.descricao)
      })
    })
  }

  static async atualizarEtapaCarreira (id, dados) {
    return await this.request(`etapas-carreira/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ordem: Number(dados.ordem),
        titulo: this.sanitizeText(dados.titulo),
        faixaSalarial: this.sanitizeText(dados.faixaSalarial || ''),
        descricao: this.sanitizeText(dados.descricao)
      })
    })
  }

  static async removerEtapaCarreira (id) {
    return await this.request(`etapas-carreira/${id}`, { method: 'DELETE' })
  }

  // --- REQUISIÇÕES DE PDI (Plano de Desenvolvimento Individual) ---

  static async getMeuPdi () {
    return await this.request('pdi/me')
  }

  static async getPdi (usuarioId) {
    return await this.request(`pdi/${usuarioId}`)
  }

  static async criarItemPdi (usuarioId, dados) {
    return await this.request(`pdi/${usuarioId}`, {
      method: 'POST',
      body: JSON.stringify({
        titulo: this.sanitizeText(dados.titulo),
        descricao: this.sanitizeText(dados.descricao || '')
      })
    })
  }

  static async atualizarItemPdi (itemId, dados) {
    return await this.request(`pdi/item/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        titulo: this.sanitizeText(dados.titulo),
        descricao: this.sanitizeText(dados.descricao || '')
      })
    })
  }

  static async concluirItemPdi (itemId) {
    return await this.request(`pdi/item/${itemId}/concluir`, { method: 'PATCH' })
  }

  static async reabrirItemPdi (itemId) {
    return await this.request(`pdi/item/${itemId}/reabrir`, { method: 'PATCH' })
  }

  static async moverItemPdi (itemId, direcao) {
    return await this.request(`pdi/item/${itemId}/mover`, {
      method: 'PATCH',
      body: JSON.stringify({ direcao })
    })
  }

  static async removerItemPdi (itemId) {
    return await this.request(`pdi/item/${itemId}`, { method: 'DELETE' })
  }

  // --- REQUISIÇÕES DE AUDITORIA (admin/rh) ---

  static async getAuditoria ({ entidade, entidadeId, usuarioId } = {}) {
    const params = new URLSearchParams()
    if (entidade) params.set('entidade', entidade)
    if (entidadeId) params.set('entidadeId', entidadeId)
    if (usuarioId) params.set('usuarioId', usuarioId)
    const query = params.toString()
    return await this.request(`auditoria${query ? `?${query}` : ''}`)
  }
}

window.ApiService = ApiService
