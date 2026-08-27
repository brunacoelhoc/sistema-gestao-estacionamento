import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { PontoCalculoService } from './ponto-calculo.service'
import { combinarDataHora } from './ponto-datas.util'

function criarPrismaFake (
  seed: { perfis?: any[], registros?: any[], solicitacoes?: any[], justificativas?: any[], ferias?: any[] } = {}
) {
  const perfis = seed.perfis ?? []
  const registros = seed.registros ?? []
  const solicitacoes = seed.solicitacoes ?? []
  const justificativas = seed.justificativas ?? []
  const ferias = seed.ferias ?? []

  return {
    perfilRH: {
      async findUnique ({ where: { usuarioId } }: any) { return perfis.find(p => p.usuarioId === usuarioId) ?? null }
    },
    registroPonto: {
      async findMany () { return registros }
    },
    solicitacaoTrabalhoExtra: {
      async findMany () { return solicitacoes }
    },
    justificativaPonto: {
      async findMany () { return justificativas }
    },
    solicitacaoFerias: {
      async findMany () { return ferias }
    }
  }
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  const prismaFake = criarPrismaFake(seed)
  const service = new PontoCalculoService(prismaFake as any)
  return { service, prismaFake }
}

const PERFIL_BASE = { diasEscala: [2, 3, 4, 5], horasPorDia: 6, horaInicioEscala: '08:00' }

// calcularDia é privado de propósito (detalhe de implementação reaproveitado
// só dentro do service) — testado via cast pra validar cada regra de
// negócio isoladamente, sem a complexidade de popular um mês inteiro de
// registros só pra isolar um único dia.
function calcularDia (service: PontoCalculoService, params: any) {
  return (service as any).calcularDia(params)
}

describe('PontoCalculoService', () => {
  describe('calcularDia — dia de escala', () => {
    it('sem nenhum registro conta como falta', () => {
      const { service } = criarService()
      const resultado = calcularDia(service, {
        chave: '2026-08-11',
        diaDaSemana: 2,
        registro: null,
        autorizacaoAprovada: false,
        justificativa: null,
        perfil: PERFIL_BASE
      })
      expect(resultado.falta).toBe(true)
      expect(resultado.horasNormais).toBe(0)
    })

    it('ausência com justificativa (atestado/abono/folga) não conta como falta', () => {
      const { service } = criarService()
      for (const tipo of ['atestado', 'abono', 'folga'] as const) {
        const resultado = calcularDia(service, {
          chave: '2026-08-11',
          diaDaSemana: 2,
          registro: null,
          autorizacaoAprovada: false,
          justificativa: tipo,
          perfil: PERFIL_BASE
        })
        expect(resultado.falta).toBe(false)
        expect(resultado.justificativa).toBe(tipo)
      }
    })

    it('ausência coberta por férias aprovadas não conta como falta', () => {
      const { service } = criarService()
      const resultado = calcularDia(service, {
        chave: '2026-08-11',
        diaDaSemana: 2,
        registro: null,
        autorizacaoAprovada: false,
        justificativa: null,
        emFerias: true,
        perfil: PERFIL_BASE
      })
      expect(resultado.falta).toBe(false)
      expect(resultado.ferias).toBe(true)
    })

    it('entrada em aberto (sem saída) não conta horas nem falta', () => {
      const { service } = criarService()
      const resultado = calcularDia(service, {
        chave: '2026-08-11',
        diaDaSemana: 2,
        registro: { horaEntrada: combinarDataHora('2026-08-11', '08:00'), horaSaida: null },
        autorizacaoAprovada: false,
        perfil: PERFIL_BASE
      })
      expect(resultado.emAberto).toBe(true)
      expect(resultado.falta).toBe(false)
      expect(resultado.horasNormais).toBe(0)
    })

    it('entrada pontual e jornada completa: 6h normais, 0 extra', () => {
      const { service } = criarService()
      const resultado = calcularDia(service, {
        chave: '2026-08-11',
        diaDaSemana: 2,
        registro: {
          horaEntrada: combinarDataHora('2026-08-11', '08:00'),
          horaSaida: combinarDataHora('2026-08-11', '14:00')
        },
        autorizacaoAprovada: false,
        perfil: PERFIL_BASE
      })
      expect(resultado.horasNormais).toBe(6)
      expect(resultado.horasExtras).toBe(0)
    })

    it('atraso dentro da tolerância (20min) não desconta nada', () => {
      const { service } = criarService()
      const resultado = calcularDia(service, {
        chave: '2026-08-11',
        diaDaSemana: 2,
        registro: {
          // 15 minutos de atraso, dentro da tolerância de 20.
          horaEntrada: combinarDataHora('2026-08-11', '08:15'),
          horaSaida: combinarDataHora('2026-08-11', '14:00')
        },
        autorizacaoAprovada: false,
        perfil: PERFIL_BASE
      })
      expect(resultado.horasNormais).toBe(6)
    })

    it('atraso acima da tolerância desconta o tempo perdido, sem virar falta', () => {
      const { service } = criarService()
      const resultado = calcularDia(service, {
        chave: '2026-08-11',
        diaDaSemana: 2,
        registro: {
          // 40 minutos de atraso — desconta os 40min além do previsto.
          horaEntrada: combinarDataHora('2026-08-11', '08:40'),
          horaSaida: combinarDataHora('2026-08-11', '14:00')
        },
        autorizacaoAprovada: false,
        perfil: PERFIL_BASE
      })
      expect(resultado.falta).toBe(false)
      expect(resultado.horasNormais).toBeCloseTo(5.33, 1) // 5h20min trabalhadas
    })

    it('trabalhar além da jornada gera hora extra (paga por hora normal)', () => {
      const { service } = criarService()
      const resultado = calcularDia(service, {
        chave: '2026-08-11',
        diaDaSemana: 2,
        registro: {
          horaEntrada: combinarDataHora('2026-08-11', '08:00'),
          horaSaida: combinarDataHora('2026-08-11', '16:00') // 8h trabalhadas, 6h previstas
        },
        autorizacaoAprovada: false,
        perfil: PERFIL_BASE
      })
      expect(resultado.horasNormais).toBe(6)
      expect(resultado.horasExtras).toBe(2)
    })
  })

  describe('calcularDia — dia fora da escala', () => {
    it('registro sem autorização aprovada não conta nada (bloqueado antes, mas defensivo aqui)', () => {
      const { service } = criarService()
      const resultado = calcularDia(service, {
        chave: '2026-08-15', // sábado, fora da escala [2,3,4,5]
        diaDaSemana: 6,
        registro: {
          horaEntrada: combinarDataHora('2026-08-15', '08:00'),
          horaSaida: combinarDataHora('2026-08-15', '14:00')
        },
        autorizacaoAprovada: false,
        perfil: PERFIL_BASE
      })
      expect(resultado.horasForaEscala).toBe(0)
      expect(resultado.falta).toBe(false)
    })

    it('sem registro não conta como falta (dia não era esperado)', () => {
      const { service } = criarService()
      const resultado = calcularDia(service, {
        chave: '2026-08-15', diaDaSemana: 6, registro: null, autorizacaoAprovada: false, perfil: PERFIL_BASE
      })
      expect(resultado.falta).toBe(false)
    })

    it('com autorização aprovada, todas as horas viram horasForaEscala', () => {
      const { service } = criarService()
      const resultado = calcularDia(service, {
        chave: '2026-08-15',
        diaDaSemana: 6,
        registro: {
          horaEntrada: combinarDataHora('2026-08-15', '09:00'),
          horaSaida: combinarDataHora('2026-08-15', '13:00')
        },
        autorizacaoAprovada: true,
        perfil: PERFIL_BASE
      })
      expect(resultado.horasForaEscala).toBe(4)
      expect(resultado.horasNormais).toBe(0)
    })
  })

  describe('resumoMes', () => {
    it('recusa quando o funcionário não tem perfil de RH', async () => {
      const { service } = criarService()
      const solicitante: any = { id: 'admin1', role: 'admin' }
      await expect(service.resumoMes('u1', '2026-08', solicitante)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('funcionário não pode ver o resumo de outra pessoa', async () => {
      const { service } = criarService()
      const solicitante: any = { id: 'u2', role: 'funcionario' }
      await expect(service.resumoMes('u1', '2026-08', solicitante)).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('casa registros do banco (data em meia-noite UTC) com o dia correto, mesmo em fuso atrás de UTC', async () => {
      // Replica o formato real que o Postgres/@prisma/adapter-pg devolve pra
      // colunas @db.Date: meia-noite UTC do dia gravado (verificado contra o
      // banco real) — não meia-noite no fuso local do servidor. Um teste que
      // só usasse `new Date(2026, 7, 11)` (meia-noite local) não teria pego
      // o bug original de chaveDataLocal lendo Date vindo do banco.
      jest.useFakeTimers().setSystemTime(new Date(2026, 7, 20))
      try {
        const dataBancoUTC = new Date(Date.UTC(2026, 7, 11))
        const { service } = criarService({
          perfis: [{ usuarioId: 'u1', ...PERFIL_BASE }],
          registros: [{
            usuarioId: 'u1',
            data: dataBancoUTC,
            horaEntrada: combinarDataHora('2026-08-11', '08:00'),
            horaSaida: combinarDataHora('2026-08-11', '14:00')
          }]
        })
        const solicitante: any = { id: 'u1', role: 'funcionario' }

        const resultado = await service.resumoMes('u1', '2026-08', solicitante)

        const dia11 = resultado.dias.find(d => d.data === '2026-08-11')
        expect(dia11?.horasNormais).toBe(6)
        expect(dia11?.falta).toBe(false)
      } finally {
        jest.useRealTimers()
      }
    })

    it('dia de escala sem ponto mas com justificativa aparece coberto, não como falta', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 7, 20))
      try {
        const { service } = criarService({
          perfis: [{ usuarioId: 'u1', ...PERFIL_BASE }],
          justificativas: [{ usuarioId: 'u1', data: new Date(Date.UTC(2026, 7, 11)), tipo: 'atestado' }]
        })
        const solicitante: any = { id: 'u1', role: 'funcionario' }

        const resultado = await service.resumoMes('u1', '2026-08', solicitante)

        const dia11 = resultado.dias.find(d => d.data === '2026-08-11')
        expect(dia11?.falta).toBe(false)
        expect(dia11?.justificativa).toBe('atestado')
      } finally {
        jest.useRealTimers()
      }
    })

    it('dia de escala dentro de um período de férias aprovado aparece coberto, não como falta', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 7, 20))
      try {
        const { service } = criarService({
          perfis: [{ usuarioId: 'u1', ...PERFIL_BASE }],
          ferias: [{
            usuarioId: 'u1',
            status: 'aprovada',
            dataInicio: new Date(Date.UTC(2026, 7, 10)),
            dataFim: new Date(Date.UTC(2026, 7, 14))
          }]
        })
        const solicitante: any = { id: 'u1', role: 'funcionario' }

        const resultado = await service.resumoMes('u1', '2026-08', solicitante)

        // 10 a 14/ago (seg a sex) cobre vários dias de escala (diasEscala=
        // [2,3,4,5] = ter-sex): nenhum deles pode virar falta — checa 11 e
        // 12 como amostra.
        const dia11 = resultado.dias.find(d => d.data === '2026-08-11')
        const dia12 = resultado.dias.find(d => d.data === '2026-08-12')
        expect(dia11?.falta).toBe(false)
        expect(dia11?.ferias).toBe(true)
        expect(dia12?.falta).toBe(false)
        expect(dia12?.ferias).toBe(true)
      } finally {
        jest.useRealTimers()
      }
    })

    it('não calcula dias futuros do mês corrente', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 7, 10)) // 10/ago/2026
      try {
        const { service } = criarService({ perfis: [{ usuarioId: 'u1', ...PERFIL_BASE }] })
        const solicitante: any = { id: 'u1', role: 'funcionario' }
        const resultado = await service.resumoMes('u1', '2026-08', solicitante)
        expect(resultado.dias).toHaveLength(10)
        expect(resultado.dias[resultado.dias.length - 1].data).toBe('2026-08-10')
      } finally {
        jest.useRealTimers()
      }
    })
  })
})
