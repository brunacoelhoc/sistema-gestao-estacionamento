/**
 * Módulo de Integração com API (json-server) & Regras de Negócio
 * DevSecOps: Tratamento de erros, sanitização contra XSS e isolamento de regras.
 */

const API_BASE_URL = 'http://localhost:3000'

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

      const response = await fetch(`${API_BASE_URL}/vagas?_limit=1`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      return response.ok
    } catch (error) {
      console.warn('[API Health Check Failed]:', error)
      return false
    }
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
      valorHora: Number(data.valorHora || data.valor) || 0,
      valorAdicional: Number(data.valorAdicional || data.adicional) || 0
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
    if (data.valorAdicional !== undefined || data.adicional !== undefined) {
      payload.valorAdicional =
        Number(data.valorAdicional || data.adicional) || 0
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
   * Regra de Negócio: Criação/Abertura de Ticket
   * @param {Object} params - { placa, vagaId, tarifaId, mensalistaId }
   */
  static async criarTicket ({ placa, vagaId, tarifaId, mensalistaId = null }) {
    const vagas = await this.getVagas()
    const vaga = vagas.find(v => String(v.id) === String(vagaId))

    if (!vaga || String(vaga.status).toLowerCase() === 'ocupada') {
      throw new Error('A vaga selecionada já está ocupada ou é inválida.')
    }

    let finalMensalistaId = mensalistaId
    if (!finalMensalistaId) {
      const mensalista = await this.getMensalistaByPlaca(placa)
      if (mensalista && mensalista.ativo === true) {
        finalMensalistaId = mensalista.id
      }
    }

    const novoTicket = {
      placa: this.sanitizeText(placa).toUpperCase().trim(),
      vagaId: String(vagaId),
      tarifaId: tarifaId ? String(tarifaId) : null,
      mensalistaId: finalMensalistaId ? String(finalMensalistaId) : null,
      dataEntrada: new Date().toISOString(),
      dataSaida: null,
      valorTotal: null,
      status: 'aberto'
    }

    const ticketCriado = await this.request('tickets', {
      method: 'POST',
      body: JSON.stringify(novoTicket)
    })

    await this.updateVagaStatus(vagaId, 'ocupada')

    return ticketCriado
  }

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

    if (ticket.mensalistaId) {
      const mensalistas = await this.getMensalistas()
      const mensalista = mensalistas.find(
        m => String(m.id) === String(ticket.mensalistaId)
      )
      if (mensalista && mensalista.ativo === true) {
        valorTotal = 0.0
      }
    }

    if (!ticket.mensalistaId || valorTotal !== 0) {
      const tarifas = await this.getTarifas()
      const tarifa =
        tarifas.find(t => String(t.id) === String(ticket.tarifaId)) ||
        tarifas[0]

      const valorHora = tarifa
        ? Number(tarifa.valorHora || tarifa.valor || 10.0)
        : 10.0
      const valorAdicional = tarifa
        ? Number(tarifa.valorAdicional || tarifa.adicional || 5.0)
        : 5.0

      if (diffHoras === 1) {
        valorTotal = valorHora
      } else {
        valorTotal = valorHora + (diffHoras - 1) * valorAdicional
      }
    }

    const ticketAtualizado = await this.request(`tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        dataSaida: dataSaida.toISOString(),
        valorTotal,
        status: 'fechado'
      })
    })

    if (ticket.vagaId) {
      await this.updateVagaStatus(ticket.vagaId, 'livre')
    }

    return ticketAtualizado
  }

  static async deleteTicket (id) {
    return await this.request(`tickets/${id}`, {
      method: 'DELETE'
    })
  }
}

window.ApiService = ApiService
