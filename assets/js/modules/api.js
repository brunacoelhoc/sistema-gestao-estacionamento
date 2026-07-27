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
      const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
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
    const mensalistas = await this.getMensalistas()
    const placaSanitizada = this.sanitizeText(placa).toUpperCase()
    return (
      mensalistas.find(m => m.placa.toUpperCase() === placaSanitizada) || null
    )
  }

  static async createMensalista (data) {
    return await this.request('mensalistas', {
      method: 'POST',
      body: JSON.stringify({
        nome: this.sanitizeText(data.nome),
        cpf: this.sanitizeText(data.cpf),
        placa: this.sanitizeText(data.placa).toUpperCase(),
        status: data.status || 'Ativo',
        telefone: this.sanitizeText(data.telefone)
      })
    })
  }

  static async updateMensalista (id, data) {
    return await this.request(`mensalistas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  }

  // --- REQUISICÕES VAGAS ---
  static async getVagas () {
    return await this.request('vagas')
  }

  static async updateVagaStatus (id, status) {
    return await this.request(`vagas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
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
   * Regra de Negócio: Abertura de Ticket
   */
  static async abrirTicket (placa, tipoVeiculo, vagaId) {
    const vaga = (await this.getVagas()).find(v => v.id === vagaId)
    if (!vaga || vaga.status === 'Ocupada') {
      throw new Error('A vaga selecionada já está ocupada ou é inválida.')
    }

    const mensalista = await this.getMensalistaByPlaca(placa)
    const isMensalistaAtivo = mensalista && mensalista.status === 'Ativo'

    const novoTicket = {
      placa: this.sanitizeText(placa).toUpperCase(),
      tipoVeiculo,
      vagaId,
      mensalistaId: isMensalistaAtivo ? mensalista.id : null,
      dataEntrada: new Date().toISOString(),
      dataSaida: null,
      valorTotal: null,
      status: 'Aberto'
    }

    const ticketCriado = await this.request('tickets', {
      method: 'POST',
      body: JSON.stringify(novoTicket)
    })

    // Atualiza vaga para Ocupada
    await this.updateVagaStatus(vagaId, 'Ocupada')

    return ticketCriado
  }

  /**
   * Regra de Negócio: Fechamento de Ticket e Cálculo de Tarifas
   */
  static async fecharTicket (ticketId) {
    const tickets = await this.getTickets()
    const ticket = tickets.find(t => t.id === ticketId)
    if (!ticket || ticket.status !== 'Aberto') {
      throw new Error('Ticket inválido ou já finalizado.')
    }

    const dataSaida = new Date()
    const dataEntrada = new Date(ticket.dataEntrada)
    const diffHoras = Math.max(
      1,
      Math.ceil((dataSaida - dataEntrada) / (1000 * 60 * 60))
    )

    let valorTotal = 0

    // Se for Mensalista Ativo, o valor final é R$ 0,00
    if (ticket.mensalistaId) {
      const mensalista = (await this.getMensalistas()).find(
        m => m.id === ticket.mensalistaId
      )
      if (mensalista && mensalista.status === 'Ativo') {
        valorTotal = 0.0
      }
    } else {
      // Cálculo para avulsos com base na tarifa cadastrada
      const tarifas = await this.getTarifas()
      const tarifa = tarifas.find(t => t.tipoVeiculo === ticket.tipoVeiculo)
      const valorHora = tarifa ? tarifa.valorHora : 10.0
      const valorAdicional = tarifa ? tarifa.valorAdicional : 5.0

      if (diffHoras === 1) {
        valorTotal = valorHora
      } else {
        valorTotal = valorHora + (diffHoras - 1) * valorAdicional
      }
    }

    // Atualizar ticket
    const ticketAtualizado = await this.request(`tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        dataSaida: dataSaida.toISOString(),
        valorTotal,
        status: 'Pago'
      })
    })

    // Liberar vaga automaticamente
    await this.updateVagaStatus(ticket.vagaId, 'Livre')

    return ticketAtualizado
  }
}

window.ApiService = ApiService
