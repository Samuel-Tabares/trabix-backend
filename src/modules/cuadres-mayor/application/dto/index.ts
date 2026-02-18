import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoCuadre, ModalidadVentaMayor } from '@prisma/client';

// ========== QueryCuadresMayorDto ==========

export class QueryCuadresMayorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  vendedorId?: string;

  @ApiPropertyOptional({ enum: ['PENDIENTE', 'EXITOSO'] })
  @IsOptional()
  @IsEnum(['PENDIENTE', 'EXITOSO'])
  estado?: EstadoCuadre;

  @ApiPropertyOptional({ enum: ['ANTICIPADO', 'CONTRAENTREGA'] })
  @IsOptional()
  @IsEnum(['ANTICIPADO', 'CONTRAENTREGA'])
  modalidad?: ModalidadVentaMayor;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  cursor?: string;
}

// ========== GananciaReclutadorResponseDto ==========

export class GananciaReclutadorResponseDto {
  @ApiProperty()
  reclutadorId!: string;

  @ApiProperty()
  nivel!: number;

  @ApiProperty()
  monto!: number;

  @ApiProperty()
  transferido!: boolean;
}

// ========== EvaluacionFinancieraResponseDto ==========

export class EvaluacionFinancieraResponseDto {
  @ApiProperty()
  dineroRecaudadoDetal!: number;

  @ApiProperty()
  dineroVentaMayor!: number;

  @ApiProperty()
  dineroTotalDisponible!: number;

  @ApiProperty()
  inversionAdminTotal!: number;

  @ApiProperty()
  inversionVendedorTotal!: number;

  @ApiProperty()
  gananciaNeta!: number;

  @ApiProperty()
  gananciaAdmin!: number;

  @ApiProperty()
  gananciaVendedor!: number;

  @ApiProperty()
  deudasSaldadas!: number;
}

// ========== TandaAfectadaResponseDto ==========

export class TandaAfectadaResponseDto {
  @ApiProperty()
  tandaId!: string;

  @ApiProperty()
  cantidadStockConsumido!: number;
}

// ========== CuadreMayorResponseDto ==========

export class CuadreMayorResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ventaMayorId!: string;

  @ApiProperty()
  vendedorId!: string;

  @ApiProperty({ enum: ['ANTICIPADO', 'CONTRAENTREGA'] })
  modalidad!: ModalidadVentaMayor;

  @ApiProperty({ enum: ['PENDIENTE', 'EXITOSO'] })
  estado!: EstadoCuadre;

  @ApiProperty()
  cantidadUnidades!: number;

  @ApiProperty()
  precioUnidad!: number;

  @ApiProperty()
  ingresoBruto!: number;

  @ApiProperty()
  deudasSaldadas!: number;

  @ApiProperty()
  inversionAdminLotesExistentes!: number;

  @ApiProperty()
  inversionAdminLoteForzado!: number;

  @ApiProperty()
  inversionVendedorLotesExistentes!: number;

  @ApiProperty()
  inversionVendedorLoteForzado!: number;

  @ApiProperty()
  gananciasAdmin!: number;

  @ApiProperty()
  gananciasVendedor!: number;

  @ApiProperty({ type: EvaluacionFinancieraResponseDto })
  evaluacionFinanciera!: EvaluacionFinancieraResponseDto;

  @ApiProperty()
  montoTotalAdmin!: number;

  @ApiProperty()
  montoTotalVendedor!: number;

  @ApiProperty({ type: [String] })
  lotesInvolucradosIds!: string[];

  @ApiProperty({ type: [TandaAfectadaResponseDto] })
  tandasAfectadas!: TandaAfectadaResponseDto[];

  @ApiProperty({ type: [String] })
  cuadresCerradosIds!: string[];

  @ApiPropertyOptional()
  loteForzadoId?: string | null;

  @ApiProperty({ type: [GananciaReclutadorResponseDto] })
  gananciasReclutadores!: GananciaReclutadorResponseDto[];

  @ApiProperty()
  fechaRegistro!: Date;

  @ApiPropertyOptional()
  fechaExitoso?: Date | null;
}

// ========== CuadresMayorPaginadosDto ==========

export class CuadresMayorPaginadosDto {
  @ApiProperty({ type: [CuadreMayorResponseDto] })
  data!: CuadreMayorResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  hasMore!: boolean;

  @ApiPropertyOptional()
  nextCursor?: string;
}
