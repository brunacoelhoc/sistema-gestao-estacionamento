import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { ROLES_KEY } from '../decorators/roles.decorator'
import type { UsuarioAutenticado } from './jwt-auth.guard'

// Guard genérico por lista de papéis, para rotas que várias combinações de
// papel podem acessar (ex.: admin + rh). Diferente do AdminGuard (fixo em
// 'admin', usado por mensalistas/usuarios/metricas): sem @Roles() na rota,
// este guard libera qualquer usuário autenticado — a restrição é opt-in.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor (private readonly reflector: Reflector) {}

  canActivate (context: ExecutionContext): boolean {
    const papeisPermitidos = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ])

    if (!papeisPermitidos || papeisPermitidos.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request & { usuario?: UsuarioAutenticado }>()
    if (!papeisPermitidos.includes(request.usuario?.role || '')) {
      throw new ForbiddenException('Acesso restrito.')
    }
    return true
  }
}
