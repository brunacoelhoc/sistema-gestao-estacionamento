import { AuditoriaService } from './auditoria.service'

function criarPrismaFake () {
  const registros: any[] = []
  let proximoId = 1

  return {
    registros,
    logAuditoria: {
      async create ({ data }: any) {
        const registro = { id: String(proximoId++), criadoEm: new Date(), ...data }
        registros.push(registro)
        return registro
      },
      async findMany ({ where }: any = {}) {
        // Mais recente primeiro: como o fake não tem uma coluna de auto-
        // incremento pra desempatar Date()s no mesmo milissegundo, inverte a
        // ordem de inserção (que já é cronológica) em vez de comparar
        // timestamps.
        return [...registros]
          .reverse()
          .filter(r =>
            (!where?.entidade || r.entidade === where.entidade) &&
            (!where?.entidadeId || r.entidadeId === where.entidadeId) &&
            (!where?.usuarioId || r.usuarioId === where.usuarioId)
          )
      }
    }
  }
}

function criarService () {
  const prismaFake = criarPrismaFake()
  const service = new AuditoriaService(prismaFake as any)
  return { service, prismaFake }
}

describe('AuditoriaService', () => {
  describe('registrar', () => {
    it('grava a ação com quem fez, papel no momento e dados antes/depois', async () => {
      const { service, prismaFake } = criarService()

      await service.registrar({
        usuarioId: 'rh1',
        papel: 'rh',
        acao: 'ponto.editar',
        entidade: 'RegistroPonto',
        entidadeId: 'ponto1',
        dadosAntes: { horaEntrada: '08:00' },
        dadosDepois: { horaEntrada: '08:20' }
      })

      expect(prismaFake.registros).toHaveLength(1)
      expect(prismaFake.registros[0]).toMatchObject({
        usuarioId: 'rh1',
        papel: 'rh',
        acao: 'ponto.editar',
        entidade: 'RegistroPonto',
        entidadeId: 'ponto1'
      })
    })
  })

  describe('listar', () => {
    it('filtra por entidade/entidadeId/usuarioId quando informados', async () => {
      const { service } = criarService()
      await service.registrar({ usuarioId: 'rh1', papel: 'rh', acao: 'a', entidade: 'X', entidadeId: '1' })
      await service.registrar({ usuarioId: 'rh2', papel: 'rh', acao: 'a', entidade: 'Y', entidadeId: '2' })

      const resultado = await service.listar({ entidade: 'X' })

      expect(resultado).toHaveLength(1)
      expect(resultado[0].entidade).toBe('X')
    })

    it('sem filtros devolve tudo, mais recente primeiro', async () => {
      const { service } = criarService()
      await service.registrar({ usuarioId: 'rh1', papel: 'rh', acao: 'a', entidade: 'X', entidadeId: '1' })
      await service.registrar({ usuarioId: 'rh1', papel: 'rh', acao: 'b', entidade: 'X', entidadeId: '2' })

      const resultado = await service.listar()

      expect(resultado).toHaveLength(2)
      expect(resultado[0].acao).toBe('b')
    })
  })
})
