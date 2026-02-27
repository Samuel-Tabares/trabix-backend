import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Rol, EstadoUsuario } from '@prisma/client';

/**
 * DTO de respuesta para usuario
 */
export class UsuarioResponseDto {
  @ApiProperty({ description: 'ID único del usuario' })
  id!: string;

  @ApiProperty({ description: 'Cédula del usuario (número)', example: 1234567890 })
  cedula!: number;

  @ApiProperty({ description: 'Nombre del usuario' })
  nombre!: string;

  @ApiProperty({ description: 'Apellidos del usuario' })
  apellidos!: string;

  @ApiProperty({ description: 'Nombre completo del usuario' })
  nombreCompleto!: string;

  @ApiProperty({ description: 'Email del usuario' })
  email!: string;

  @ApiProperty({ description: 'Teléfono del usuario' })
  telefono!: string;

  @ApiProperty({ enum: ['ADMIN', 'VENDEDOR', 'RECLUTADOR'] })
  rol!: Rol;

  @ApiProperty({ enum: ['ACTIVO', 'INACTIVO'] })
  estado!: EstadoUsuario;

  @ApiProperty({ description: 'Indica si requiere cambiar contraseña' })
  requiereCambioPassword!: boolean;

  @ApiPropertyOptional({ description: 'ID del reclutador' })
  reclutadorId?: string | null;

  @ApiPropertyOptional({ description: 'Datos del reclutador' })
  reclutador?: UsuarioBasicoDto | null;

  @ApiProperty({ description: 'Fecha de creación' })
  fechaCreacion!: Date;

  @ApiPropertyOptional({ description: 'Último login' })
  ultimoLogin?: Date | null;

  @ApiPropertyOptional({ description: 'Fecha del último cambio de estado' })
  fechaCambioEstado?: Date | null;

  @ApiPropertyOptional({ description: 'Fecha hasta la que el usuario está bloqueado (null = no bloqueado)' })
  bloqueadoHasta?: Date | null;

  @ApiProperty({ description: 'Modelo de negocio aplicable' })
  modeloNegocio!: '60_40' | '50_50';
}

/**
 * DTO básico de usuario (para referencias)
 */
export class UsuarioBasicoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  apellidos!: string;

  @ApiProperty()
  nombreCompleto!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ['ADMIN', 'VENDEDOR', 'RECLUTADOR'] })
  rol!: Rol;
}

/**
 * DTO para resumen de ganancias de un vendedor
 * Transparencia para reclutadores
 */
export class ResumenGananciasDto {
  @ApiProperty({ description: 'Total de ventas aprobadas' })
  totalVentas!: number;

  @ApiProperty({ description: 'Total de TRABIX vendidos' })
  trabixVendidos!: number;

  @ApiProperty({ description: 'Ingresos totales generados (monto bruto)' })
  ingresosBrutos!: number;

  @ApiProperty({ description: 'Ganancias del vendedor' })
  gananciasVendedor!: number;

  @ApiProperty({ description: 'Lotes activos actualmente' })
  lotesActivos!: number;

  @ApiProperty({ description: 'Lotes finalizados' })
  lotesFinalizados!: number;
}

/**
 * DTO para jerarquía de usuario con ganancias
 */
export class UsuarioJerarquiaDto {
  @ApiProperty({ type: UsuarioBasicoDto })
  usuario!: UsuarioBasicoDto;

  @ApiPropertyOptional({
    type: ResumenGananciasDto,
    description: 'Resumen de ganancias del vendedor (solo visible para reclutadores de la rama)',
  })
  ganancias?: ResumenGananciasDto;

  @ApiProperty({ type: [UsuarioJerarquiaDto] })
  reclutados!: UsuarioJerarquiaDto[];

  @ApiProperty({ description: 'Total de reclutados en toda la rama' })
  totalReclutados!: number;

  @ApiProperty({ description: 'Nivel en la jerarquía (0 = raíz)' })
  nivel!: number;
}

/**
 * DTO para lista paginada de usuarios
 */
export class UsuariosPaginadosDto {
  @ApiProperty({ type: [UsuarioResponseDto] })
  data!: UsuarioResponseDto[];

  @ApiProperty({ description: 'Total de registros' })
  total!: number;

  @ApiProperty({ description: 'Indica si hay más resultados' })
  hasMore!: boolean;

  @ApiPropertyOptional({ description: 'Cursor para siguiente página' })
  nextCursor?: string;
}
