import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/**
 * DTO para solicitar un nuevo lote (Vendedor)
 *
 * La cantidad mínima se calcula dinámicamente basándose en:
 * - Inversión mínima del vendedor = $20,000
 * - cantidad_minima = CEIL($20,000 / (costo_percibido × 0.5))
 *
 * Con costo_percibido = $2,400:
 * cantidad_minima = CEIL($20,000 / $1,200) = 17 TRABIX
 *
 * NOTA: La validación del mínimo dinámico se hace en el Command Handler,
 * no en el DTO, porque depende de la configuración del sistema.
 */
export class SolicitarLoteDto {
  @ApiProperty({
    description: 'Cantidad de TRABIX del lote. Mínimo calculado según inversión mínima de $20,000',
    example: 20,
    minimum: 1,
  })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser al menos 1 TRABIX' })
  cantidadTrabix!: number;
}

/**
 * DTO de respuesta para información de solicitud
 */
export class InfoSolicitudLoteDto {
  @ApiProperty({ description: 'Cantidad mínima de TRABIX permitida' })
  cantidadMinima!: number;

  @ApiProperty({ description: 'Costo percibido por TRABIX' })
  costoPorTrabix!: number;

  @ApiProperty({ description: 'Inversión total para cantidad mínima' })
  inversionTotalMinima!: number;

  @ApiProperty({ description: 'Inversión del vendedor para cantidad mínima' })
  inversionVendedorMinima!: number;

  @ApiProperty({ description: 'Lotes en estado CREADO actuales del vendedor' })
  lotesCreadosActuales!: number;

  @ApiProperty({ description: 'Máximo de lotes en estado CREADO permitidos' })
  maxLotesCreados!: number;

  @ApiProperty({ description: 'Puede solicitar más lotes' })
  puedeSolicitar!: boolean;
}
