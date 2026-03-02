import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoLote, ModeloNegocio, EstadoTanda } from '@prisma/client';

export class VendedorBasicoLoteDto {
  @ApiProperty() id!: string;
  @ApiProperty() nombre!: string;
  @ApiProperty() apellidos!: string;
}

/**
 * DTO de respuesta para tanda
 */
export class TandaResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  loteId!: string;

  @ApiProperty()
  numero!: number;

  @ApiProperty({ enum: ['INACTIVA', 'EN_TRANSITO', 'EN_CASA', 'FINALIZADA'] })
  estado!: EstadoTanda;

  @ApiProperty()
  stockInicial!: number;

  @ApiProperty()
  stockActual!: number;

  @ApiProperty()
  stockConsumidoPorMayor!: number;

  @ApiProperty()
  porcentajeStockRestante!: number;

  @ApiPropertyOptional()
  fechaLiberacion?: Date | null;

  @ApiPropertyOptional()
  fechaEnTransito?: Date | null;

  @ApiPropertyOptional()
  fechaEnCasa?: Date | null;

  @ApiPropertyOptional()
  fechaFinalizada?: Date | null;
}

/**
 * DTO de respuesta para lote
 */
export class LoteResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  vendedorId!: string;

  @ApiProperty()
  cantidadTrabix!: number;

  @ApiProperty({ enum: ['MODELO_60_40', 'MODELO_50_50'] })
  modeloNegocio!: ModeloNegocio;

  @ApiProperty({ enum: ['CREADO', 'ACTIVO', 'FINALIZADO'] })
  estado!: EstadoLote;

  @ApiProperty()
  inversionTotal!: number;

  @ApiProperty()
  inversionAdmin!: number;

  @ApiProperty()
  inversionVendedor!: number;

  @ApiProperty()
  dineroRecaudado!: number;

  @ApiProperty()
  dineroTransferido!: number;

  @ApiProperty()
  gananciaTotal!: number;

  @ApiProperty()
  porcentajeRecaudo!: number;

  @ApiProperty()
  inversionRecuperada!: boolean;

  @ApiProperty()
  esLoteForzado!: boolean;

  @ApiPropertyOptional()
  ventaMayorOrigenId?: string | null;

  @ApiProperty()
  numeroTandas!: number;

  @ApiProperty()
  maximoRegalos!: number;

  @ApiProperty({ type: [TandaResponseDto] })
  tandas!: TandaResponseDto[];

  @ApiProperty()
  fechaCreacion!: Date;

  @ApiPropertyOptional()
  fechaActivacion?: Date | null;

  @ApiPropertyOptional()
  fechaFinalizacion?: Date | null;

  @ApiPropertyOptional({ type: VendedorBasicoLoteDto })
  vendedor?: VendedorBasicoLoteDto | null;
}

/**
 * DTO para lista paginada de lotes
 */
export class LotesPaginadosDto {
  @ApiProperty({ type: [LoteResponseDto] })
  data!: LoteResponseDto[];

  @ApiProperty()
  total: any;
  @ApiProperty()
  hasMore!: boolean;

  @ApiPropertyOptional()
  nextCursor?: string;
}

/**
 * DTO para resumen financiero de un lote
 */
export class ResumenFinancieroDto {
  @ApiProperty()
  loteId!: string;

  @ApiProperty()
  cantidadTrabix!: number;

  @ApiProperty({ enum: ['MODELO_60_40', 'MODELO_50_50'] })
  modeloNegocio!: ModeloNegocio;

  @ApiProperty({ description: 'Inversión total del lote' })
  inversionTotal!: number;

  @ApiProperty({ description: 'Inversión del admin (50%)' })
  inversionAdmin!: number;

  @ApiProperty({ description: 'Inversión del vendedor (50%)' })
  inversionVendedor!: number;

  @ApiProperty({ description: 'Total recaudado en ventas' })
  dineroRecaudado!: number;

  @ApiProperty({ description: 'Total transferido al admin' })
  dineroTransferido!: number;

  @ApiProperty({ description: 'Pendiente por transferir' })
  pendientePorTransferir!: number;

  @ApiProperty({ description: 'Ganancia total (si aplica)' })
  gananciaTotal!: number;

  @ApiProperty({ description: 'Ganancia del vendedor' })
  gananciaVendedor!: number;

  @ApiProperty({ description: 'Ganancia del admin' })
  gananciaAdmin!: number;

  @ApiProperty({ description: 'Porcentaje de recaudo vs inversión' })
  porcentajeRecaudo!: number;

  @ApiProperty({ description: 'Indica si ya recuperó la inversión' })
  inversionRecuperada!: boolean;

  @ApiProperty({ description: 'Stock total disponible' })
  stockTotalDisponible!: number;

  @ApiProperty({ description: 'Stock total vendido' })
  stockTotalVendido!: number;

  @ApiProperty({ description: 'Regalos utilizados' })
  regalosUtilizados!: number;

  @ApiProperty({ description: 'Máximo de regalos permitidos' })
  maximoRegalos!: number;
}
