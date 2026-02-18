import { SetMetadata } from '@nestjs/common';
import { Rol } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorador para definir roles permitidos en un endpoint
 *
 * @example
 * @Roles(Rol.ADMIN)
 * @Get('admin-only')
 * adminOnly() { ... }
 *
 * @example
 * @Roles(Rol.ADMIN, Rol.RECLUTADOR)
 * @Get('admin-or-recruiter')
 * adminOrRecruiter() { ... }
 */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
