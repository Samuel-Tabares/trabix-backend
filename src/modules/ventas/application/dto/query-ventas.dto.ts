import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para consultar ventas con filtros y paginación
 */
export class QueryVentasDto {
  @ApiPropertyOptional({
    description: 'Filtrar por vendedor',
    example: 'uuid-del-vendedor',
  })
  @IsOptional()
  @IsUUID('4')
  vendedorId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por lote',
    example: 'uuid-del-lote',
  })
  @IsOptional()
  @IsUUID('4')
  loteId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tanda',
    example: 'uuid-de-la-tanda',
  })
  @IsOptional()
  @IsUUID('4')
  tandaId?: string;

  @ApiPropertyOptional({ description: 'Buscar por nombre del vendedor' })
  @IsOptional()
  @IsString()
  searchVendedor?: string;

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
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @ApiPropertyOptional({
    description: 'Cursor para paginación',
  })
  @IsOptional()
  @IsUUID('4')
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    enum: ['fechaRegistro', 'montoTotal'],
    default: 'fechaRegistro',
  })
  @IsOptional()
  @IsEnum(['fechaRegistro', 'montoTotal'])
  orderBy?: 'fechaRegistro' | 'montoTotal' = 'fechaRegistro';

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  orderDirection?: 'asc' | 'desc' = 'desc';
}
