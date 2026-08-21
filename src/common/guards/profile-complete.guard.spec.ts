import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { ProfileCompleteGuard } from './profile-complete.guard'

function contextoCom (usuario: any): ExecutionContext {
  const request: any = { usuario }
  return { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext
}

describe('ProfileCompleteGuard', () => {
  it('permite quando o usuário não tem cpfPendente', () => {
    const guard = new ProfileCompleteGuard()
    expect(guard.canActivate(contextoCom({ cpfPendente: false }))).toBe(true)
  })

  it('bloqueia com o código PERFIL_INCOMPLETO quando cpfPendente é true', () => {
    const guard = new ProfileCompleteGuard()
    try {
      guard.canActivate(contextoCom({ cpfPendente: true }))
      fail('deveria ter lançado ForbiddenException')
    } catch (erro) {
      expect(erro).toBeInstanceOf(ForbiddenException)
      const resposta = (erro as ForbiddenException).getResponse() as Record<string, unknown>
      expect(resposta.codigo).toBe('PERFIL_INCOMPLETO')
    }
  })
})
