import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Parâmetro comum (não property-parameter): precisa estar disponível para
  // montar os args do super() antes de `this` existir.
  constructor (configService: ConfigService) {
    super({ adapter: new PrismaPg({ connectionString: configService.get<string>('DATABASE_URL') }) })
  }

  async onModuleInit () {
    await this.$connect()
  }

  async onModuleDestroy () {
    await this.$disconnect()
  }
}
