import { DURACAO_CICLO_DIAS, MensalidadeCicloService } from './mensalidade-ciclo.service'

// Prisma real não entra no escopo de testes unitários — este fake replica só
// o que o service usa de tx.mensalidade (findFirst/create) num array em
// memória.
function criarTxFake (): any {
  const registros: any[] = []
  let proximoId = 1

  return {
    registros,
    mensalidade: {
      async findFirst ({ where: { mensalistaId, dataFim } }: any) {
        const candidatos = registros
          .filter(r => r.mensalistaId === mensalistaId && r.dataFim >= dataFim.gte)
          .sort((a, b) => b.dataInicio - a.dataInicio)
        return candidatos[0] || null
      },
      async create ({ data }: any) {
        const registro = { id: String(proximoId++), ...data }
        registros.push(registro)
        return { ...registro }
      }
    }
  }
}

describe('MensalidadeCicloService', () => {
  const service = new MensalidadeCicloService()

  it('referenciaDe formata como YYYY-MM com mês em 2 dígitos', () => {
    expect(service.referenciaDe(new Date(2026, 0, 15))).toBe('2026-01')
    expect(service.referenciaDe(new Date(2026, 10, 1))).toBe('2026-11')
  })

  it('calcularFimCiclo soma 30 dias corridos à data de início', () => {
    const inicio = new Date(2026, 7, 5) // 5 de agosto
    const fim = service.calcularFimCiclo(inicio)
    expect(fim.getTime()).toBe(new Date(2026, 8, 4).getTime()) // 4 de setembro
  })

  it('abrirNovoCiclo cria um ciclo já pago, cobrindo 30 dias a partir da entrada', async () => {
    const tx = criarTxFake()
    const mensalista: any = { id: 'm1', valorMensalidade: 300 }
    const dataEntrada = new Date(2026, 7, 5)

    const ciclo: any = await service.abrirNovoCiclo(tx, mensalista, dataEntrada, 'pix')

    expect(ciclo.status).toBe('paga')
    expect(ciclo.formaPagamento).toBe('pix')
    expect(ciclo.valor).toBe(300)
    expect(ciclo.diasCobrados).toBe(DURACAO_CICLO_DIAS)
    expect(ciclo.dataInicio).toBe(dataEntrada)
    expect(ciclo.dataFim.getTime()).toBe(service.calcularFimCiclo(dataEntrada).getTime())
  })

  it('buscarCicloVigente encontra o ciclo que ainda cobre a data informada', async () => {
    const tx = criarTxFake()
    const mensalista: any = { id: 'm1', valorMensalidade: 300 }

    await service.abrirNovoCiclo(tx, mensalista, new Date(2026, 7, 1), 'pix')

    const dentroDoCiclo = await service.buscarCicloVigente(tx, 'm1', new Date(2026, 7, 20))
    expect(dentroDoCiclo).toBeTruthy()

    const depoisDoCiclo = await service.buscarCicloVigente(tx, 'm1', new Date(2026, 8, 5)) // 31+ dias depois
    expect(depoisDoCiclo).toBeNull()
  })

  it('buscarCicloVigente retorna null para mensalista sem nenhum ciclo', async () => {
    const tx = criarTxFake()
    const resultado = await service.buscarCicloVigente(tx, 'sem-ciclo', new Date(2026, 7, 20))
    expect(resultado).toBeNull()
  })

  it('um segundo ciclo aberto depois do vencimento do primeiro passa a ser o vigente', async () => {
    const tx = criarTxFake()
    const mensalista: any = { id: 'm1', valorMensalidade: 300 }

    await service.abrirNovoCiclo(tx, mensalista, new Date(2026, 7, 1), 'pix')
    const segundo: any = await service.abrirNovoCiclo(tx, mensalista, new Date(2026, 9, 15), 'dinheiro')

    const vigente: any = await service.buscarCicloVigente(tx, 'm1', new Date(2026, 9, 20))
    expect(vigente.id).toBe(segundo.id)
  })
})
