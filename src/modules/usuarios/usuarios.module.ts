import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { UsuariosController } from './controllers/usuarios.controller';

// Repository
import { PrismaUsuarioRepository } from './infrastructure/prisma-usuario.repository';
import { USUARIO_REPOSITORY } from './domain/usuario.repository.interface';

// Commands
import { UsuarioCommandHandlers } from './application/commands';

// Queries
import { UsuarioQueryHandlers } from './application/queries';

/**
 * Gestiona:
 * - Creación de vendedores (con promoción automática a RECLUTADOR)
 * - Listado y consulta de usuarios
 * - Cambio de estado (ACTIVO/INACTIVO)
 * - Eliminación (soft delete) y restauración
 * - Jerarquías de reclutamiento
 */
@Module({
  imports: [CqrsModule, ConfigModule],
  controllers: [UsuariosController],
  providers: [
    // Repository
    {
      provide: USUARIO_REPOSITORY,
      useClass: PrismaUsuarioRepository,
    },

    // Command Handlers
    ...UsuarioCommandHandlers,

    // Query Handlers
    ...UsuarioQueryHandlers,
  ],
  exports: [USUARIO_REPOSITORY],
})
export class UsuariosModule {}
