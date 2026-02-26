import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsEnum, IsInt, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoVenta } from '@prisma/client';

/**
 * DTO para un detalle de venta
 */
export class DetalleVentaDto {
  @ApiProperty({
    description: 'Tipo de venta',
    enum: ['PROMO', 'UNIDAD', 'SIN_LICOR', 'REGALO'],
    example: 'PROMO',
  })
  @IsEnum(['PROMO', 'UNIDAD', 'SIN_LICOR', 'REGALO'], {
    message: 'El tipo debe ser PROMO, UNIDAD, SIN_LICOR o REGALO',
  })
  // PROMO_PARCIAL está excluido: es generado internamente en ventas cross-lote
  tipo!: TipoVenta;

  @ApiProperty({
    description: 'Cantidad de este tipo',
    example: 3,
    minimum: 1,
  })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad mínima es 1' })
  cantidad!: number;
}

/**
 * DTO para registrar una venta
 * Según sección 6 del documento
 *
 * Vendedor registra venta colectiva (ej: 3 promos, 5 unidades, 1 regalo, 1 sin licor)
 */
export class CreateVentaDto {
  @ApiProperty({
    description: 'Detalles de la venta (tipos y cantidades)',
    type: [DetalleVentaDto],
    example: [
      { tipo: 'PROMO', cantidad: 3 },
      { tipo: 'UNIDAD', cantidad: 5 },
      { tipo: 'REGALO', cantidad: 1 },
    ],
  })
  @IsArray({ message: 'Los detalles deben ser un array' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un detalle de venta' })
  @ValidateNested({ each: true })
  @Type(() => DetalleVentaDto)
  detalles!: DetalleVentaDto[];
}
