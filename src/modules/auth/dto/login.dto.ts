import { IsInt, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO para login
 * Según sección 20.2 del documento
 */
export class LoginDto {
  @ApiProperty({
    description: 'Cédula del usuario (número)',
    example: 1234567890,
  })
  @Type(() => Number)
  @IsInt({ message: 'La cédula debe ser numérica' })
  @IsNotEmpty({ message: 'La cédula es requerida' })
  cedula!: number;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'MiPassword123!',
    minLength: 6,
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password!: string;
}
