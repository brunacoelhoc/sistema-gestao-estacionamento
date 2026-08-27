import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { minutes, ThrottlerModule } from '@nestjs/throttler'
import { AnalyticsModule } from './analytics/analytics.module'
import { AppController } from './app.controller'
import { AssinaturaEletronicaModule } from './assinatura-eletronica/assinatura-eletronica.module'
import { AuditoriaModule } from './auditoria/auditoria.module'
import { AuthModule } from './auth/auth.module'
import { CaixaModule } from './caixa/caixa.module'
import { validate } from './config/env.validation'
import { ContratoTrabalhoModule } from './contrato-trabalho/contrato-trabalho.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { DesempenhoModule } from './desempenho/desempenho.module'
import { EspelhoPontoModule } from './espelho-ponto/espelho-ponto.module'
import { EtapasCarreiraModule } from './etapas-carreira/etapas-carreira.module'
import { FeriasModule } from './ferias/ferias.module'
import { FolhaPagamentoModule } from './folha-pagamento/folha-pagamento.module'
import { MensalidadesModule } from './mensalidades/mensalidades.module'
import { MensalistasModule } from './mensalistas/mensalistas.module'
import { MetricasModule } from './metricas/metricas.module'
import { NotificacoesModule } from './notificacoes/notificacoes.module'
import { PdiModule } from './pdi/pdi.module'
import { PontoModule } from './ponto/ponto.module'
import { PrismaModule } from './prisma/prisma.module'
import { RhPerfilModule } from './rh-perfil/rh-perfil.module'
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
    CaixaModule,
    TicketsModule,
    MetricasModule,
    DashboardModule,
    AnalyticsModule,
    AuditoriaModule,
    RhPerfilModule,
    AssinaturaEletronicaModule,
    PontoModule,
    FeriasModule,
    NotificacoesModule,
    EspelhoPontoModule,
    ContratoTrabalhoModule,
    FolhaPagamentoModule,
    DesempenhoModule,
    EtapasCarreiraModule,
    PdiModule
  ],
  controllers: [AppController]
})
export class AppModule {}
