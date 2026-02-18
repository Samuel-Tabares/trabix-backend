import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { EstadoLote, ModeloNegocio } from '@prisma/client';

/**
 * DTO para consultar lotes con filtros y paginación
 */
export class QueryLotesDto {
  @ApiPropertyOptional({
    description: 'Filtrar por vendedor',
    example: 'uuid-del-vendedor',
  })
  @IsOptional()
  @IsUUID('4')
  vendedorId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: ['CREADO', 'ACTIVO', 'FINALIZADO'],
  })
  @IsOptional()
  @IsEnum(['CREADO', 'ACTIVO', 'FINALIZADO'])
  estado?: EstadoLote;

  @ApiPropertyOptional({
    description: 'Filtrar por modelo de negocio',
    enum: ['MODELO_60_40', 'MODELO_50_50'],
  })
  @IsOptional()
  @IsEnum(['MODELO_60_40', 'MODELO_50_50'])
  modeloNegocio?: ModeloNegocio;

  @ApiPropertyOptional({
    description: 'Filtrar por lotes forzados',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  esLoteForzado?: boolean;

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
    enum: ['fechaCreacion', 'fechaActivacion', 'cantidadTrabix'],
    default: 'fechaCreacion',
  })
  @IsOptional()
  @IsEnum(['fechaCreacion', 'fechaActivacion', 'cantidadTrabix'])
  orderBy?: 'fechaCreacion' | 'fechaActivacion' | 'cantidadTrabix' = 'fechaCreacion';

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  orderDirection?: 'asc' | 'desc' = 'desc';
}
