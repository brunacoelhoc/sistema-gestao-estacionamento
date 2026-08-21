import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import type { UsuarioAutenticado } from './jwt-auth.guard'

// Bloqueia rotas de negócio para contas criadas via Google que ainda não
// completaram o cadastro com um CPF válido (ver POST /usuarios/:id e
// views/completar-cadastro.html). `codigo` permite o front-end distinguir
// este 403 de um 403 genérico (ex.: AdminGuard) e redirecionar para a tela
// de conclusão de cadastro em vez de só mostrar um erro.
@Injectable()
export class ProfileCompleteGuard implements CanActivate {
  canActivate (context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { usuario?: UsuarioAutenticado }>()
    if (request.usuario?.cpfPendente) {
      throw new ForbiddenException({
        erro: 'Cadastro incompleto: informe seu CPF para continuar.',
        codigo: 'PERFIL_INCOMPLETO'
      })
    }
    return true
  }
}
