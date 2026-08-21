import { ExecutionContext, createParamDecorator } from '@nestjs/common'
import type { Request } from 'express'
import type { UsuarioAutenticado } from '../guards/jwt-auth.guard'

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const request = ctx.switchToHttp().getRequest<Request & { usuario: UsuarioAutenticado }>()
    return request.usuario
  }
)
