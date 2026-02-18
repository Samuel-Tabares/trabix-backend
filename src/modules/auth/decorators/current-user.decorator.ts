import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Rol } from '@prisma/client';

/**
 * Tipo del usuario autenticado disponible en request.user
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  rol: Rol;
  nombre: string;
  apellidos: string;
  requiereCambioPassword: boolean;
  jti: string; // Token ID
}

/**
 * Decorador para obtener el usuario autenticado actual
 *
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user;
 * }
 *
 * @example
 * @Get('my-id')
 * getMyId(@CurrentUser('id') userId: string) {
 *   return userId;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
