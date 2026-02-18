import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsEnum, IsUUID, IsNumber, Min } from 'class-validator';
import { EstadoEquipamiento } from '@prisma/client';

// ========== Request DTOs ==========

/**
 * DTO para solicitar equipamiento (vendedor)
 */
export class SolicitarEquipamientoDto {
  @ApiProperty({
    description: 'Si incluye depósito inicial (afecta la mensualidad)',
    example: true,
  })
  @IsBoolean()
  tieneDeposito!: boolean;
}

/**
 * DTO para reportar daño (admin)
 */
export class ReportarDanoDto {
  @ApiProperty({
    description: 'Tipo de daño: NEVERA ($30,000) o PIJAMA ($60,000)',
    enum: ['NEVERA', 'PIJAMA'],
    example: 'NEVERA',
  })
  @IsEnum(['NEVERA', 'PIJAMA'])
  tipoDano!: 'NEVERA' | 'PIJAMA';
}

/**
 * DTO para pagar deuda (admin)
 * Usado para abonar a deuda por daño o pérdida
 */
export class PagarDeudaDto {
  @ApiProperty({
    description: 'Monto a abonar a la deuda',
    example: 30000,
    minimum: 1,
  })
  @IsNumber()
  @Min(1, { message: 'El monto debe ser mayor a cero' })
  monto!: number;
}

/**
 * DTO para filtrar equipamientos (admin)
 */
export class QueryEquipamientosDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: ['SOLICITADO', 'ACTIVO', 'DEVUELTO', 'PERDIDO'],
  })
  @IsOptional()
  @IsEnum(['SOLICITADO', 'ACTIVO', 'DEVUELTO', 'PERDIDO'])
  estado?: EstadoEquipamiento;

  @ApiPropertyOptional({ description: 'Filtrar por vendedor' })
  @IsOptional()
  @IsUUID()
  vendedorId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  skip?: number = 0;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  take?: number = 20;
}

// ========== Response DTOs ==========

/**
 * Información básica del vendedor
 */
export class VendedorInfoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  apellidos!: string;

  @ApiProperty()
  cedula!: number;

  @ApiProperty()
  telefono!: string;
}

/**
 * DTO de respuesta de equipamiento
 */
export class EquipamientoResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  vendedorId!: string;

  @ApiPropertyOptional({ type: VendedorInfoDto })
  vendedor?: VendedorInfoDto;

  @ApiProperty({ enum: ['SOLICITADO', 'ACTIVO', 'DEVUELTO', 'PERDIDO'] })
  estado!: EstadoEquipamiento;

  @ApiProperty({ description: 'Si pagó depósito inicial' })
  tieneDeposito!: boolean;

  @ApiPropertyOptional({ description: 'Monto del depósito pagado' })
  depositoPagado?: number | null;

  @ApiProperty({ description: 'Mensualidad actual según depósito' })
  mensualidadActual!: number;

  @ApiPropertyOptional({ description: 'Fecha del último pago de mensualidad' })
  ultimaMensualidadPagada?: Date | null;

  @ApiProperty({ description: 'Deuda acumulada por daños' })
  deudaDano!: number;

  @ApiProperty({ description: 'Deuda por pérdida total' })
  deudaPerdida!: number;

  @ApiProperty()
  fechaSolicitud!: Date;

  @ApiPropertyOptional({ description: 'Fecha en que admin entregó el equipamiento' })
  fechaEntrega?: Date | null;

  @ApiPropertyOptional({ description: 'Fecha en que se devolvió' })
  fechaDevolucion?: Date | null;

  @ApiProperty({ description: 'Si el depósito fue devuelto' })
  depositoDevuelto!: boolean;

  @ApiPropertyOptional()
  fechaDevolucionDeposito?: Date | null;

  // Campos calculados
  @ApiProperty({ description: 'Si la mensualidad está al día (últimos 30 días)' })
  mensualidadAlDia!: boolean;

  @ApiProperty({ description: 'Días de mora en mensualidad' })
  diasMoraMensualidad!: number;

  @ApiProperty({ description: 'Cantidad de mensualidades pendientes' })
  mensualidadesPendientes!: number;

  @ApiProperty({ description: 'Monto de mensualidades pendientes' })
  montoMensualidadesPendientes!: number;

  @ApiProperty({ description: 'Deuda total (daños + pérdida, sin mensualidades)' })
  deudaTotal!: number;

  @ApiProperty({ description: 'Deuda total incluyendo mensualidades pendientes' })
  deudaTotalConMensualidades!: number;

  @ApiProperty({ description: 'Si tiene alguna deuda pendiente' })
  tieneDeuda!: boolean;
}

/**
 * DTO de respuesta de equipamiento con advertencia de cuadres
 * Usado cuando una operación puede afectar los cuadres
 */
export class EquipamientoConAdvertenciaDto extends EquipamientoResponseDto {
  @ApiPropertyOptional({
    description: 'Advertencia si hubo error actualizando los cuadres del vendedor',
    example:
      'El daño fue registrado correctamente, pero hubo un error al actualizar los cuadres...',
  })
  advertenciaCuadres?: string;
}

/**
 * DTO de respuesta paginada
 */
export class EquipamientosPaginadosDto {
  @ApiProperty({ type: [EquipamientoResponseDto] })
  data!: EquipamientoResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  hasMore!: boolean;
}

/**
 * DTO para resumen de deudas de equipamiento
 * Usado por el módulo de cuadres
 */
export class ResumenDeudaEquipamientoDto {
  @ApiProperty()
  equipamientoId!: string;

  @ApiProperty()
  vendedorId!: string;

  @ApiProperty({ description: 'Deuda por daños' })
  deudaDano!: number;

  @ApiProperty({ description: 'Deuda por pérdida' })
  deudaPerdida!: number;

  @ApiProperty({ description: 'Mensualidades pendientes (cantidad)' })
  mensualidadesPendientes!: number;

  @ApiProperty({ description: 'Monto de mensualidades pendientes' })
  montoMensualidadesPendientes!: number;

  @ApiProperty({ description: 'Deuda total a incluir en cuadre' })
  deudaTotalParaCuadre!: number;
}
