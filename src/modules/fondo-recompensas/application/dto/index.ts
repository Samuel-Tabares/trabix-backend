import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  Min,
  Max,
  MaxLength,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

// ========== Request DTOs ==========

/**
 * DTO para registrar una salida del fondo (premio/bono a vendedor)
 */
export class RegistrarSalidaDto {
  @ApiProperty({ description: 'Monto de la salida', example: 50000 })
  @IsNumber()
  @Min(1, { message: 'El monto debe ser mayor a 0' })
  monto!: number;

  @ApiProperty({
    description: 'Concepto/motivo de la salida (máximo 120 caracteres)',
    example: 'Premio vendedor del mes - Enero 2025',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120, { message: 'El concepto no puede exceder 120 caracteres' })
  concepto!: string;

  @ApiProperty({
    description: 'ID del vendedor beneficiario del premio',
    example: 'uuid-del-vendedor',
  })
  @IsUUID('4', { message: 'El ID del vendedor debe ser un UUID válido' })
  vendedorBeneficiarioId!: string;
}

/**
 * DTO para filtrar transacciones
 */
export class QueryTransaccionesDto {
  @ApiPropertyOptional({
    description: 'Filtrar por tipo de movimiento',
    enum: ['ENTRADA', 'SALIDA'],
  })
  @IsOptional()
  @IsEnum(['ENTRADA', 'SALIDA'], { message: 'El tipo debe ser ENTRADA o SALIDA' })
  tipo?: 'ENTRADA' | 'SALIDA';

  @ApiPropertyOptional({
    description: 'Número de registros a saltar',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'skip debe ser un número entero' })
  @Min(0, { message: 'skip debe ser mayor o igual a 0' })
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Número de registros a retornar',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'take debe ser un número entero' })
  @Min(1, { message: 'take debe ser al menos 1' })
  @Max(100, { message: 'take no puede exceder 100' })
  take?: number = 20;
}

// ========== Response DTOs ==========

/**
 * DTO de respuesta para saldo del fondo
 */
export class SaldoFondoResponseDto {
  @ApiProperty({ description: 'Saldo actual del fondo', example: 1500000 })
  saldo!: number;
}

/**
 * DTO de respuesta para un movimiento del fondo
 */
export class MovimientoFondoResponseDto {
  @ApiProperty({ description: 'ID del movimiento' })
  id!: string;

  @ApiProperty({ enum: ['ENTRADA', 'SALIDA'], description: 'Tipo de movimiento' })
  tipo!: 'ENTRADA' | 'SALIDA';

  @ApiProperty({ description: 'Monto del movimiento', example: 50000 })
  monto!: number;

  @ApiProperty({ description: 'Concepto del movimiento' })
  concepto!: string;

  @ApiPropertyOptional({ description: 'ID del lote (solo para entradas)' })
  loteId?: string;

  @ApiPropertyOptional({ description: 'ID del vendedor beneficiario (solo para salidas/premios)' })
  vendedorBeneficiarioId?: string;

  @ApiProperty({ description: 'Fecha de la transacción' })
  fechaTransaccion!: Date;
}

/**
 * DTO de respuesta paginada de transacciones
 */
export class TransaccionesPaginadasDto {
  @ApiProperty({ type: [MovimientoFondoResponseDto] })
  data!: MovimientoFondoResponseDto[];

  @ApiProperty({ description: 'Total de transacciones' })
  total!: number;

  @ApiProperty({ description: 'Indica si hay más resultados' })
  hasMore!: boolean;
}
