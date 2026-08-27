import { ConflictException, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma'
import { MensalistasService } from './mensalistas.service'

function erroConflitoUnico (campo: string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: [campo] }
  })
}

function erroRestricaoFk () {
  return new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
    code: 'P2003',
    clientVersion: 'test'
  })
}

function erroRestricaoFkDriverAdapter () {
  // Formato real observado com @prisma/adapter-pg (ver comentário em
  // MensalistasService.remover): o código do Postgres vem embrulhado em
  // meta.driverAdapterError.cause.originalCode, não em erro.code.
  return new Prisma.PrismaClientKnownRequestError('Restrict violation', {
    code: 'P2010',
    clientVersion: 'test',
    meta: { driverAdapterError: { cause: { originalCode: '23001' } } }
  })
}

function criarPrismaFake (seed: { mensalistas?: any[] } = {}) {
  const mensalistas = seed.mensalistas ?? []
  let proximoId = mensalistas.length + 1

  return {
    mensalistas,
    mensalista: {
      async findMany () { return mensalistas },
      async findUnique ({ where: { id } }: any) { return mensalistas.find(m => m.id === id) ?? null },
      async findFirst ({ where }: any) {
        return mensalistas.find(m =>
          (where.cpf === undefined || m.cpf === where.cpf) &&
          (where.placa === undefined || m.placa === where.placa) &&
          (where.ativo === undefined || m.ativo === where.ativo) &&
          (!where.id?.not || m.id !== where.id.not)
        ) ?? null
      },
      async create ({ data }: any) {
        if (mensalistas.some(m => m.cpf === data.cpf)) throw erroConflitoUnico('cpf')
        if (mensalistas.some(m => m.placa === data.placa)) throw erroConflitoUnico('placa')
        const mensalista = { id: String(proximoId++), ativo: true, ...data }
        mensalistas.push(mensalista)
        return mensalista
      },
      async update ({ where: { id }, data }: any) {
        const mensalista = mensalistas.find(m => m.id === id)
        if (data.cpf && mensalistas.some(m => m.id !== id && m.cpf === data.cpf)) throw erroConflitoUnico('cpf')
        if (data.placa && mensalistas.some(m => m.id !== id && m.placa === data.placa)) throw erroConflitoUnico('placa')
        Object.assign(mensalista, data)
        return mensalista
      },
      async delete ({ where: { id } }: any) {
        const mensalista = mensalistas.find(m => m.id === id)
        if (mensalista?.temHistorico) throw erroRestricaoFk()
        if (mensalista?.temTicket) throw erroRestricaoFkDriverAdapter()
        const indice = mensalistas.findIndex(m => m.id === id)
        if (indice === -1) throw new Error('não encontrado')
        mensalistas.splice(indice, 1)
      }
    }
  }
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  const prismaFake = criarPrismaFake(seed)
  const service = new MensalistasService(prismaFake as any)
  return { service, prismaFake }
}

const ADMIN = { id: 'u-admin', role: 'admin', nome: 'Admin', cpfPendente: false }
const FUNCIONARIO = { id: 'u-func', role: 'funcionario', nome: 'Funcionário', cpfPendente: false }

describe('MensalistasService', () => {
  describe('listarTodos', () => {
    it('mascara o CPF na listagem', async () => {
      const { service } = criarService({ mensalistas: [{ id: 'm1', cpf: '11122233344', nome: 'Fulano' }] })
      const [mensalista] = await service.listarTodos()
      expect(mensalista.cpf).not.toBe('11122233344')
      expect(mensalista.cpf).toContain('**')
    })
  })

  describe('existeCpfDuplicado', () => {
    it('retorna true quando já existe', async () => {
      const { service } = criarService({ mensalistas: [{ id: 'm1', cpf: '111' }] })
      expect(await service.existeCpfDuplicado('111')).toBe(true)
    })

    it('ignora o próprio registro ao excluir por id', async () => {
      const { service } = criarService({ mensalistas: [{ id: 'm1', cpf: '111' }] })
      expect(await service.existeCpfDuplicado('111', 'm1')).toBe(false)
    })
  })

  describe('buscarAtivoPorPlaca', () => {
    it('encontra um mensalista ativo pela placa', async () => {
      const { service } = criarService({ mensalistas: [{ id: 'm1', placa: 'ABC1234', ativo: true }] })
      const encontrado: any = await service.buscarAtivoPorPlaca('ABC1234')
      expect(encontrado.id).toBe('m1')
    })

    it('não encontra mensalista inativo', async () => {
      const { service } = criarService({ mensalistas: [{ id: 'm1', placa: 'ABC1234', ativo: false }] })
      expect(await service.buscarAtivoPorPlaca('ABC1234')).toBeNull()
    })
  })

  describe('criar', () => {
    it('cria com os valores padrão (categoriaPlano e ativo)', async () => {
      const { service } = criarService()
      const mensalista: any = await service.criar({
        nome: 'Fulano', cpf: '111.111.111-11', placa: 'ABC1234', telefone: '11999999999'
      } as any)
      expect(mensalista.categoriaPlano).toBe('Mensal Integral')
      expect(mensalista.ativo).toBe(true)
      expect(mensalista.valorMensalidade).toBe(0)
    })

    it('recusa CPF duplicado com mensagem específica', async () => {
      const { service } = criarService({ mensalistas: [{ id: 'm1', cpf: '111', placa: 'AAA0000' }] })
      await expect(service.criar({ nome: 'X', cpf: '111', placa: 'BBB1111', telefone: '119' } as any))
        .rejects.toThrow('CPF')
    })

    it('recusa placa duplicada com mensagem específica', async () => {
      const { service } = criarService({ mensalistas: [{ id: 'm1', cpf: '111', placa: 'AAA0000' }] })
      await expect(service.criar({ nome: 'X', cpf: '222', placa: 'AAA0000', telefone: '119' } as any))
        .rejects.toThrow('placa')
    })
  })

  describe('atualizar', () => {
    it('recusa quando o mensalista não existe', async () => {
      const { service } = criarService({ mensalistas: [] })
      await expect(service.atualizar('inexistente', { nome: 'X' } as any, ADMIN)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('atualiza só os campos enviados', async () => {
      const { service, prismaFake } = criarService({
        mensalistas: [{ id: 'm1', nome: 'Antigo', telefone: '111', ativo: true }]
      })
      await service.atualizar('m1', { nome: 'Novo Nome' } as any, ADMIN)
      expect(prismaFake.mensalistas[0].nome).toBe('Novo Nome')
      expect(prismaFake.mensalistas[0].telefone).toBe('111') // não mexeu
    })

    it('mapeia conflito de CPF/placa duplicado pra ConflictException', async () => {
      const { service } = criarService({
        mensalistas: [{ id: 'm1', cpf: '111', placa: 'AAA0000' }, { id: 'm2', cpf: '222', placa: 'BBB1111' }]
      })
      await expect(service.atualizar('m2', { cpf: '111' } as any, ADMIN)).rejects.toBeInstanceOf(ConflictException)
    })

    it('admin pode alterar o CPF', async () => {
      const { service, prismaFake } = criarService({
        mensalistas: [{ id: 'm1', cpf: '111', nome: 'Fulano' }]
      })
      await service.atualizar('m1', { cpf: '999' } as any, ADMIN)
      expect(prismaFake.mensalistas[0].cpf).toBe('999')
    })

    it('não-admin não consegue alterar o CPF (ignorado silenciosamente)', async () => {
      const { service, prismaFake } = criarService({
        mensalistas: [{ id: 'm1', cpf: '111', nome: 'Fulano' }]
      })
      await service.atualizar('m1', { cpf: '999', nome: 'Novo Nome' } as any, FUNCIONARIO)
      expect(prismaFake.mensalistas[0].cpf).toBe('111') // não mudou
      expect(prismaFake.mensalistas[0].nome).toBe('Novo Nome') // resto atualiza normal
    })

    it('admin pode alterar o valor da mensalidade', async () => {
      const { service, prismaFake } = criarService({
        mensalistas: [{ id: 'm1', valorMensalidade: 180 }]
      })
      await service.atualizar('m1', { valorMensalidade: 250 } as any, ADMIN)
      expect(prismaFake.mensalistas[0].valorMensalidade).toBe(250)
    })

    it('não-admin não consegue alterar o valor da mensalidade (ignorado silenciosamente)', async () => {
      const { service, prismaFake } = criarService({
        mensalistas: [{ id: 'm1', valorMensalidade: 180, nome: 'Fulano' }]
      })
      await service.atualizar('m1', { valorMensalidade: 250, nome: 'Novo Nome' } as any, FUNCIONARIO)
      expect(prismaFake.mensalistas[0].valorMensalidade).toBe(180) // não mudou
      expect(prismaFake.mensalistas[0].nome).toBe('Novo Nome') // resto atualiza normal
    })
  })

  describe('buscarPorId', () => {
    it('devolve o CPF completo para admin', async () => {
      const { service } = criarService({ mensalistas: [{ id: 'm1', cpf: '11122233344' }] })
      const mensalista: any = await service.buscarPorId('m1', ADMIN)
      expect(mensalista.cpf).toBe('11122233344')
    })

    it('mascara o CPF para não-admin', async () => {
      const { service } = criarService({ mensalistas: [{ id: 'm1', cpf: '11122233344' }] })
      const mensalista: any = await service.buscarPorId('m1', FUNCIONARIO)
      expect(mensalista.cpf).not.toBe('11122233344')
      expect(mensalista.cpf).toContain('**')
    })

    it('retorna null quando não encontra, sem quebrar por causa do role', async () => {
      const { service } = criarService({ mensalistas: [] })
      expect(await service.buscarPorId('inexistente', FUNCIONARIO)).toBeNull()
    })
  })

  describe('remover', () => {
    it('remove quando não há histórico vinculado', async () => {
      const { service, prismaFake } = criarService({ mensalistas: [{ id: 'm1' }] })
      await service.remover('m1')
      expect(prismaFake.mensalistas).toHaveLength(0)
    })

    it('recusa remover mensalista com histórico de cobrança (violação de FK padrão)', async () => {
      const { service } = criarService({ mensalistas: [{ id: 'm1', temHistorico: true }] })
      await expect(service.remover('m1')).rejects.toBeInstanceOf(ConflictException)
    })

    it('recusa remover mensalista com histórico (erro embrulhado do driver adapter Postgres)', async () => {
      const { service } = criarService({ mensalistas: [{ id: 'm1', temTicket: true }] })
      await expect(service.remover('m1')).rejects.toBeInstanceOf(ConflictException)
    })
  })
})
