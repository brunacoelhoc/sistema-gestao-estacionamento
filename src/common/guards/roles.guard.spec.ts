import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { RolesGuard } from './roles.guard'

function contextoCom (usuario: any): ExecutionContext {
  const request: any = { usuario }
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({})
  } as ExecutionContext
}

function reflectorRetornando (papeis: string[] | undefined): Reflector {
  return { getAllAndOverride: () => papeis } as unknown as Reflector
}

describe('RolesGuard', () => {
  it('libera quando a rota não declara @Roles()', () => {
    const guard = new RolesGuard(reflectorRetornando(undefined))
    expect(guard.canActivate(contextoCom({ role: 'funcionario' }))).toBe(true)
  })

  it('libera quando o papel do usuário está na lista permitida', () => {
    const guard = new RolesGuard(reflectorRetornando(['admin', 'rh']))
    expect(guard.canActivate(contextoCom({ role: 'rh' }))).toBe(true)
  })

  it('bloqueia quando o papel do usuário não está na lista permitida', () => {
    const guard = new RolesGuard(reflectorRetornando(['admin', 'rh']))
    expect(() => guard.canActivate(contextoCom({ role: 'funcionario' }))).toThrow(ForbiddenException)
  })

  it('bloqueia quando não há usuário autenticado na requisição', () => {
    const guard = new RolesGuard(reflectorRetornando(['admin']))
    expect(() => guard.canActivate(contextoCom(undefined))).toThrow(ForbiddenException)
  })
})
