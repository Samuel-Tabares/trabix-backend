import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './services/auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LogoutDto } from './dto/logout.dto';
import { AuthResponseDto, MessageResponseDto } from './dto/auth-response.dto';
import { ResetPasswordResponseDto } from './dto/reset-password.dto';

import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { LoginThrottleGuard } from './guards/login-throttle.guard';

/**
 * Controlador de autenticación
 *
 * Endpoints públicos:
 * - POST /auth/login   - Iniciar sesión
 * - POST /auth/refresh - Renovar access token
 * - POST /auth/logout  - Cerrar sesión (funciona con token expirado)
 *
 * Endpoints autenticados:
 * - POST /auth/cambiar-password - Cambiar contraseña propia
 *
 * Endpoints admin:
 * - POST /auth/admin/reset-password/:usuarioId  - Resetear contraseña de usuario
 * - POST /auth/admin/desbloquear/:usuarioId     - Desbloquear usuario bloqueado
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ==================== ENDPOINTS PÚBLICOS ====================

  /**
   * POST /auth/login
   * Inicia sesión con cédula y contraseña
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @SkipThrottle({ default: true })
  @UseGuards(LoginThrottleGuard)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Autentica al usuario con cédula y contraseña. ' +
      'Implementa bloqueo progresivo por intentos fallidos.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({
    status: 403,
    description: 'Usuario bloqueado, inactivo o requiere desbloqueo por admin',
  })
  @ApiResponse({ status: 429, description: 'Demasiados intentos. Intente más tarde.' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  /**
   * POST /auth/refresh
   * Renueva el access token usando el refresh token
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renovar access token',
    description:
      'Obtiene un nuevo par de tokens usando el refresh token. ' +
      'El refresh token anterior queda invalidado.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Tokens renovados exitosamente',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  /**
   * POST /auth/logout
   * Cierra la sesión del usuario (invalida tokens)
   *
   * Este endpoint es PÚBLICO para permitir logout incluso con token expirado.
   * Se requiere el refreshToken para identificar la sesión a invalidar.
   */
  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar sesión',
    description:
      'Invalida los tokens del usuario. ' +
      'Requiere el refresh token para identificar la sesión. ' +
      'Funciona incluso si el access token ya expiró.',
  })
  @ApiBody({ type: LogoutDto })
  @ApiResponse({
    status: 200,
    description: 'Sesión cerrada exitosamente',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Refresh token inválido' })
  async logout(@Body() logoutDto: LogoutDto): Promise<MessageResponseDto> {
    await this.authService.logout(logoutDto.refreshToken, logoutDto.accessToken);
    return { message: 'Sesión cerrada exitosamente' };
  }

  // ==================== ENDPOINTS AUTENTICADOS ====================

  /**
   * POST /auth/cambiar-password
   * Cambia la contraseña del usuario autenticado
   */
  @Post('cambiar-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Cambiar contraseña',
    description:
      'Cambia la contraseña del usuario autenticado. ' +
      'Requiere la contraseña actual. ' +
      'Invalida todas las sesiones existentes.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Contraseña cambiada exitosamente',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Contraseña actual incorrecta o nueva igual a la actual',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<MessageResponseDto> {
    await this.authService.changePassword(user.id, changePasswordDto);
    return {
      message: 'Contraseña cambiada exitosamente. Por seguridad, inicie sesión nuevamente.',
    };
  }

  // ==================== ENDPOINTS ADMIN ====================

  /**
   * POST /auth/admin/reset-password/:usuarioId
   * Resetea la contraseña de un usuario (solo admin)
   */
  @Post('admin/reset-password/:usuarioId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Resetear contraseña de usuario (Admin)',
    description:
      'Genera una contraseña temporal para el usuario especificado. ' +
      'El usuario deberá cambiarla en su próximo inicio de sesión. ' +
      'También desbloquea al usuario si estaba bloqueado.',
  })
  @ApiParam({
    name: 'usuarioId',
    description: 'ID del usuario al que se le reseteará la contraseña',
  })
  @ApiResponse({
    status: 200,
    description: 'Contraseña reseteada exitosamente',
    type: ResetPasswordResponseDto,
  })
  @ApiResponse({ status: 403, description: 'No se puede resetear la contraseña de otro admin' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async resetPassword(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<ResetPasswordResponseDto> {
    return this.authService.resetPassword(usuarioId, admin.id);
  }

  /**
   * POST /auth/admin/desbloquear/:usuarioId
   * Desbloquea un usuario que fue bloqueado por muchos intentos fallidos
   */
  @Post('admin/desbloquear/:usuarioId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Desbloquear usuario (Admin)',
    description:
      'Desbloquea un usuario que fue bloqueado por exceder el límite de intentos fallidos de login. ' +
      'Resetea el contador de intentos fallidos.',
  })
  @ApiParam({
    name: 'usuarioId',
    description: 'ID del usuario a desbloquear',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario desbloqueado exitosamente',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async desbloquearUsuario(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    await this.authService.desbloquearUsuario(usuarioId, admin.id);
    return { message: 'Usuario desbloqueado exitosamente' };
  }
}
