import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { minutes, Throttle } from '@nestjs/throttler'
import { AuthThrottlerGuard } from '../common/guards/auth-throttler.guard'
import { AuthService } from './auth.service'
import { ConfirmarResetDto } from './dto/confirmar-reset.dto'
import { GoogleDto } from './dto/google.dto'
import { LoginDto } from './dto/login.dto'
import { RegistrarDto } from './dto/registrar.dto'
import { SolicitarResetDto } from './dto/solicitar-reset.dto'

@Controller('auth')
export class AuthController {
  constructor (private readonly authService: AuthService) {}

  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login (@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  @Post('registrar')
  @HttpCode(HttpStatus.CREATED)
  registrar (@Body() dto: RegistrarDto) {
    return this.authService.registrar(dto)
  }

  // Sem AuthThrottlerGuard: ao contrário de login/registrar/reset, não há
  // senha ou código pra tentar adivinhar por força bruta — a credencial é um
  // ID token assinado pelo Google, verificado com a chave pública dele (ver
  // AuthService.google), então não faz sentido limitar tentativas aqui.
  @Post('google')
  @HttpCode(HttpStatus.OK)
  google (@Body() dto: GoogleDto) {
    return this.authService.google(dto)
  }

  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  @Post('reset/solicitar')
  @HttpCode(HttpStatus.OK)
  solicitarReset (@Body() dto: SolicitarResetDto) {
    return this.authService.solicitarReset(dto)
  }

  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  @Post('reset/confirmar')
  @HttpCode(HttpStatus.OK)
  confirmarReset (@Body() dto: ConfirmarResetDto) {
    return this.authService.confirmarReset(dto)
  }
}
