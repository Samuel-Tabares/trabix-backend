import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoCuadre, ConceptoCuadre } from '@prisma/client';

/**
 * DTO para consultar cuadres con filtros y paginación
 */
export class QueryCuadresDto {
  @ApiPropertyOptional({
    description: 'Filtrar por lote',
    example: 'uuid-del-lote',
  })
  @IsOptional()
  @IsUUID('4')
  loteId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por vendedor',
    example: 'uuid-del-vendedor',
  })
  @IsOptional()
  @IsUUID('4')
  vendedorId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: ['INACTIVO', 'PENDIENTE', 'EXITOSO'],
  })
  @IsOptional()
  @IsEnum(['INACTIVO', 'PENDIENTE', 'EXITOSO'])
  estado?: EstadoCuadre;

  @ApiPropertyOptional({
    description: 'Filtrar por concepto',
    enum: ['INVERSION_ADMIN', 'GANANCIAS', 'MIXTO'],
  })
  @IsOptional()
  @IsEnum(['INVERSION_ADMIN', 'GANANCIAS', 'MIXTO'])
  concepto?: ConceptoCuadre;

  @ApiPropertyOptional({
    description: 'Número de registros a saltar',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Número de registros a retornar',
    minimum: 1,
    maximum: 500,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number = 20;

  @ApiPropertyOptional({
    description: 'Cursor para paginación',
  })
  @IsOptional()
  @IsUUID('4')
  cursor?: string;
}
