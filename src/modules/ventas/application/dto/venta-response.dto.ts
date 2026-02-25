import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoVenta } from '@prisma/client';

/**
 * DTO de respuesta para detalle de venta
 */
export class DetalleVentaResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ventaId!: string;

  @ApiProperty({ enum: ['PROMO', 'UNIDAD', 'SIN_LICOR', 'REGALO'] })
  tipo!: TipoVenta;

  @ApiProperty()
  cantidad!: number;

  @ApiProperty()
  precioUnitario!: number;

  @ApiProperty()
  subtotal!: number;

  @ApiProperty({ description: 'TRABIX consumidos por este detalle' })
  trabixConsumidos!: number;
}

/**
 * DTO de respuesta para venta
 */
export class VentaResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  vendedorId!: string;

  @ApiPropertyOptional()
  vendedorNombre?: string;

  @ApiPropertyOptional()
  vendedorTelefono?: string;

  @ApiProperty()
  loteId!: string;

  @ApiProperty()
  tandaId!: string;

  @ApiProperty()
  montoTotal!: number;

  @ApiProperty({ description: 'Total de TRABIX en esta venta' })
  cantidadTrabix!: number;

  @ApiProperty({ type: [DetalleVentaResponseDto] })
  detalles!: DetalleVentaResponseDto[];

  @ApiProperty()
  fechaRegistro!: Date;

  @ApiProperty({ description: 'Cantidad de regalos en esta venta' })
  cantidadRegalos!: number;
}

/**
 * DTO para lista paginada de ventas
 */
export class VentasPaginadasDto {
  @ApiProperty({ type: [VentaResponseDto] })
  data!: VentaResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  hasMore!: boolean;

  @ApiPropertyOptional()
  nextCursor?: string;
}
