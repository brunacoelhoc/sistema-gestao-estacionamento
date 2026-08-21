import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'

export interface UsuarioAutenticado {
  id: string
  role: string
  nome: string
  cpfPendente: boolean
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor (private readonly jwtService: JwtService) {}

  canActivate (context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { usuario?: UsuarioAutenticado }>()
    const [, token] = (request.headers.authorization || '').split(' ')

    if (!token) {
      throw new UnauthorizedException('Token de autenticação ausente.')
    }

    try {
      request.usuario = this.jwtService.verify<UsuarioAutenticado>(token, { secret: process.env.JWT_SECRET })
      return true
    } catch {
      throw new UnauthorizedException('Token de autenticação inválido ou expirado.')
    }
  }
}
