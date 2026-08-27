import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import type { NotificacoesService } from '../notificacoes/notificacoes.service'
import type { PontoCalculoService } from '../ponto/ponto-calculo.service'
import { EspelhoPontoService } from './espelho-ponto.service'

function erroConflitoUnico () {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['usuarioId', 'referencia'] }
  })
}

function criarPrismaFake (seed: { perfis?: any[], folhas?: any[], assinaturas?: any[] } = {}) {
  const perfis = seed.perfis ?? []
  const folhas = seed.folhas ?? []
  const assinaturas = seed.assinaturas ?? []

  return {
    folhas,
    perfilRH: {
      async findUnique ({ where: { usuarioId } }: any) { return perfis.find(p => p.usuarioId === usuarioId) ?? null }
    },
    assinaturaEletronica: {
      async findUnique ({ where: { usuarioId } }: any) { return assinaturas.find(a => a.usuarioId === usuarioId) ?? null }
    },
    folhaPontoMensal: {
      async create ({ data }: any) {
        if (folhas.some(f => f.usuarioId === data.usuarioId && f.referencia === data.referencia)) {
          throw erroConflitoUnico()
        }
        const nova = { id: `folha-${folhas.length + 1}`, status: 'pendente_assinatura', assinadoEm: null, geradoEm: new Date(), ...data }
        folhas.push(nova)
        return nova
      },
      async findUnique ({ where: { id } }: any) {
        const folha = folhas.find(f => f.id === id)
        if (!folha) return null
        return {
          ...folha,
          usuario: { nome: folha.usuarioNome || 'Fulano', perfilRH: { cargo: 'Operador de Sistema' }, assinaturaEletronica: assinaturas.find(a => a.usuarioId === folha.usuarioId) ?? null },
          geradoPor: { nome: 'RH Fulano' }
        }
      },
      async update ({ where: { id }, data }: any) {
        const folha = folhas.find(f => f.id === id)
        Object.assign(folha, data)
        return folha
      },
      async findMany ({ where }: any) {
        return folhas.filter(f => !where?.usuarioId || f.usuarioId === where.usuarioId)
      }
    }
  }
}

function criarPontoCalculoFake (resumo?: any): PontoCalculoService {
  return {
    resumoMes: jest.fn().mockResolvedValue(resumo ?? {
      totais: { horasNormais: 100, horasExtras: 5, horasForaEscala: 0, faltas: 1 }
    })
  } as unknown as PontoCalculoService
}

function criarNotificacoesFake (): NotificacoesService {
  return { criar: jest.fn() } as unknown as NotificacoesService
}

function criarAuditoriaFake (): AuditoriaService {
  return { registrar: jest.fn() } as unknown as AuditoriaService
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0], resumo?: any) {
  const prismaFake = criarPrismaFake(seed)
  const pontoCalculoFake = criarPontoCalculoFake(resumo)
  const notificacoesFake = criarNotificacoesFake()
  const auditoriaFake = criarAuditoriaFake()
  const service = new EspelhoPontoService(prismaFake as any, pontoCalculoFake, notificacoesFake, auditoriaFake)
  return { service, prismaFake, pontoCalculoFake, notificacoesFake, auditoriaFake }
}

const MES_PASSADO = '2026-06'
const MES_FUTURO = '2027-01'

describe('EspelhoPontoService', () => {
  describe('gerar', () => {
    it('recusa quando o funcionário não tem perfil de RH', async () => {
      const { service } = criarService()
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.gerar({ usuarioId: 'u1', referencia: MES_PASSADO }, solicitante))
        .rejects.toBeInstanceOf(NotFoundException)
    })

    it('recusa gerar para um mês ainda não encerrado', async () => {
      const { service } = criarService({ perfis: [{ usuarioId: 'u1' }] })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.gerar({ usuarioId: 'u1', referencia: MES_FUTURO }, solicitante))
        .rejects.toBeInstanceOf(BadRequestException)
    })

    it('gera o espelho, notifica o funcionário e audita', async () => {
      const { service, prismaFake, notificacoesFake, auditoriaFake } = criarService({ perfis: [{ usuarioId: 'u1' }] })
      const solicitante: any = { id: 'rh1', role: 'rh' }

      const folha = await service.gerar({ usuarioId: 'u1', referencia: MES_PASSADO }, solicitante)

      expect(folha.status).toBe('pendente_assinatura')
      expect(folha.horasNormais).toBe(100)
      expect(prismaFake.folhas).toHaveLength(1)
      expect(notificacoesFake.criar).toHaveBeenCalledWith(expect.objectContaining({
        usuarioId: 'u1', tipo: 'folha_ponto', folhaPontoId: folha.id
      }))
      expect(auditoriaFake.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'espelho-ponto.gerar' }))
    })

    it('recusa gerar duas vezes para o mesmo funcionário/referência', async () => {
      const { service } = criarService({
        perfis: [{ usuarioId: 'u1' }],
        folhas: [{ id: 'f1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'pendente_assinatura' }]
      })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.gerar({ usuarioId: 'u1', referencia: MES_PASSADO }, solicitante))
        .rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('assinar', () => {
    it('recusa quando não é o dono do espelho', async () => {
      const { service } = criarService({
        folhas: [{ id: 'f1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'pendente_assinatura' }]
      })
      const solicitante: any = { id: 'u2', role: 'funcionario' }
      await expect(service.assinar('f1', solicitante)).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('recusa assinar duas vezes', async () => {
      const { service } = criarService({
        folhas: [{ id: 'f1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'assinado' }]
      })
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      await expect(service.assinar('f1', solicitante)).rejects.toBeInstanceOf(ConflictException)
    })

    it('recusa assinar sem assinatura eletrônica cadastrada', async () => {
      const { service } = criarService({
        folhas: [{ id: 'f1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'pendente_assinatura' }]
      })
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      await expect(service.assinar('f1', solicitante)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('assina quando tem assinatura cadastrada', async () => {
      const { service, prismaFake } = criarService({
        folhas: [{ id: 'f1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'pendente_assinatura' }],
        assinaturas: [{ usuarioId: 'u1', imagemDataUri: 'data:image/png;base64,abc' }]
      })
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      const resultado = await service.assinar('f1', solicitante)
      expect(resultado.status).toBe('assinado')
      expect(prismaFake.folhas[0].assinadoEm).toBeInstanceOf(Date)
    })
  })

  describe('gerarPdf', () => {
    it('recusa quando ainda não foi assinado', async () => {
      const { service } = criarService({
        folhas: [{ id: 'f1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'pendente_assinatura' }]
      })
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      await expect(service.gerarPdf('f1', solicitante)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('recusa quando não é o dono nem rh/admin', async () => {
      const { service } = criarService({
        folhas: [{ id: 'f1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'assinado', assinadoEm: new Date() }],
        assinaturas: [{ usuarioId: 'u1', imagemDataUri: 'data:image/png;base64,abc' }]
      })
      const solicitante: any = { id: 'u2', role: 'funcionario' }
      await expect(service.gerarPdf('f1', solicitante)).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('gera o PDF quando assinado e o solicitante é o dono', async () => {
      const { service } = criarService({
        folhas: [{ id: 'f1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'assinado', assinadoEm: new Date() }],
        assinaturas: [{ usuarioId: 'u1', imagemDataUri: 'data:image/png;base64,aGVsbG8=' }]
      })
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      const pdf = await service.gerarPdf('f1', solicitante)
      expect(Buffer.isBuffer(pdf)).toBe(true)
      expect(pdf.length).toBeGreaterThan(0)
    })
  })
})
