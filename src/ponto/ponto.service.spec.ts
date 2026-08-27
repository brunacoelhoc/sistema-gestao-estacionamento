import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { PontoService } from './ponto.service'
import { dataSemHora } from './ponto-datas.util'

function criarPrismaFake (seed: { perfis?: any[], registros?: any[], solicitacoes?: any[] } = {}) {
  const perfis = seed.perfis ?? []
  const registros = seed.registros ?? []
  const solicitacoes = seed.solicitacoes ?? []

  function encontrarRegistro (usuarioId: string, data: Date) {
    return registros.find(r => r.usuarioId === usuarioId && r.data.getTime() === data.getTime())
  }

  return {
    registros,
    perfilRH: {
      async findUnique ({ where: { usuarioId } }: any) { return perfis.find(p => p.usuarioId === usuarioId) ?? null }
    },
    registroPonto: {
      async findUnique ({ where: { usuarioId_data: { usuarioId, data } } }: any) {
        return encontrarRegistro(usuarioId, data) ?? null
      },
      async create ({ data }: any) {
        const novo = { id: `ponto-${registros.length + 1}`, criadoEm: new Date(), ...data }
        registros.push(novo)
        return novo
      },
      async update ({ where: { id }, data }: any) {
        const registro = registros.find(r => r.id === id)
        Object.assign(registro, data)
        return registro
      },
      async findMany ({ where }: any) {
        return registros.filter(r => r.usuarioId === where.usuarioId)
      }
    },
    solicitacaoTrabalhoExtra: {
      async findUnique ({ where: { usuarioId_data: { usuarioId, data } } }: any) {
        return solicitacoes.find(s => s.usuarioId === usuarioId && s.data.getTime() === data.getTime()) ?? null
      }
    }
  }
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  const prismaFake = criarPrismaFake(seed)
  const service = new PontoService(prismaFake as any)
  return { service, prismaFake }
}

const HOJE = new Date(2026, 7, 25) // terça-feira (mês 7 = agosto, 0-indexado)
const DIA_DA_SEMANA_HOJE = HOJE.getDay()

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(HOJE)
})

afterEach(() => {
  jest.useRealTimers()
})

describe('PontoService', () => {
  describe('registrarEntrada', () => {
    it('recusa quando o funcionário não tem perfil de RH', async () => {
      const { service } = criarService({ perfis: [] })
      await expect(service.registrarEntrada('u1')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('registra entrada num dia de escala', async () => {
      const { service, prismaFake } = criarService({
        perfis: [{ usuarioId: 'u1', diasEscala: [DIA_DA_SEMANA_HOJE] }]
      })
      const registro = await service.registrarEntrada('u1')
      expect(registro.usuarioId).toBe('u1')
      expect(registro.horaEntrada).toEqual(HOJE)
      expect(prismaFake.registros).toHaveLength(1)
    })

    it('recusa segunda entrada no mesmo dia', async () => {
      const { service } = criarService({
        perfis: [{ usuarioId: 'u1', diasEscala: [DIA_DA_SEMANA_HOJE] }],
        registros: [{ id: 'p1', usuarioId: 'u1', data: dataSemHora(HOJE), horaEntrada: HOJE, horaSaida: null }]
      })
      await expect(service.registrarEntrada('u1')).rejects.toBeInstanceOf(ConflictException)
    })

    it('recusa entrada fora da escala sem autorização aprovada', async () => {
      const diaForaDaEscala = (DIA_DA_SEMANA_HOJE + 1) % 7
      const { service } = criarService({
        perfis: [{ usuarioId: 'u1', diasEscala: [diaForaDaEscala] }]
      })
      await expect(service.registrarEntrada('u1')).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('permite entrada fora da escala com autorização aprovada', async () => {
      const diaForaDaEscala = (DIA_DA_SEMANA_HOJE + 1) % 7
      const { service, prismaFake } = criarService({
        perfis: [{ usuarioId: 'u1', diasEscala: [diaForaDaEscala] }],
        solicitacoes: [{ usuarioId: 'u1', data: dataSemHora(HOJE), status: 'aprovada' }]
      })
      const registro = await service.registrarEntrada('u1')
      expect(registro.usuarioId).toBe('u1')
      expect(prismaFake.registros).toHaveLength(1)
    })
  })

  describe('registrarSaida', () => {
    it('recusa quando não há entrada registrada', async () => {
      const { service } = criarService()
      await expect(service.registrarSaida('u1')).rejects.toBeInstanceOf(ConflictException)
    })

    it('registra a saída depois da entrada', async () => {
      const { service, prismaFake } = criarService({
        registros: [{ id: 'p1', usuarioId: 'u1', data: dataSemHora(HOJE), horaEntrada: HOJE, horaSaida: null }]
      })
      const registro = await service.registrarSaida('u1')
      expect(registro.horaSaida).toEqual(HOJE)
      expect(prismaFake.registros[0].horaSaida).toEqual(HOJE)
    })

    it('recusa segunda saída no mesmo dia', async () => {
      const { service } = criarService({
        registros: [{ id: 'p1', usuarioId: 'u1', data: dataSemHora(HOJE), horaEntrada: HOJE, horaSaida: HOJE }]
      })
      await expect(service.registrarSaida('u1')).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('listar', () => {
    it('funcionário não pode listar o ponto de outra pessoa', async () => {
      const { service } = criarService()
      const solicitante: any = { id: 'u2', role: 'funcionario' }
      await expect(service.listar('u1', solicitante)).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('rh pode listar o ponto de qualquer funcionário', async () => {
      const { service } = criarService({
        registros: [{ id: 'p1', usuarioId: 'u1', data: dataSemHora(HOJE), horaEntrada: HOJE, horaSaida: null }]
      })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      const resultado = await service.listar('u1', solicitante)
      expect(resultado).toHaveLength(1)
    })
  })
})
