import { ApiProperty } from '@nestjs/swagger';
import { Rol } from '@prisma/client';

/**
 * DTO de respuesta de usuario
 */
export class UserResponseDto {
  @ApiProperty({
    description: 'ID único del usuario',
    example: 'uuid-v4-string',
  })
  id!: string;

  @ApiProperty({
    description: 'Nombre del usuario',
    example: 'Juan',
  })
  nombre!: string;

  @ApiProperty({
    description: 'Apellidos del usuario',
    example: 'Pérez García',
  })
  apellidos!: string;

  @ApiProperty({
    description: 'Correo electrónico',
    example: 'juan.perez@email.com',
  })
  email!: string;

  @ApiProperty({
    description: 'Rol del usuario',
    enum: Rol,
    example: 'VENDEDOR',
  })
  rol!: Rol;

  @ApiProperty({
    description: 'Indica si el usuario debe cambiar su contraseña',
    example: true,
  })
  requiereCambioPassword!: boolean;
}

/**
 * DTO de respuesta de autenticación
 */
export class AuthResponseDto {
  @ApiProperty({
    description: 'Access token JWT (expira en 15 minutos)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Refresh token JWT (expira en 7 días)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken!: string;

  @ApiProperty({
    description: 'Tipo de token',
    example: 'Bearer',
  })
  tokenType!: string;

  @ApiProperty({
    description: 'Tiempo de expiración del access token en segundos',
    example: 900,
  })
  expiresIn!: number;

  @ApiProperty({
    type: () => UserResponseDto, // <-- referencia diferida
    description: 'Datos del usuario autenticado',
  })
  user!: UserResponseDto;
}

/**
 * DTO de mensaje simple
 */
export class MessageResponseDto {
  @ApiProperty({
    description: 'Mensaje de respuesta',
    example: 'Operación exitosa',
  })
  message!: string;
}
