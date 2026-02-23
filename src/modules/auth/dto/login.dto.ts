import { IsInt, IsNotEmpty, IsString, Min, Max } from 'class-validator';
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
  @Min(100000, { message: 'La cédula debe tener entre 6 y 10 dígitos' })
  @Max(2147483647, { message: 'La cédula debe tener entre 6 y 10 dígitos' })
  @IsNotEmpty({ message: 'La cédula es requerida' })
  cedula!: number;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'MiPassword123!',
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  password!: string;
}
