import { SetMetadata } from '@nestjs/common'

export const ROLES_KEY = 'roles'

// Uso: @UseGuards(JwtAuthGuard, RolesGuard) @Roles('admin', 'rh') numa rota
// que deve aceitar mais de um papel (ex.: telas de RH que admin também
// acompanha). Rotas sem este decorator passam livres pelo RolesGuard.
export const Roles = (...papeis: string[]) => SetMetadata(ROLES_KEY, papeis)
