import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoPedidoStock } from '@prisma/client';

// ========== Constantes de Paginación ==========

/**
 * Límites de paginación para optimizar rendimiento
 */
export const PAGINATION_DEFAULTS = {
  DEFAULT_SKIP: 0,
  DEFAULT_TAKE: 20,
  MAX_TAKE: 100,
} as const;

// ========== Pedido Stock DTOs ==========

export class CrearPedidoStockDto {
  @ApiProperty({ description: 'Cantidad de TRABIX a pedir', minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad mínima es 1' })
  cantidadTrabix!: number;

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  notas?: string;
}

export class ModificarPedidoStockDto {
  @ApiPropertyOptional({ description: 'Nueva cantidad de TRABIX', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad mínima es 1' })
  cantidadTrabix?: number;

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  notas?: string;
}

export class AgregarCostoDto {
  @ApiProperty({ description: 'Concepto del costo' })
  @IsString({ message: 'El concepto debe ser texto' })
  concepto!: string;

  @ApiProperty({ description: 'Si es insumo obligatorio' })
  @Type(() => Boolean)
  @IsBoolean({ message: 'esObligatorio debe ser booleano' })
  esObligatorio!: boolean;

  @ApiPropertyOptional({ description: 'Cantidad (si aplica)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @Min(0, { message: 'La cantidad no puede ser negativa' })
  cantidad?: number;

  @ApiProperty({ description: 'Costo total de este concepto', minimum: 0 })
  @Type(() => Number)
  @IsNumber({}, { message: 'El costo total debe ser un número' })
  @Min(0, { message: 'El costo total no puede ser negativo' })
  costoTotal!: number;
}

export class QueryPedidosDto {
  @ApiPropertyOptional({
    enum: ['BORRADOR', 'CONFIRMADO', 'RECIBIDO', 'CANCELADO'],
    description: 'Filtrar por estado',
  })
  @IsOptional()
  @IsEnum(['BORRADOR', 'CONFIRMADO', 'RECIBIDO', 'CANCELADO'], {
    message: 'Estado inválido',
  })
  estado?: EstadoPedidoStock;

  @ApiPropertyOptional({
    default: PAGINATION_DEFAULTS.DEFAULT_SKIP,
    minimum: 0,
    description: 'Registros a saltar (paginación)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'skip debe ser un entero' })
  @Min(0, { message: 'skip no puede ser negativo' })
  skip?: number = PAGINATION_DEFAULTS.DEFAULT_SKIP;

  @ApiPropertyOptional({
    default: PAGINATION_DEFAULTS.DEFAULT_TAKE,
    minimum: 1,
    maximum: PAGINATION_DEFAULTS.MAX_TAKE,
    description: `Registros a obtener (máximo ${PAGINATION_DEFAULTS.MAX_TAKE})`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'take debe ser un entero' })
  @Min(1, { message: 'take mínimo es 1' })
  @Max(PAGINATION_DEFAULTS.MAX_TAKE, {
    message: `take máximo es ${PAGINATION_DEFAULTS.MAX_TAKE}`,
  })
  take?: number = PAGINATION_DEFAULTS.DEFAULT_TAKE;
}

export class DetalleCostoResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  concepto!: string;

  @ApiProperty()
  esObligatorio!: boolean;

  @ApiPropertyOptional()
  cantidad?: number | null;

  @ApiProperty()
  costoTotal!: number;

  @ApiProperty()
  fechaRegistro!: Date;
}

export class PedidoStockResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  cantidadTrabix!: number;

  @ApiProperty({ enum: ['BORRADOR', 'CONFIRMADO', 'RECIBIDO', 'CANCELADO'] })
  estado!: EstadoPedidoStock;

  @ApiProperty()
  costoTotal!: number;

  @ApiProperty()
  costoRealPorTrabix!: number;

  @ApiProperty({ type: [DetalleCostoResponseDto] })
  detallesCosto!: DetalleCostoResponseDto[];

  @ApiProperty()
  fechaCreacion!: Date;

  @ApiPropertyOptional()
  fechaCancelacion?: Date | null;

  @ApiPropertyOptional()
  motivoCancelacion?: string | null;

  @ApiPropertyOptional()
  notas?: string | null;
}

// ========== Configuracion DTOs ==========

export class ModificarConfiguracionDto {
  @ApiProperty({ description: 'Nuevo valor' })
  @IsString({ message: 'El valor debe ser texto' })
  valor!: string;

  @ApiPropertyOptional({ description: 'Motivo del cambio' })
  @IsOptional()
  @IsString({ message: 'El motivo debe ser texto' })
  motivo?: string;
}

export class ConfiguracionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  clave!: string;

  @ApiProperty()
  valor!: string;

  @ApiProperty()
  tipo!: string;

  @ApiProperty()
  descripcion!: string;

  @ApiProperty()
  categoria!: string;

  @ApiProperty()
  modificable!: boolean;

  @ApiProperty()
  ultimaModificacion!: Date;
}

// ========== TipoInsumo DTOs ==========

export class CrearTipoInsumoDto {
  @ApiProperty({ description: 'Nombre del tipo de insumo' })
  @IsString({ message: 'El nombre debe ser texto' })
  nombre!: string;

  @ApiPropertyOptional({ description: 'Si es obligatorio', default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'esObligatorio debe ser booleano' })
  esObligatorio?: boolean;
}

export class ModificarTipoInsumoDto {
  @ApiPropertyOptional({ description: 'Nombre del tipo de insumo' })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser texto' })
  nombre?: string;
}

export class TipoInsumoResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  esObligatorio!: boolean;

  @ApiProperty()
  activo!: boolean;

  @ApiProperty()
  fechaCreacion!: Date;
}

// ========== StockAdmin DTOs ==========

export class StockAdminResponseDto {
  @ApiProperty({ description: 'Stock físico actual' })
  stockFisico!: number;

  @ApiPropertyOptional({ description: 'ID del último pedido' })
  ultimoPedidoId?: string | null;

  @ApiProperty()
  ultimaActualizacion!: Date;
}

export class DeficitResponseDto {
  @ApiProperty({ description: 'Stock físico actual' })
  stockFisico!: number;

  @ApiProperty({ description: 'Stock reservado (comprometido)' })
  stockReservado!: number;

  @ApiProperty({ description: 'Déficit (si > 0)' })
  deficit!: number;

  @ApiProperty({ description: 'Si hay déficit' })
  hayDeficit!: boolean;
}

/**
 * DTO para desglose de stock por estado de tanda
 * Solo estados que representan stock RESERVADO (aún no entregado al vendedor)
 */
export class StockPorEstadoDto {
  @ApiProperty({ description: 'Stock en tandas INACTIVAS (comprometido, no liberado aún)' })
  inactiva!: number;

  @ApiProperty({ description: 'Stock en tandas LIBERADAS (listo para enviar, sigue con admin)' })
  liberada!: number;

  @ApiProperty({ description: 'Stock en tandas EN_TRANSITO (en camino al vendedor)' })
  enTransito!: number;
}

/**
 * DTO para detalle de stock reservado por vendedor
 */
export class StockReservadoPorVendedorDto {
  @ApiProperty({ description: 'ID del vendedor' })
  vendedorId!: string;

  @ApiProperty({ description: 'Nombre del vendedor' })
  vendedorNombre!: string;

  @ApiProperty({ description: 'Cantidad de TRABIX reservados' })
  cantidadReservada!: number;

  @ApiProperty({ description: 'Cantidad de lotes activos' })
  lotesActivos!: number;
}

/**
 * DTO para detalle de stock reservado por lote
 */
export class StockReservadoPorLoteDto {
  @ApiProperty({ description: 'ID del lote' })
  loteId!: string;

  @ApiProperty({ description: 'ID del vendedor' })
  vendedorId!: string;

  @ApiProperty({ description: 'Nombre del vendedor' })
  vendedorNombre!: string;

  @ApiProperty({ description: 'Cantidad total del lote' })
  cantidadTrabix!: number;

  @ApiProperty({ description: 'Stock actual pendiente de venta' })
  stockPendiente!: number;

  @ApiProperty({ description: 'Estado del lote' })
  estadoLote!: string;

  @ApiProperty({ description: 'Desglose por tandas' })
  tandas!: {
    tandaId: string;
    numero: number;
    estado: string;
    stockActual: number;
  }[];
}

/**
 * DTO completo de stock reservado con desglose
 * Stock reservado = comprometido pero NO entregado al vendedor
 */
export class StockReservadoDetalladoDto {
  @ApiProperty({ description: 'Total de stock reservado (INACTIVA + LIBERADA + EN_TRANSITO)' })
  totalReservado!: number;

  @ApiProperty({ description: 'Desglose por estado de tanda', type: StockPorEstadoDto })
  porEstado!: StockPorEstadoDto;

  @ApiProperty({
    description: 'Desglose por vendedor (cuánto tiene comprometido cada uno)',
    type: [StockReservadoPorVendedorDto],
  })
  porVendedor!: StockReservadoPorVendedorDto[];

  @ApiProperty({
    description: 'Desglose por lote (detalle de tandas pendientes)',
    type: [StockReservadoPorLoteDto],
  })
  porLote!: StockReservadoPorLoteDto[];
}

// ========== Dashboard DTOs ==========

export class ResumenDashboardDto {
  @ApiProperty({ description: 'Total de ventas del día' })
  ventasHoy!: number;

  @ApiProperty({ description: 'Ingresos del día' })
  ingresosHoy!: number;

  @ApiProperty({ description: 'Stock físico actual' })
  stockFisico!: number;

  @ApiProperty({ description: 'Cuadres pendientes de confirmar' })
  cuadresPendientes!: number;

  @ApiProperty({
    description: 'Total de usuarios activos que pueden vender (VENDEDOR + RECLUTADOR)',
  })
  vendedoresActivos!: number;

  @ApiProperty({ description: 'Saldo del fondo de recompensas' })
  saldoFondo!: number;
}

export class VentasPeriodoDto {
  @ApiProperty({ description: 'Período consultado' })
  periodo!: string;

  @ApiProperty({ description: 'Total de ventas' })
  totalVentas!: number;

  @ApiProperty({ description: 'Total de ingresos' })
  totalIngresos!: number;

  @ApiProperty({ description: 'Cantidad de TRABIX vendidos' })
  trabixVendidos!: number;
}

export class CuadrePendienteResumenDto {
  @ApiProperty()
  cuadreId!: string;

  @ApiProperty()
  tandaId!: string;

  @ApiProperty()
  numeroTanda!: number;

  @ApiProperty()
  vendedorNombre!: string;

  @ApiProperty()
  montoEsperado!: number;

  @ApiProperty()
  fechaPendiente!: Date;
}

// ========== Vendedores Activos DTO ==========

export class VendedoresActivosDetalleDto {
  @ApiProperty({ description: 'Total de usuarios activos que pueden vender' })
  total!: number;

  @ApiProperty({ description: 'Cantidad con rol VENDEDOR' })
  vendedores!: number;

  @ApiProperty({ description: 'Cantidad con rol RECLUTADOR (también venden)' })
  reclutadores!: number;
}

// ========== Cancelar Pedido DTO ==========

export class CancelarPedidoDto {
  @ApiProperty({ description: 'Motivo de la cancelación' })
  @IsString({ message: 'El motivo debe ser texto' })
  motivo!: string;
}
