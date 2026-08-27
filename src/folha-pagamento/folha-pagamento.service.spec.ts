import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import type { NotificacoesService } from '../notificacoes/notificacoes.service'
import type { PontoCalculoService } from '../ponto/ponto-calculo.service'
import { FolhaPagamentoService } from './folha-pagamento.service'

function erroConflitoUnico () {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['usuarioId', 'referencia'] }
  })
}

function criarPrismaFake (seed: { perfis?: any[], holerites?: any[], assinaturas?: any[] } = {}) {
  const perfis = seed.perfis ?? []
  const holerites = seed.holerites ?? []
  const assinaturas = seed.assinaturas ?? []

  return {
    holerites,
    perfilRH: {
      async findUnique ({ where: { usuarioId } }: any) {
        return perfis.find(p => p.usuarioId === usuarioId) ?? null
      }
    },
    assinaturaEletronica: {
      async findUnique ({ where: { usuarioId } }: any) { return assinaturas.find(a => a.usuarioId === usuarioId) ?? null }
    },
    holerite: {
      async create ({ data }: any) {
        if (holerites.some(h => h.usuarioId === data.usuarioId && h.referencia === data.referencia)) {
          throw erroConflitoUnico()
        }
        const novo = { id: `holerite-${holerites.length + 1}`, status: 'gerado', assinadoEm: null, pagoEm: null, geradoEm: new Date(), ...data }
        holerites.push(novo)
        return novo
      },
      async findUnique ({ where: { id } }: any) {
        const holerite = holerites.find(h => h.id === id)
        if (!holerite) return null
        return {
          ...holerite,
          usuario: {
            nome: holerite.usuarioNome || 'Fulano',
            perfilRH: { cargo: 'Operador de Sistema' },
            assinaturaEletronica: assinaturas.find(a => a.usuarioId === holerite.usuarioId) ?? null
          },
          geradoPor: { nome: 'RH Fulano' }
        }
      },
      async update ({ where: { id }, data }: any) {
        const holerite = holerites.find(h => h.id === id)
        Object.assign(holerite, data)
        return holerite
      },
      async findMany ({ where }: any) {
        return holerites.filter(h => !where?.usuarioId || h.usuarioId === where.usuarioId)
      }
    }
  }
}

function criarPontoCalculoFake (resumo?: any): PontoCalculoService {
  return {
    resumoMes: jest.fn().mockResolvedValue(resumo ?? {
      dias: [
        { ehDiaDeEscala: true, horaEntrada: new Date(), horaSaida: new Date() },
        { ehDiaDeEscala: true, horaEntrada: new Date(), horaSaida: new Date() }
      ],
      totais: { horasNormais: 12, horasExtras: 0, horasForaEscala: 0, faltas: 0 }
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
  const service = new FolhaPagamentoService(prismaFake as any, pontoCalculoFake, notificacoesFake, auditoriaFake)
  return { service, prismaFake, pontoCalculoFake, notificacoesFake, auditoriaFake }
}

const PERFIL = { usuarioId: 'u1', salarioBase: 2500, horasPorDia: 6 }
const MES_PASSADO = '2026-06'
const MES_FUTURO = '2027-01'

describe('FolhaPagamentoService', () => {
  describe('gerar', () => {
    it('recusa quando o funcionário não tem perfil de RH', async () => {
      const { service } = criarService()
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.gerar({ usuarioId: 'u1', referencia: MES_PASSADO }, solicitante))
        .rejects.toBeInstanceOf(NotFoundException)
    })

    it('recusa gerar para um mês ainda não encerrado', async () => {
      const { service } = criarService({ perfis: [PERFIL] })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.gerar({ usuarioId: 'u1', referencia: MES_FUTURO }, solicitante))
        .rejects.toBeInstanceOf(BadRequestException)
    })

    it('gera o holerite com o cálculo, notifica e audita', async () => {
      const { service, prismaFake, notificacoesFake, auditoriaFake } = criarService({ perfis: [PERFIL] })
      const solicitante: any = { id: 'rh1', role: 'rh' }

      const holerite = await service.gerar({ usuarioId: 'u1', referencia: MES_PASSADO }, solicitante)

      expect(holerite.status).toBe('gerado')
      expect(Number(holerite.salarioProporcional)).toBe(2500) // sem faltas
      expect(prismaFake.holerites).toHaveLength(1)
      expect(notificacoesFake.criar).toHaveBeenCalledWith(expect.objectContaining({
        usuarioId: 'u1', tipo: 'holerite', holeriteId: holerite.id
      }))
      expect(auditoriaFake.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'holerite.gerar' }))
    })

    it('recusa gerar duas vezes para o mesmo funcionário/referência', async () => {
      const { service } = criarService({
        perfis: [PERFIL],
        holerites: [{ id: 'h1', usuarioId: 'u1', referencia: MES_PASSADO }]
      })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.gerar({ usuarioId: 'u1', referencia: MES_PASSADO }, solicitante))
        .rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('assinar', () => {
    it('recusa quando não é o dono', async () => {
      const { service } = criarService({
        holerites: [{ id: 'h1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'gerado' }]
      })
      const solicitante: any = { id: 'u2', role: 'funcionario' }
      await expect(service.assinar('h1', solicitante)).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('recusa sem assinatura eletrônica cadastrada', async () => {
      const { service } = criarService({
        holerites: [{ id: 'h1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'gerado' }]
      })
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      await expect(service.assinar('h1', solicitante)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('assina quando tem assinatura cadastrada', async () => {
      const { service, prismaFake } = criarService({
        holerites: [{ id: 'h1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'gerado' }],
        assinaturas: [{ usuarioId: 'u1', imagemDataUri: 'data:image/png;base64,abc' }]
      })
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      const resultado = await service.assinar('h1', solicitante)
      expect(resultado.status).toBe('assinado')
      expect(prismaFake.holerites[0].assinadoEm).toBeInstanceOf(Date)
    })
  })

  describe('pagar', () => {
    it('recusa pagar um holerite ainda não assinado', async () => {
      const { service } = criarService({
        holerites: [{ id: 'h1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'gerado' }]
      })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.pagar('h1', solicitante)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('recusa pagar duas vezes', async () => {
      const { service } = criarService({
        holerites: [{ id: 'h1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'pago', salarioLiquido: 2000 }]
      })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      await expect(service.pagar('h1', solicitante)).rejects.toBeInstanceOf(ConflictException)
    })

    it('paga quando assinado, e audita', async () => {
      const { service, prismaFake, auditoriaFake } = criarService({
        holerites: [{ id: 'h1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'assinado', salarioLiquido: 2000 }]
      })
      const solicitante: any = { id: 'rh1', role: 'rh' }
      const resultado = await service.pagar('h1', solicitante)
      expect(resultado.status).toBe('pago')
      expect(prismaFake.holerites[0].pagoEm).toBeInstanceOf(Date)
      expect(auditoriaFake.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'holerite.pagar' }))
    })
  })

  describe('listar', () => {
    it('gestor só vê o próprio histórico, nunca o de terceiros (salário não é dado de gestão)', async () => {
      const { service } = criarService({
        holerites: [
          { id: 'h1', usuarioId: 'gestor1', referencia: MES_PASSADO, status: 'pago' },
          { id: 'h2', usuarioId: 'u1', referencia: MES_PASSADO, status: 'pago' }
        ]
      })
      const solicitante: any = { id: 'gestor1', role: 'gestor' }
      const resultado = await service.listar(solicitante)
      expect(resultado).toHaveLength(1)
      expect(resultado[0].usuarioId).toBe('gestor1')
    })
  })

  describe('gerarPdf', () => {
    it('recusa quando ainda não foi assinado', async () => {
      const { service } = criarService({
        holerites: [{ id: 'h1', usuarioId: 'u1', referencia: MES_PASSADO, status: 'gerado' }]
      })
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      await expect(service.gerarPdf('h1', solicitante)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('recusa quando não é o dono nem rh/admin', async () => {
      const { service } = criarService({
        holerites: [{
          id: 'h1',
          usuarioId: 'u1',
          referencia: MES_PASSADO,
          status: 'assinado',
          assinadoEm: new Date(),
          salarioProporcional: 2500,
          valorHorasExtras: 0,
          valorHorasForaEscala: 0,
          valorVr: 800,
          valorVa: 800,
          inss: 200,
          irrf: 0,
          salarioLiquido: 3900
        }],
        assinaturas: [{ usuarioId: 'u1', imagemDataUri: 'data:image/png;base64,abc' }]
      })
      const solicitante: any = { id: 'u2', role: 'funcionario' }
      await expect(service.gerarPdf('h1', solicitante)).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('gera o PDF quando assinado e o solicitante é o dono', async () => {
      const { service } = criarService({
        holerites: [{
          id: 'h1',
          usuarioId: 'u1',
          referencia: MES_PASSADO,
          status: 'assinado',
          assinadoEm: new Date(),
          salarioProporcional: 2500,
          valorHorasExtras: 0,
          valorHorasForaEscala: 0,
          valorVr: 800,
          valorVa: 800,
          inss: 200,
          irrf: 0,
          salarioLiquido: 3900
        }],
        assinaturas: [{ usuarioId: 'u1', imagemDataUri: 'data:image/png;base64,aGVsbG8=' }]
      })
      const solicitante: any = { id: 'u1', role: 'funcionario' }
      const pdf = await service.gerarPdf('h1', solicitante)
      expect(Buffer.isBuffer(pdf)).toBe(true)
      expect(pdf.length).toBeGreaterThan(0)
    })
  })
})
