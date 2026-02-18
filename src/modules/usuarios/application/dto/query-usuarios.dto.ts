import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max, IsUUID, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Rol, EstadoUsuario } from '@prisma/client';

/**
 * Constantes de paginación
 */
export const USUARIOS_PAGINATION = {
  DEFAULT_SKIP: 0,
  DEFAULT_TAKE: 20,
  MAX_TAKE: 100,
} as const;

/**
 * DTO para consultar usuarios con filtros y paginación
 * Soporta cursor pagination según sección 20.14
 */
export class QueryUsuariosDto {
  @ApiPropertyOptional({
    description: 'Búsqueda por nombre, apellidos o email',
    example: 'juan',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Búsqueda exacta por cédula (número)',
    example: 1234567890,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cedula?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por rol',
    enum: ['ADMIN', 'VENDEDOR', 'RECLUTADOR'],
  })
  @IsOptional()
  @IsEnum(['ADMIN', 'VENDEDOR', 'RECLUTADOR'])
  rol?: Rol;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: ['ACTIVO', 'INACTIVO'],
  })
  @IsOptional()
  @IsEnum(['ACTIVO', 'INACTIVO'])
  estado?: EstadoUsuario;

  @ApiPropertyOptional({
    description: 'Filtrar por reclutador',
    example: 'uuid-del-reclutador',
  })
  @IsOptional()
  @IsUUID('4')
  reclutadorId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por eliminados (true = solo eliminados, false = solo activos)',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  eliminado?: boolean = false;

  @ApiPropertyOptional({
    description: 'Número de registros a saltar (offset)',
    minimum: 0,
    default: USUARIOS_PAGINATION.DEFAULT_SKIP,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = USUARIOS_PAGINATION.DEFAULT_SKIP;

  @ApiPropertyOptional({
    description: `Número de registros a retornar (máximo ${USUARIOS_PAGINATION.MAX_TAKE})`,
    minimum: 1,
    maximum: USUARIOS_PAGINATION.MAX_TAKE,
    default: USUARIOS_PAGINATION.DEFAULT_TAKE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(USUARIOS_PAGINATION.MAX_TAKE)
  take?: number = USUARIOS_PAGINATION.DEFAULT_TAKE;

  @ApiPropertyOptional({
    description: 'Cursor para paginación (ID del último elemento)',
    example: 'uuid-del-ultimo-elemento',
  })
  @IsOptional()
  @IsUUID('4')
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    enum: ['fechaCreacion', 'nombre', 'apellidos', 'email'],
    default: 'fechaCreacion',
  })
  @IsOptional()
  @IsEnum(['fechaCreacion', 'nombre', 'apellidos', 'email'])
  orderBy?: 'fechaCreacion' | 'nombre' | 'apellidos' | 'email' = 'fechaCreacion';

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  orderDirection?: 'asc' | 'desc' = 'desc';
}
