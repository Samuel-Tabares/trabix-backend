import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { AuthResponseDto, UserResponseDto } from '../dto/auth-response.dto';
import { ResetPasswordResponseDto } from '../dto/reset-password.dto';

import { Usuario, Rol } from '@prisma/client';

/**
 * Payload del Access Token
 */
export interface AccessTokenPayload {
  sub: string;
  rol: Rol;
  jti: string;
}

/**
 * Payload del Refresh Token
 */
export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
}

/**
 * Configuración de bloqueo progresivo
 */
interface LockoutConfig {
  minAttempts: number;
  maxAttempts: number;
  durationMinutes: number;
  requiresAdmin: boolean;
}

/**
 * Servicio de autenticación
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly LOCKOUT_LEVELS: LockoutConfig[];
  private readonly bcryptRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {
    this.bcryptRounds = this.configService.get<number>('security.bcryptRounds', 12);

    const level1Attempts = this.configService.get<number>('lockout.level1.attempts', 5);
    const level1Minutes = this.configService.get<number>('lockout.level1.durationMinutes', 15);

    const level2Attempts = this.configService.get<number>('lockout.level2.attempts', 10);
    const level2Minutes = this.configService.get<number>('lockout.level2.durationMinutes', 60);

    const level3Attempts = this.configService.get<number>('lockout.level3.attempts', 15);
    const level3Minutes = this.configService.get<number>('lockout.level3.durationMinutes', 1440);

    const permanentAttempts = this.configService.get<number>(
      'lockout.permanentLockoutAttempts',
      20,
    );

    this.LOCKOUT_LEVELS = [
      {
        minAttempts: level1Attempts,
        maxAttempts: level2Attempts - 1,
        durationMinutes: level1Minutes,
        requiresAdmin: false,
      },
      {
        minAttempts: level2Attempts,
        maxAttempts: level3Attempts - 1,
        durationMinutes: level2Minutes,
        requiresAdmin: false,
      },
      {
        minAttempts: level3Attempts,
        maxAttempts: permanentAttempts - 1,
        durationMinutes: level3Minutes,
        requiresAdmin: false,
      },
      {
        minAttempts: permanentAttempts,
        maxAttempts: Infinity,
        durationMinutes: 0,
        requiresAdmin: true,
      },
    ];
  }

  /**
   * LOGIN
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { cedula, password } = loginDto;

    if (!cedula || !password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!Number.isInteger(cedula) || cedula < 100000 || cedula > 2147483647) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const user = await this.prisma.usuario.findUnique({
      where: { cedula },
    });

    if (!user || user.eliminado) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.estado === 'INACTIVO') {
      throw new ForbiddenException('Usuario inactivo. Contacte al administrador.');
    }

    const lockoutStatus = this.checkLockoutStatus(user);
    if (lockoutStatus.isLocked) {
      throw new ForbiddenException(lockoutStatus.message);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.prisma.usuario.update({
      where: { id: user.id },
      data: {
        intentosFallidos: 0,
        bloqueadoHasta: null,
        ultimoLogin: new Date(),
      },
    });

    return this.generateAuthResponse(user);
  }

  /**
   * REFRESH TOKEN
   */
  async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    if (!refreshToken) {
      throw new UnauthorizedException('Token inválido');
    }

    let payload: RefreshTokenPayload & { exp: number };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    if (!payload.tokenId) {
      throw new UnauthorizedException('Token inválido');
    }

    const blacklisted = await this.tokenBlacklistService.isBlacklisted(payload.tokenId);
    if (blacklisted) {
      throw new UnauthorizedException('Token revocado');
    }

    const user = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.eliminado || user.estado === 'INACTIVO') {
      throw new UnauthorizedException('Usuario no válido');
    }

    if (!user.refreshTokenHash) {
      throw new UnauthorizedException('Sesión inválida. Inicie sesión nuevamente.');
    }

    const valid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!valid) {
      throw new UnauthorizedException('Token inválido');
    }

    await this.tokenBlacklistService.addToBlacklist(payload.tokenId, payload.exp);

    return this.generateAuthResponse(user);
  }

  /**
   * LOGOUT
   * Ahora es público: identifica al usuario desde el refreshToken
   */
  async logout(refreshToken: string, accessToken?: string): Promise<void> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token es requerido');
    }

    // Decodificar el refresh token (sin verificar expiración para permitir logout de tokens expirados)
    let refreshPayload: RefreshTokenPayload & { exp?: number };
    try {
      refreshPayload = this.jwtService.decode(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }

    if (!refreshPayload?.sub || !refreshPayload?.tokenId) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    try {
      // Invalidar refresh token en BD
      await this.prisma.usuario.update({
        where: { id: refreshPayload.sub },
        data: { refreshTokenHash: null },
      });

      // Agregar refresh token a blacklist si tiene fecha de expiración
      if (refreshPayload.exp) {
        await this.tokenBlacklistService.addToBlacklist(refreshPayload.tokenId, refreshPayload.exp);
      }

      // Agregar access token a blacklist si se proporcionó
      if (accessToken) {
        const accessPayload = this.jwtService.decode(accessToken);
        if (accessPayload?.jti && accessPayload?.exp) {
          await this.tokenBlacklistService.addToBlacklist(accessPayload.jti, accessPayload.exp);
        }
      }

      this.logger.debug(`Logout exitoso para usuario ${refreshPayload.sub}`);
    } catch (error) {
      // Si el usuario no existe, igual consideramos el logout exitoso
      this.logger.warn(`Error en logout para usuario ${refreshPayload.sub}`, error);
    }
  }

  /**
   * CHANGE PASSWORD
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('Contraseña actual incorrecta');
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }

    const hash = await bcrypt.hash(dto.newPassword, this.bcryptRounds);

    await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        passwordHash: hash,
        requiereCambioPassword: false,
        refreshTokenHash: null,
      },
    });
  }

  /**
   * RESET PASSWORD (Admin only)
   */
  async resetPassword(usuarioId: string, adminId: string): Promise<ResetPasswordResponseDto> {
    const user = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });

    if (!user || user.eliminado) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.rol === 'ADMIN' && user.id !== adminId) {
      throw new ForbiddenException('No se puede resetear la contraseña de otro administrador');
    }

    const passwordTemporal = this.generateTemporaryPassword();
    const hash = await bcrypt.hash(passwordTemporal, this.bcryptRounds);

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        passwordHash: hash,
        requiereCambioPassword: true,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        refreshTokenHash: null,
      },
    });

    this.logger.log(`Admin ${adminId} reseteó la contraseña del usuario ${usuarioId}`);

    return {
      message: 'Contraseña reseteada exitosamente',
      passwordTemporal,
      usuarioId: user.id,
      nombreUsuario: `${user.nombre} ${user.apellidos}`,
    };
  }

  /**
   * DESBLOQUEAR USUARIO (Admin only)
   */
  async desbloquearUsuario(usuarioId: string, adminId: string): Promise<void> {
    const user = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });

    if (!user || user.eliminado) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    });

    this.logger.log(`Admin ${adminId} desbloqueó al usuario ${usuarioId}`);
  }

  /**
   * Valida un usuario por ID
   */
  async validateUserById(userId: string): Promise<Usuario | null> {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!user || user.eliminado || user.estado === 'INACTIVO') {
      return null;
    }

    return user;
  }

  /**
   * Verifica si un token está en blacklist
   */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    return this.tokenBlacklistService.isBlacklisted(jti);
  }

  /**
   * Verifica el estado de bloqueo de un usuario
   */
  private checkLockoutStatus(user: Usuario): {
    isLocked: boolean;
    message: string;
  } {
    const permanentLockout = this.LOCKOUT_LEVELS.find(
      (level) => level.requiresAdmin && user.intentosFallidos >= level.minAttempts,
    );

    if (permanentLockout) {
      return {
        isLocked: true,
        message: 'Cuenta bloqueada por seguridad. Contacte al administrador para desbloquearla.',
      };
    }

    if (user.bloqueadoHasta && user.bloqueadoHasta > new Date()) {
      const minutosRestantes = Math.ceil((user.bloqueadoHasta.getTime() - Date.now()) / 60000);

      let tiempoFormateado: string;
      if (minutosRestantes >= 60) {
        const horas = Math.floor(minutosRestantes / 60);
        const minutos = minutosRestantes % 60;
        tiempoFormateado = minutos > 0 ? `${horas}h ${minutos}min` : `${horas} hora(s)`;
      } else {
        tiempoFormateado = `${minutosRestantes} minuto(s)`;
      }

      return {
        isLocked: true,
        message: `Cuenta bloqueada temporalmente. Intente nuevamente en ${tiempoFormateado}.`,
      };
    }

    return { isLocked: false, message: '' };
  }

  /**
   * Maneja un intento de login fallido
   */
  private async handleFailedLogin(user: Usuario): Promise<void> {
    const attempts = user.intentosFallidos + 1;

    const lockoutLevel = this.LOCKOUT_LEVELS.find(
      (level) => attempts >= level.minAttempts && attempts <= level.maxAttempts,
    );

    const updateData: {
      intentosFallidos: number;
      bloqueadoHasta?: Date | null;
    } = {
      intentosFallidos: attempts,
    };

    if (lockoutLevel && !lockoutLevel.requiresAdmin) {
      updateData.bloqueadoHasta = new Date(Date.now() + lockoutLevel.durationMinutes * 60 * 1000);

      this.logger.warn(
        `Usuario ${user.id} bloqueado por ${lockoutLevel.durationMinutes} minutos ` +
          `(${attempts} intentos fallidos)`,
      );
    } else if (lockoutLevel?.requiresAdmin) {
      this.logger.warn(
        `Usuario ${user.id} bloqueado permanentemente (${attempts} intentos fallidos). ` +
          `Requiere desbloqueo por administrador.`,
      );
    }

    await this.prisma.usuario.update({
      where: { id: user.id },
      data: updateData,
    });
  }

  /**
   * Genera una contraseña temporal segura
   * Formato: 3 letras mayúsculas + 3 números + 2 caracteres especiales
   */
  private generateTemporaryPassword(): string {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Sin I, O para evitar confusión
    const numbers = '23456789'; // Sin 0, 1 para evitar confusión
    const special = '@.$!%*?&';

    let password = '';

    for (let i = 0; i < 3; i++) {
      password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    }

    for (let i = 0; i < 3; i++) {
      password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }

    for (let i = 0; i < 2; i++) {
      password += special.charAt(Math.floor(Math.random() * special.length));
    }

    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Genera la respuesta de autenticación con tokens
   */
  private async generateAuthResponse(user: Usuario): Promise<AuthResponseDto> {
    const accessJti = uuidv4();
    const refreshJti = uuidv4();

    const accessExpiration = this.configService.get<string>('jwt.accessExpiration', '15m');
    const accessExpirationSeconds = this.configService.get<number>(
      'jwt.accessExpirationSeconds',
      900,
    );

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        rol: user.rol,
        jti: accessJti,
      },
      {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: accessExpiration,
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        tokenId: refreshJti,
      },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiration', '7d'),
      },
    );

    await this.prisma.usuario.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: await bcrypt.hash(refreshToken, this.bcryptRounds),
      },
    });

    const userResponse: UserResponseDto = {
      id: user.id,
      nombre: user.nombre,
      apellidos: user.apellidos,
      email: user.email,
      rol: user.rol,
      requiereCambioPassword: user.requiereCambioPassword,
    };

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessExpirationSeconds,
      user: userResponse,
    };
  }
}
