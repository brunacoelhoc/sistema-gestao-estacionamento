import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import { parseDataLocal } from './ferias-datas.util'
import { FeriasService } from './ferias.service'

function criarPrismaFake (seed: { perfis?: any[], ferias?: any[] } = {}) {
  const perfis = seed.perfis ?? []
  const ferias = seed.ferias ?? []

  return {
    ferias,
    perfilRH: {
      async findUnique ({ where: { usuarioId } }: any) { return perfis.find(p => p.usuarioId === usuarioId) ?? null }
    },
    solicitacaoFerias: {
      async findUnique ({ where: { id } }: any) { return ferias.find(f => f.id === id) ?? null },
      async create ({ data }: any) {
        const nova = { id: `ferias-${ferias.length + 1}`, status: 'pendente', criadoEm: new Date(), ...data }
        ferias.push(nova)
        return nova
      },
      async update ({ where: { id }, data }: any) {
        const solicitacao = ferias.find(f => f.id === id)
        Object.assign(solicitacao, data)
        return solicitacao
      },
      async findMany ({ where }: any) {
        return ferias.filter(f =>
          (!where?.usuarioId || f.usuarioId === where.usuarioId) &&
          (!where?.status?.in || where.status.in.includes(f.status))
        )
      }
    }
  }
}

function criarAuditoriaFake (): AuditoriaService {
  return { registrar: jest.fn() } as unknown as AuditoriaService
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  const prismaFake = criarPrismaFake(seed)
  const auditoriaFake = criarAuditoriaFake()
  const service = new FeriasService(prismaFake as any, auditoriaFake)
  return { service, prismaFake, auditoriaFake }
}

const HOJE = new Date(2026, 7, 25) // 25/ago/2026

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(HOJE)
})

afterEach(() => {
  jest.useRealTimers()
})

// 90 dias a partir de hoje (25/ago) cai bem depois de novembro — usado como
// data de início "segura" em cenários que não testam a regra de antecedência.
const INICIO_COM_ANTECEDENCIA = '2026-12-01'
const FIM_COM_ANTECEDENCIA = '2026-12-10' // 10 dias

describe('FeriasService', () => {
  describe('solicitar', () => {
    it('recusa quando não tem perfil de RH', async () => {
      const { service } = criarService()
      await expect(service.solicitar('u1', { dataInicio: INICIO_COM_ANTECEDENCIA, dataFim: FIM_COM_ANTECEDENCIA }))
        .rejects.toBeInstanceOf(NotFoundException)
    })

    it('recusa quando a data de fim é anterior à de início', async () => {
      const { service } = criarService({ perfis: [{ usuarioId: 'u1' }] })
      await expect(service.solicitar('u1', { dataInicio: '2026-12-10', dataFim: '2026-12-01' }))
        .rejects.toBeInstanceOf(BadRequestException)
    })

    it('recusa quando a antecedência é menor que 90 dias', async () => {
      const { service } = criarService({ perfis: [{ usuarioId: 'u1' }] })
      await expect(service.solicitar('u1', { dataInicio: '2026-09-01', dataFim: '2026-09-10' }))
        .rejects.toBeInstanceOf(BadRequestException)
    })

    it('cria a solicitação com os dias calculados corretamente (inclusive)', async () => {
      const { service, prismaFake } = criarService({ perfis: [{ usuarioId: 'u1' }] })
      const solicitacao = await service.solicitar('u1', {
        dataInicio: INICIO_COM_ANTECEDENCIA, dataFim: FIM_COM_ANTECEDENCIA
      })
      expect(solicitacao.dias).toBe(10) // 01 a 10/dez, inclusive
      expect(solicitacao.status).toBe('pendente')
      expect(prismaFake.ferias).toHaveLength(1)
    })

    it('recusa quando ultrapassa 60 dias somando com pendentes/aprovadas do mesmo ano', async () => {
      const { service } = criarService({
        perfis: [{ usuarioId: 'u1' }],
        ferias: [{
          id: 'f1',
          usuarioId: 'u1',
          status: 'aprovada',
          dias: 55,
          dataInicio: parseDataLocal('2026-01-10'),
          dataFim: parseDataLocal('2026-03-05')
        }]
      })
      await expect(service.solicitar('u1', { dataInicio: INICIO_COM_ANTECEDENCIA, dataFim: FIM_COM_ANTECEDENCIA }))
        .rejects.toBeInstanceOf(BadRequestException)
    })

    it('recusa quando se sobrepõe a uma solicitação pendente/aprovada existente', async () => {
      const { service } = criarService({
        perfis: [{ usuarioId: 'u1' }],
        ferias: [{
          id: 'f1',
          usuarioId: 'u1',
          status: 'pendente',
          dias: 5,
          dataInicio: parseDataLocal('2026-12-05'),
          dataFim: parseDataLocal('2026-12-09')
        }]
      })
      await expect(service.solicitar('u1', { dataInicio: INICIO_COM_ANTECEDENCIA, dataFim: FIM_COM_ANTECEDENCIA }))
        .rejects.toBeInstanceOf(ConflictException)
    })

    it('detecta sobreposição na borda exata mesmo com datas no formato real do banco (meia-noite UTC)', async () => {
      // Replica o formato que o Postgres devolve pra @db.Date (meia-noite
      // UTC do dia gravado — ver ferias-datas.util.ts). Sem normalizarDataDoBanco,
      // essa comparação de borda (fim da existente == início da nova) falha
      // silenciosamente por causa do desvio de fuso.
      const { service } = criarService({
        perfis: [{ usuarioId: 'u1' }],
        ferias: [{
          id: 'f1',
          usuarioId: 'u1',
          status: 'pendente',
          dias: 1,
          dataInicio: new Date(Date.UTC(2026, 11, 1)),
          dataFim: new Date(Date.UTC(2026, 11, 1))
        }]
      })
      await expect(service.solicitar('u1', { dataInicio: INICIO_COM_ANTECEDENCIA, dataFim: FIM_COM_ANTECEDENCIA }))
        .rejects.toBeInstanceOf(ConflictException)
    })

    it('permite quando não há sobreposição nem estouro de limite', async () => {
      const { service } = criarService({
        perfis: [{ usuarioId: 'u1' }],
        ferias: [{
          id: 'f1',
          usuarioId: 'u1',
          status: 'aprovada',
          dias: 10,
          dataInicio: parseDataLocal('2026-01-10'),
          dataFim: parseDataLocal('2026-01-19')
        }]
      })
      const solicitacao = await service.solicitar('u1', {
        dataInicio: INICIO_COM_ANTECEDENCIA, dataFim: FIM_COM_ANTECEDENCIA
      })
      expect(solicitacao.dias).toBe(10)
    })
  })

  describe('listar', () => {
    it('funcionário não pode listar férias de outra pessoa', async () => {
      const { service } = criarService()
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      await expect(service.listar(solicitante, 'u2')).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('rh vê férias de todo mundo', async () => {
      const { service } = criarService({
        ferias: [
          { id: 'f1', usuarioId: 'u1', status: 'pendente', dias: 5, dataInicio: parseDataLocal('2026-12-01'), dataFim: parseDataLocal('2026-12-05') },
          { id: 'f2', usuarioId: 'u2', status: 'pendente', dias: 5, dataInicio: parseDataLocal('2026-12-01'), dataFim: parseDataLocal('2026-12-05') }
        ]
      })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      const resultado = await service.listar(solicitante)
      expect(resultado).toHaveLength(2)
    })
  })

  describe('decidir', () => {
    it('recusa decidir uma solicitação já decidida', async () => {
      const { service } = criarService({
        ferias: [{ id: 'f1', usuarioId: 'u1', status: 'aprovada', dias: 5 }]
      })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.decidir('f1', { status: 'rejeitada' }, solicitante))
        .rejects.toBeInstanceOf(ConflictException)
    })

    it('aprova e audita a decisão', async () => {
      const { service, prismaFake, auditoriaFake } = criarService({
        ferias: [{ id: 'f1', usuarioId: 'u1', status: 'pendente', dias: 5 }]
      })
      const solicitante: any = { id: 'rh1', role: 'rh' }

      const resultado = await service.decidir('f1', { status: 'aprovada' }, solicitante)

      expect(resultado.status).toBe('aprovada')
      expect(prismaFake.ferias[0].decididoPorId).toBe('rh1')
      expect(auditoriaFake.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'ferias.aprovar' }))
    })
  })

  describe('editar', () => {
    const solicitanteRh: any = { id: 'rh1', role: 'rh' }

    it('recusa editar solicitação inexistente', async () => {
      const { service } = criarService()
      await expect(service.editar('f1', { dataInicio: INICIO_COM_ANTECEDENCIA, dataFim: FIM_COM_ANTECEDENCIA }, solicitanteRh))
        .rejects.toBeInstanceOf(NotFoundException)
    })

    it('recusa editar solicitação já decidida', async () => {
      const { service } = criarService({
        ferias: [{
          id: 'f1',
          usuarioId: 'u1',
          status: 'aprovada',
          dias: 5,
          dataInicio: parseDataLocal('2026-12-01'),
          dataFim: parseDataLocal('2026-12-05')
        }]
      })
      await expect(service.editar('f1', { dataInicio: INICIO_COM_ANTECEDENCIA, dataFim: FIM_COM_ANTECEDENCIA }, solicitanteRh))
        .rejects.toBeInstanceOf(ConflictException)
    })

    it('recusa nova data sem 90 dias de antecedência', async () => {
      const { service } = criarService({
        ferias: [{
          id: 'f1',
          usuarioId: 'u1',
          status: 'pendente',
          dias: 5,
          dataInicio: parseDataLocal('2026-12-01'),
          dataFim: parseDataLocal('2026-12-05')
        }]
      })
      await expect(service.editar('f1', { dataInicio: '2026-09-01', dataFim: '2026-09-05' }, solicitanteRh))
        .rejects.toBeInstanceOf(BadRequestException)
    })

    it('não conta a própria solicitação contra o limite de 60 dias/ano ao reavaliar', async () => {
      const { service } = criarService({
        ferias: [{
          id: 'f1',
          usuarioId: 'u1',
          status: 'pendente',
          dias: 55,
          dataInicio: parseDataLocal('2026-12-01'),
          dataFim: parseDataLocal('2027-01-24')
        }]
      })
      // Editar as próprias datas dessa mesma solicitação (ainda 55 dias) não
      // deveria "bater" com ela mesma e estourar o limite.
      const resultado = await service.editar('f1', { dataInicio: '2026-12-05', dataFim: '2027-01-28' }, solicitanteRh)
      expect(resultado.dias).toBe(55)
    })

    it('recusa nova data que se sobrepõe a OUTRA solicitação pendente/aprovada', async () => {
      const { service } = criarService({
        ferias: [
          {
            id: 'f1',
            usuarioId: 'u1',
            status: 'pendente',
            dias: 5,
            dataInicio: parseDataLocal('2026-12-01'),
            dataFim: parseDataLocal('2026-12-05')
          },
          {
            id: 'f2',
            usuarioId: 'u1',
            status: 'aprovada',
            dias: 5,
            dataInicio: parseDataLocal('2026-12-20'),
            dataFim: parseDataLocal('2026-12-24')
          }
        ]
      })
      await expect(service.editar('f1', { dataInicio: '2026-12-18', dataFim: '2026-12-22' }, solicitanteRh))
        .rejects.toBeInstanceOf(ConflictException)
    })

    it('edita as datas e audita a alteração', async () => {
      const { service, prismaFake, auditoriaFake } = criarService({
        ferias: [{
          id: 'f1',
          usuarioId: 'u1',
          status: 'pendente',
          dias: 5,
          dataInicio: parseDataLocal('2026-12-01'),
          dataFim: parseDataLocal('2026-12-05')
        }]
      })

      const resultado = await service.editar('f1', { dataInicio: INICIO_COM_ANTECEDENCIA, dataFim: FIM_COM_ANTECEDENCIA }, solicitanteRh)

      expect(resultado.dias).toBe(10)
      expect(prismaFake.ferias[0].dataInicio).toEqual(parseDataLocal(INICIO_COM_ANTECEDENCIA))
      expect(auditoriaFake.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'ferias.editar' }))
    })
  })
})
