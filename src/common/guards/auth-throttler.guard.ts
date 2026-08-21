import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

/**
 * Limita tentativas de login/cadastro/reset por IP para dificultar força
 * bruta de senha/CPF — ver AuthController.
 *
 * Simplificação consciente em relação ao authLimiter original
 * (express-rate-limit com skipSuccessfulRequests: true): o ThrottlerGuard
 * do Nest conta toda requisição no momento do guard, antes do handler rodar,
 * então não há como saber ainda se a tentativa vai falhar ou não — não dá
 * pra "não contar" só as bem-sucedidas sem uma camada extra de storage
 * customizada. Optamos por contar todas as tentativas (inclusive logins
 * certos) em vez de replicar esse comportamento com um mecanismo frágil de
 * incrementar/decrementar — mais simples e, se algo, mais conservador em
 * termos de segurança.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async getErrorMessage (): Promise<string> {
    return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'
  }
}
