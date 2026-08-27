import { ConflictException } from '@nestjs/common'
import { AssinaturaEletronicaService } from './assinatura-eletronica.service'

const IMAGEM_VALIDA = 'data:image/png;base64,aGVsbG8='

function criarPrismaFake (seed: { assinaturas?: any[] } = {}) {
  const assinaturas = seed.assinaturas ?? []

  return {
    assinaturas,
    assinaturaEletronica: {
      async findUnique ({ where: { usuarioId } }: any) {
        return assinaturas.find(a => a.usuarioId === usuarioId) ?? null
      },
      async create ({ data }: any) {
        const nova = { id: `assinatura-${assinaturas.length + 1}`, criadoEm: new Date(), ...data }
        assinaturas.push(nova)
        return nova
      }
    }
  }
}

function criarService (seed?: Parameters<typeof criarPrismaFake>[0]) {
  const prismaFake = criarPrismaFake(seed)
  const service = new AssinaturaEletronicaService(prismaFake as any)
  return { service, prismaFake }
}

describe('AssinaturaEletronicaService', () => {
  describe('buscarMinha', () => {
    it('devolve null quando ainda não cadastrou', async () => {
      const { service } = criarService()
      expect(await service.buscarMinha('u1')).toBeNull()
    })

    it('devolve a assinatura cadastrada', async () => {
      const { service } = criarService({ assinaturas: [{ usuarioId: 'u1', imagemDataUri: IMAGEM_VALIDA }] })
      const assinatura = await service.buscarMinha('u1')
      expect(assinatura?.imagemDataUri).toBe(IMAGEM_VALIDA)
    })
  })

  describe('cadastrar', () => {
    it('cadastra a assinatura na primeira vez', async () => {
      const { service, prismaFake } = criarService()
      const assinatura = await service.cadastrar('u1', { imagemDataUri: IMAGEM_VALIDA })
      expect(assinatura.usuarioId).toBe('u1')
      expect(prismaFake.assinaturas).toHaveLength(1)
    })

    it('recusa recadastro quando já existe assinatura', async () => {
      const { service } = criarService({ assinaturas: [{ usuarioId: 'u1', imagemDataUri: IMAGEM_VALIDA }] })
      await expect(service.cadastrar('u1', { imagemDataUri: IMAGEM_VALIDA }))
        .rejects.toBeInstanceOf(ConflictException)
    })
  })
})
