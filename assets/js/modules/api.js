/**
 * Módulo de Integração com API (json-server) & Regras de Negócio
 * DevSecOps: Tratamento de erros, sanitização contra XSS e isolamento de regras.
 */

const API_BASE_URL = 'http://localhost:3000'

class ApiService {
  // --- MÉTODOS AUXILIARES DE SEGURANÇA & SANITIZAÇÃO ---
  static sanitizeText (str) {
    if (!str) return ''
    const temp = document.createElement('div')
    temp.textContent = str
    return temp.innerHTML
  }

  static async request (endpoint, options = {}) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }

      const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        ...options,
        headers
      })

      if (!response.ok) {
        throw new Error(
          `Erro HTTP: ${response.status} - ${response.statusText}`
        )
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
    const placaSanitizada = this.sanitizeText(placa).toUpperCase()
    return (
      mensalistas.find(
        m => m.placa && m.placa.toUpperCase() === placaSanitizada
      ) || null
    )
  }

  static async createMensalista (data) {
    const payload = {
      nome: this.sanitizeText(data.nome),
      cpf: this.sanitizeText(data.cpf),
      placa: this.sanitizeText(data.placa).toUpperCase(),
      ativo: data.ativo !== undefined ? Boolean(data.ativo) : true,
      telefone: this.sanitizeText(data.telefone)
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
      payload.placa = this.sanitizeText(data.placa).toUpperCase()
    if (data.telefone !== undefined)
      payload.telefone = this.sanitizeText(data.telefone)
    if (data.ativo !== undefined) payload.ativo = Boolean(data.ativo)

    return await this.request(`mensalistas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  }

  // --- REQUISICÕES VAGAS ---
  static async getVagas () {
    return await this.request('vagas')
  }

  static async updateVagaStatus (id, status) {
    // Garante casing padronizado ('ocupada' | 'livre')
    const statusNormalizado = String(status).toLowerCase()
    return await this.request(`vagas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: statusNormalizado })
    })
  }

  // --- REQUISICÕES TARIFAS ---
  static async getTarifas () {
    return await this.request('tarifas')
  }

  // --- REQUISICÕES TICKETS & REGRAS DE NEGÓCIO ---
  static async getTickets () {
    return await this.request('tickets')
  }

  /**
   * Regra de Negócio: Criação/Abertura de Ticket (Metodo esperado por tickets.js)
   * @param {Object} params - { placa, vagaId, tarifaId, mensalistaId }
   */
  static async criarTicket ({ placa, vagaId, tarifaId, mensalistaId = null }) {
    const vagas = await this.getVagas()
    const vaga = vagas.find(v => String(v.id) === String(vagaId))

    if (!vaga || String(vaga.status).toLowerCase() === 'ocupada') {
      throw new Error('A vaga selecionada já está ocupada ou é inválida.')
    }

    // Se mensalistaId não veio explicitamente, busca pela placa
    let finalMensalistaId = mensalistaId
    if (!finalMensalistaId) {
      const mensalista = await this.getMensalistaByPlaca(placa)
      if (mensalista && mensalista.ativo === true) {
        finalMensalistaId = mensalista.id
      }
    }

    const novoTicket = {
      placa: this.sanitizeText(placa).toUpperCase(),
      vagaId,
      tarifaId: tarifaId || null,
      mensalistaId: finalMensalistaId || null,
      dataEntrada: new Date().toISOString(),
      dataSaida: null,
      valorTotal: null,
      status: 'aberto'
    }

    const ticketCriado = await this.request('tickets', {
      method: 'POST',
      body: JSON.stringify(novoTicket)
    })

    // Atualiza status da vaga para 'ocupada'
    await this.updateVagaStatus(vagaId, 'ocupada')

    return ticketCriado
  }

  /**
   * Alias para manter compatibilidade com chamadas legado
   */
  static async abrirTicket (placa, tipoVeiculo, vagaId) {
    return await this.criarTicket({ placa, vagaId, tarifaId: null })
  }

  /**
   * Regra de Negócio: Fechamento de Ticket e Cálculo de Tarifas
   */
  static async fecharTicket (ticketId) {
    const tickets = await this.getTickets()
    const ticket = tickets.find(t => String(t.id) === String(ticketId))

    if (!ticket || String(ticket.status).toLowerCase() !== 'aberto') {
      throw new Error('Ticket inválido ou já finalizado.')
    }

    const dataSaida = new Date()
    const dataEntrada = new Date(ticket.dataEntrada)
    const diffHoras = Math.max(
      1,
      Math.ceil((dataSaida - dataEntrada) / (1000 * 60 * 60))
    )

    let valorTotal = 0

    // Se for Mensalista Ativo, valor e isento (R$ 0,00)
    if (ticket.mensalistaId) {
      const mensalistas = await this.getMensalistas()
      const mensalista = mensalistas.find(
        m => String(m.id) === String(ticket.mensalistaId)
      )
      if (mensalista && mensalista.ativo === true) {
        valorTotal = 0.0
      }
    }

    // Se nao for mensalista e houver calculo a fazer
    if (!ticket.mensalistaId || valorTotal !== 0) {
      const tarifas = await this.getTarifas()
      // Busca tarifa pelo tarifaId gravado no ticket ou usa a primeira disponível
      const tarifa =
        tarifas.find(t => String(t.id) === String(ticket.tarifaId)) ||
        tarifas[0]

      const valorHora = tarifa ? Number(tarifa.valorHora || tarifa.valor) : 10.0
      const valorAdicional = tarifa
        ? Number(tarifa.valorAdicional || tarifa.adicional || 5.0)
        : 5.0

      if (diffHoras === 1) {
        valorTotal = valorHora
      } else {
        valorTotal = valorHora + (diffHoras - 1) * valorAdicional
      }
    }

    // Atualiza ticket para fechado
    const ticketAtualizado = await this.request(`tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        dataSaida: dataSaida.toISOString(),
        valorTotal,
        status: 'fechado'
      })
    })

    // Libera a vaga automaticamente
    if (ticket.vagaId) {
      await this.updateVagaStatus(ticket.vagaId, 'livre')
    }

    return ticketAtualizado
  }
}

window.ApiService = ApiService
