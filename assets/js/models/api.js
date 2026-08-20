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
        try {
          const corpo = await response.json()
          if (corpo?.erro) mensagem = corpo.erro
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

        throw new Error(mensagem)
      }

      // Tratamento para requisições sem corpo na resposta (ex: DELETE 204)
      if (response.status === 204) {
        return true
      }

      return await response.json()
    } catch (error) {
      console.error(`[API Error] Falha em /${endpoint}:`, error)
      throw error
    }
  }

  // --- REQUISICÕES MENSALISTAS ---
  static async getMensalistas () {
    return await this.request('mensalistas')
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
      telefone: this.sanitizeText(data.telefone || '')
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
    if (data.placa !== undefined)
      payload.placa = this.sanitizeText(data.placa).toUpperCase().trim()
    if (data.telefone !== undefined)
      payload.telefone = this.sanitizeText(data.telefone)
    if (data.ativo !== undefined) payload.ativo = Boolean(data.ativo)

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

  // --- REQUISIÇÕES MENSALIDADES (ciclo mensal de cobrança do mensalista) ---
  // O ticket em si não gera cobrança para mensalista ativo — quem cobra é o
  // ciclo mensal (Mensalidade), aberto/encerrado automaticamente pelo
  // backend ao ativar/inativar (ver server/services/mensalidade.js).
  static async getMensalidades (mensalistaId) {
    const query = mensalistaId ? `?mensalistaId=${encodeURIComponent(mensalistaId)}` : ''
    return await this.request(`mensalidades${query}`)
  }

  static async updateMensalidade (id, status) {
    return await this.request(`mensalidades/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    })
  }

  // --- REQUISICÕES VAGAS ---
  static async getVagas () {
    return await this.request('vagas')
  }

  static async createVaga (data) {
    const payload = {
      codigo: this.sanitizeText(data.codigo).toUpperCase(),
      tipo: this.sanitizeText(data.tipo || 'carro').toLowerCase(),
      status: this.sanitizeText(data.status || 'livre').toLowerCase()
    }

    return await this.request('vagas', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

  static async updateVaga (id, data) {
    const payload = {}
    if (data.codigo !== undefined)
      payload.codigo = this.sanitizeText(data.codigo).toUpperCase()
    if (data.tipo !== undefined)
      payload.tipo = this.sanitizeText(data.tipo).toLowerCase()
    if (data.status !== undefined)
      payload.status = String(data.status).toLowerCase()

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
    if (data.categoria !== undefined)
      payload.categoria = this.sanitizeText(data.categoria)
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

  // --- REQUISICÕES TICKETS & REGRAS DE NEGÓCIO ---
  static async getTickets () {
    return await this.request('tickets')
  }

  /**
   * Criação/Abertura de Ticket.
   * A regra de negócio (checar se a vaga está livre, resolver mensalista
   * pela placa, marcar a vaga como ocupada) roda no backend numa única
   * transação — ver server/routes/tickets.js.
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

  static async confirmarResetSenha (email, novaSenha) {
    return await this.request('auth/reset/confirmar', {
      method: 'POST',
      body: JSON.stringify({
        email: this.sanitizeText(email).toLowerCase().trim(),
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

  static async getUsuarioPorCpf (cpf) {
    if (!cpf) return null
    const usuarios = await this.getUsuarios()
    const cpfNormalizado = String(cpf).replace(/\D/g, '')
    return (
      usuarios.find(
        u => (u.cpf || '').replace(/\D/g, '') === cpfNormalizado
      ) || null
    )
  }

  static async createUsuario (data) {
    const payload = {
      nome: this.sanitizeText(data.nome),
      cpf: this.sanitizeText(data.cpf || ''),
      email: this.sanitizeText(data.email).toLowerCase().trim(),
      senha: data.senha || '',
      telefone: this.sanitizeText(data.telefone || ''),
      endereco: this.sanitizeText(data.endereco || ''),
      dataNascimento: data.dataNascimento || '',
      avatar: data.avatar || '',
      role: data.role === 'admin' ? 'admin' : 'funcionario',
      ativo: data.ativo !== undefined ? Boolean(data.ativo) : true,
      aceitouTermos: Boolean(data.aceitouTermos),
      provedor: data.provedor === 'google' ? 'google' : 'local',
      criadoEm: new Date().toISOString()
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
    if (data.email !== undefined)
      payload.email = this.sanitizeText(data.email).toLowerCase().trim()
    if (data.senha !== undefined && data.senha !== '') payload.senha = data.senha
    if (data.senhaAtual !== undefined) payload.senhaAtual = data.senhaAtual
    if (data.telefone !== undefined)
      payload.telefone = this.sanitizeText(data.telefone)
    if (data.endereco !== undefined)
      payload.endereco = this.sanitizeText(data.endereco)
    if (data.dataNascimento !== undefined)
      payload.dataNascimento = data.dataNascimento
    if (data.avatar !== undefined) payload.avatar = data.avatar
    if (data.role !== undefined)
      payload.role = data.role === 'admin' ? 'admin' : 'funcionario'
    if (data.ativo !== undefined) payload.ativo = Boolean(data.ativo)

    return await this.request(`usuarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  }
}

window.ApiService = ApiService
