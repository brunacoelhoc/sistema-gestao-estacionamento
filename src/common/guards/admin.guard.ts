import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import type { UsuarioAutenticado } from './jwt-auth.guard'

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate (context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { usuario?: UsuarioAutenticado }>()
    if (request.usuario?.role !== 'admin') {
      throw new ForbiddenException('Acesso restrito a administradores.')
    }
    return true
  }
}
