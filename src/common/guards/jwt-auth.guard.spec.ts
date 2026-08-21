import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { JwtAuthGuard } from './jwt-auth.guard'

function contextoCom (headers: Record<string, string>): ExecutionContext {
  const request: any = { headers }
  return {
    switchToHttp: () => ({ getRequest: () => request })
  } as ExecutionContext
}

describe('JwtAuthGuard', () => {
  it('rejeita quando não há token no header Authorization', () => {
    const guard = new JwtAuthGuard({} as JwtService)
    expect(() => guard.canActivate(contextoCom({}))).toThrow(UnauthorizedException)
  })

  it('rejeita quando o token é inválido/expirado', () => {
    const jwtService = { verify: jest.fn(() => { throw new Error('inválido') }) } as unknown as JwtService
    const guard = new JwtAuthGuard(jwtService)
    expect(() => guard.canActivate(contextoCom({ authorization: 'Bearer token-invalido' }))).toThrow(UnauthorizedException)
  })

  it('permite e anexa req.usuario quando o token é válido', () => {
    const payload = { id: '1', role: 'admin', nome: 'Teste', cpfPendente: false }
    const jwtService = { verify: jest.fn(() => payload) } as unknown as JwtService
    const guard = new JwtAuthGuard(jwtService)
    const request: any = { headers: { authorization: 'Bearer token-valido' } }
    const contexto = { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext

    expect(guard.canActivate(contexto)).toBe(true)
    expect(request.usuario).toEqual(payload)
  })
})
