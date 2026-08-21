import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { minutes, ThrottlerModule } from '@nestjs/throttler'
import { AnalyticsModule } from './analytics/analytics.module'
import { AppController } from './app.controller'
import { AuthModule } from './auth/auth.module'
import { validate } from './config/env.validation'
import { MensalidadesModule } from './mensalidades/mensalidades.module'
import { MensalistasModule } from './mensalistas/mensalistas.module'
import { MetricasModule } from './metricas/metricas.module'
import { PrismaModule } from './prisma/prisma.module'
import { TarifasModule } from './tarifas/tarifas.module'
import { TicketsModule } from './tickets/tickets.module'
import { UsuariosModule } from './usuarios/usuarios.module'
import { VagasModule } from './vagas/vagas.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN', '8h') as any }
      })
    }),
    // Sem guard global: assim como no Express original, a maioria das rotas
    // não tem limite nenhum — o ThrottlerGuard só é aplicado explicitamente
    // nas rotas de auth e de analytics/eventos (ver seus controllers).
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: minutes(15), limit: 10 }] }),
    PrismaModule,
    TarifasModule,
    VagasModule,
    AuthModule,
    UsuariosModule,
    MensalistasModule,
    MensalidadesModule,
    TicketsModule,
    MetricasModule,
    AnalyticsModule
  ],
  controllers: [AppController]
})
export class AppModule {}
