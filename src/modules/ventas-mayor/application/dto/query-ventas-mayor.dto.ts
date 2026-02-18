import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoVentaMayor, ModalidadVentaMayor } from '@prisma/client';

/**
 * DTO para consultar ventas al mayor con filtros y paginación
 */
export class QueryVentasMayorDto {
  @ApiPropertyOptional({
    description: 'Filtrar por vendedor',
    example: 'uuid-del-vendedor',
  })
  @IsOptional()
  @IsUUID('4')
  vendedorId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: ['PENDIENTE', 'COMPLETADA'],
  })
  @IsOptional()
  @IsEnum(['PENDIENTE', 'COMPLETADA'])
  estado?: EstadoVentaMayor;

  @ApiPropertyOptional({
    description: 'Filtrar por modalidad',
    enum: ['ANTICIPADO', 'CONTRAENTREGA'],
  })
  @IsOptional()
  @IsEnum(['ANTICIPADO', 'CONTRAENTREGA'])
  modalidad?: ModalidadVentaMayor;

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
}
