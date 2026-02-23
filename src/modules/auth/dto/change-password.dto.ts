import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para cambio de contraseña
 * Según sección 20.2 del documento
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: 'Contraseña actual del usuario',
    example: 'MiPasswordActual123!',
  })
  @IsString({ message: 'La contraseña actual debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña actual es requerida' })
  currentPassword!: string;

  @ApiProperty({
    description:
      'Nueva contraseña (mínimo 6 caracteres, debe incluir mayúscula, minúscula, número y caracter especial)',
    example: 'MiNuevaPassword123!',
    minLength: 6,
  })
  @IsString({ message: 'La nueva contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La nueva contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @Matches(/[A-Z]/, { message: 'La contraseña debe contener al menos una letra mayúscula' })
  @Matches(/[a-z]/, { message: 'La contraseña debe contener al menos una letra minúscula' })
  @Matches(/\d/, { message: 'La contraseña debe contener al menos un número' })
  @Matches(/[@.$!%*?&]/, { message: 'La contraseña debe contener al menos un caracter especial (@.$!%*?&)' })
  newPassword!: string;
}
