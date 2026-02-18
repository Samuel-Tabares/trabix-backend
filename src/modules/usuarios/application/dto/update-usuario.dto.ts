import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';

/**
 * DTO para actualizar un usuario
 * Solo campos editables por admin
 */
export class UpdateUsuarioDto {
  @ApiPropertyOptional({
    description: 'Nombre del usuario',
    example: 'Juan',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Apellidos del usuario',
    example: 'Pérez García',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Los apellidos deben tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'Los apellidos no pueden exceder 100 caracteres' })
  apellidos?: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico del usuario',
    example: 'juan.perez@email.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Debe ser un correo electrónico válido' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Número de teléfono del usuario',
    example: '3001234567',
  })
  @IsOptional()
  @IsString()
  @MinLength(7, { message: 'El teléfono debe tener al menos 7 caracteres' })
  @MaxLength(15, { message: 'El teléfono no puede exceder 15 caracteres' })
  @Matches(/^[0-9+\-\s]+$/, {
    message: 'El teléfono solo puede contener números, +, - y espacios',
  })
  telefono?: string;
}
