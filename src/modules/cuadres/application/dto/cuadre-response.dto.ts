import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoCuadre, ConceptoCuadre } from '@prisma/client';

/**
 * DTO de respuesta para tanda dentro de cuadre
 */
export class TandaCuadreResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  loteId!: string;

  @ApiProperty()
  numero!: number;

  @ApiProperty()
  stockInicial!: number;

  @ApiProperty()
  stockActual!: number;

  @ApiProperty()
  estado!: string;
}

/**
 * DTO de respuesta para cuadre
 */
export class CuadreResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tandaId!: string;

  @ApiProperty({ description: 'ID del vendedor dueño del lote' })
  vendedorId!: string;

  @ApiProperty({ enum: ['INACTIVO', 'PENDIENTE', 'EXITOSO'] })
  estado!: EstadoCuadre;

  @ApiProperty({ enum: ['INVERSION_ADMIN', 'GANANCIAS', 'MIXTO'] })
  concepto!: ConceptoCuadre;

  @ApiProperty({ description: 'Monto que debe transferir el vendedor' })
  montoEsperado!: number;

  @ApiProperty({ description: 'Monto efectivamente recibido' })
  montoRecibido!: number;

  @ApiProperty({ description: 'Diferencia pendiente' })
  montoFaltante!: number;

  @ApiProperty({ description: 'Monto cubierto por cuadre al mayor' })
  montoCubiertoPorMayor!: number;

  @ApiProperty({ description: 'Monto esperado ajustado (sin lo cubierto por mayor)' })
  montoEsperadoAjustado!: number;

  @ApiPropertyOptional({ description: 'ID del cuadre al mayor que lo cerró' })
  cerradoPorCuadreMayorId?: string | null;

  @ApiPropertyOptional()
  fechaPendiente?: Date | null;

  @ApiPropertyOptional()
  fechaExitoso?: Date | null;

  @ApiProperty({ type: TandaCuadreResponseDto })
  tanda!: TandaCuadreResponseDto;

  @ApiProperty({ description: 'Indica si fue cerrado por cuadre al mayor' })
  fueCerradoPorMayor!: boolean;
}

/**
 * DTO para lista paginada de cuadres
 */
export class CuadresPaginadosDto {
  @ApiProperty({ type: [CuadreResponseDto] })
  data!: CuadreResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  hasMore!: boolean;

  @ApiPropertyOptional()
  nextCursor?: string;
}
