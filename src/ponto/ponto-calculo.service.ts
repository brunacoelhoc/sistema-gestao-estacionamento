import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { PerfilRH, RegistroPonto, TipoJustificativaPonto } from '../../generated/prisma'
import type { UsuarioAutenticado } from '../common/guards/jwt-auth.guard'
import { ehGestaoDeRh } from '../common/utils/papel.util'
import { PrismaService } from '../prisma/prisma.service'
import {
  arredondar2,
  chaveDataDoBanco,
  chaveDataLocal,
  combinarDataHora,
  dataSemHora,
  diferencaEmHoras,
  diferencaEmMinutos,
  parseDataLocal,
  TOLERANCIA_ATRASO_MINUTOS
} from './ponto-datas.util'

export interface DiaPontoResumo {
  data: string
  diaDaSemana: number
  ehDiaDeEscala: boolean
  horaEntrada: Date | null
  horaSaida: Date | null
  autorizacaoExtraAprovada: boolean
  justificativa: TipoJustificativaPonto | null
  ferias: boolean
  horasNormais: number
  horasExtras: number
  horasForaEscala: number
  falta: boolean
  emAberto: boolean
}

export interface ResumoMesPonto {
  referencia: string
  dias: DiaPontoResumo[]
  totais: { horasNormais: number, horasExtras: number, horasForaEscala: number, faltas: number }
}

// Cruza PerfilRH.diasEscala + RegistroPonto + SolicitacaoTrabalhoExtra
// aprovadas + JustificativaPonto num resumo dia a dia do mês — reaproveitado
// tanto pelo espelho de ponto quanto pela folha de pagamento (ver plano),
// pra não duplicar a lógica de tolerância/falta em dois lugares. Férias
// (Fase 7) ainda vão entrar aqui, tratando o dia como coberto/pago.
@Injectable()
export class PontoCalculoService {
  constructor (private readonly prisma: PrismaService) {}

  async resumoMes (usuarioId: string, referencia: string, solicitante: UsuarioAutenticado): Promise<ResumoMesPonto> {
    if (!ehGestaoDeRh(solicitante.role) && solicitante.id !== usuarioId) {
      throw new ForbiddenException('Você só pode ver o seu próprio resumo de ponto.')
    }

    const perfil = await this.prisma.perfilRH.findUnique({ where: { usuarioId } })
    if (!perfil) {
      throw new NotFoundException('Funcionário sem perfil de RH cadastrado.')
    }

    const [ano, mes] = referencia.split('-').map(Number)
    const inicioMes = new Date(ano, mes - 1, 1)
    const fimMes = new Date(ano, mes, 0)
    const hoje = dataSemHora(new Date())
    const ultimoDiaCalculado = fimMes < hoje ? fimMes : hoje

    const [registros, autorizacoes, justificativas, feriasAprovadas] = await Promise.all([
      this.prisma.registroPonto.findMany({ where: { usuarioId, data: { gte: inicioMes, lte: fimMes } } }),
      this.prisma.solicitacaoTrabalhoExtra.findMany({
        where: { usuarioId, status: 'aprovada', data: { gte: inicioMes, lte: fimMes } }
      }),
      this.prisma.justificativaPonto.findMany({ where: { usuarioId, data: { gte: inicioMes, lte: fimMes } } }),
      this.prisma.solicitacaoFerias.findMany({
        where: { usuarioId, status: 'aprovada', dataInicio: { lte: fimMes }, dataFim: { gte: inicioMes } }
      })
    ])

    // registros/autorizacoes/justificativas vêm do banco (Date em meia-noite
    // UTC) — usar chaveDataDoBanco aqui, nunca chaveDataLocal (ver comentário
    // do util).
    const registrosPorData = new Map(registros.map(r => [chaveDataDoBanco(r.data), r]))
    const autorizacoesPorData = new Set(autorizacoes.map(a => chaveDataDoBanco(a.data)))
    const justificativasPorData = new Map(justificativas.map(j => [chaveDataDoBanco(j.data), j.tipo]))

    // Expande cada período de férias aprovado em datas individuais — mais
    // simples de casar com o loop de dias abaixo do que comparar intervalos
    // a cada iteração.
    const diasDeFerias = new Set<string>()
    for (const feria of feriasAprovadas) {
      const inicio = chaveDataDoBanco(feria.dataInicio)
      const fim = chaveDataDoBanco(feria.dataFim)
      for (
        let d = parseDataLocal(inicio);
        chaveDataLocal(d) <= fim;
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      ) {
        diasDeFerias.add(chaveDataLocal(d))
      }
    }

    const dias: DiaPontoResumo[] = []
    for (
      let dia = new Date(inicioMes);
      dia <= ultimoDiaCalculado;
      dia = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1)
    ) {
      const chave = chaveDataLocal(dia)
      dias.push(this.calcularDia({
        chave,
        diaDaSemana: dia.getDay(),
        registro: registrosPorData.get(chave) ?? null,
        autorizacaoAprovada: autorizacoesPorData.has(chave),
        justificativa: justificativasPorData.get(chave) ?? null,
        emFerias: diasDeFerias.has(chave),
        perfil
      }))
    }

    const totais = dias.reduce((acc, d) => ({
      horasNormais: arredondar2(acc.horasNormais + d.horasNormais),
      horasExtras: arredondar2(acc.horasExtras + d.horasExtras),
      horasForaEscala: arredondar2(acc.horasForaEscala + d.horasForaEscala),
      faltas: acc.faltas + (d.falta ? 1 : 0)
    }), { horasNormais: 0, horasExtras: 0, horasForaEscala: 0, faltas: 0 })

    return { referencia, dias, totais }
  }

  private calcularDia (params: {
    chave: string
    diaDaSemana: number
    registro: RegistroPonto | null
    autorizacaoAprovada: boolean
    justificativa: TipoJustificativaPonto | null
    emFerias: boolean
    perfil: PerfilRH
  }): DiaPontoResumo {
    const { chave, diaDaSemana, registro, autorizacaoAprovada, justificativa, emFerias, perfil } = params
    const ehDiaDeEscala = perfil.diasEscala.includes(diaDaSemana)

    const base: DiaPontoResumo = {
      data: chave,
      diaDaSemana,
      ehDiaDeEscala,
      horaEntrada: registro?.horaEntrada ?? null,
      horaSaida: registro?.horaSaida ?? null,
      autorizacaoExtraAprovada: autorizacaoAprovada,
      justificativa,
      ferias: emFerias,
      horasNormais: 0,
      horasExtras: 0,
      horasForaEscala: 0,
      falta: false,
      emAberto: false
    }

    if (ehDiaDeEscala) {
      if (!registro?.horaEntrada) {
        // Atestado, abono, folga ou férias aprovadas cobrem a ausência: dia
        // pago, sem falta — ver requisito "não desconte a não ser que seja
        // obrigatório" e "folga que deverá ser paga caso solicite em dias de
        // trabalho".
        base.falta = !justificativa && !emFerias
        return base
      }
      if (!registro.horaSaida) {
        base.emAberto = true
        return base
      }

      const previsto = combinarDataHora(chave, perfil.horaInicioEscala)
      const atrasoMinutos = Math.max(0, diferencaEmMinutos(registro.horaEntrada, previsto))
      // Dentro da tolerância: o atraso não é descontado (considera como se
      // tivesse cumprido a carga a partir do horário previsto). Acima da
      // tolerância: o tempo perdido não é pago, mas não vira falta — ele
      // trabalhou parte do dia.
      const inicioConsiderado = atrasoMinutos <= TOLERANCIA_ATRASO_MINUTOS ? previsto : registro.horaEntrada

      const horasBrutas = diferencaEmHoras(registro.horaSaida, inicioConsiderado)
      base.horasNormais = arredondar2(Math.min(horasBrutas, perfil.horasPorDia))
      base.horasExtras = arredondar2(Math.max(0, horasBrutas - perfil.horasPorDia))
      return base
    }

    // Fora da escala: só conta (e só é permitido bater ponto, ver
    // PontoService.registrarEntrada) com autorização aprovada. Sem
    // autorização não é falta — o dia simplesmente não era esperado.
    if (!registro?.horaEntrada || !autorizacaoAprovada) {
      return base
    }
    if (!registro.horaSaida) {
      base.emAberto = true
      return base
    }

    base.horasForaEscala = arredondar2(diferencaEmHoras(registro.horaSaida, registro.horaEntrada))
    return base
  }
}
