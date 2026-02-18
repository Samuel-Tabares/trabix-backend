import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../auth/decorators/current-user.decorator';

// DTOs
import {
  RegistrarSalidaDto,
  QueryTransaccionesDto,
  SaldoFondoResponseDto,
  TransaccionesPaginadasDto,
  MovimientoFondoResponseDto,
} from '../application/dto';

// Commands
import { RegistrarSalidaFondoCommand } from '../application/commands';

// Queries
import { ObtenerSaldoFondoQuery, ListarTransaccionesFondoQuery } from '../application/queries';

/**
 * Controlador del Fondo de Recompensas
 * Según sección 12 del documento
 *
 * Endpoints:
 * - GET /saldo           - Obtener saldo actual (todos autenticados)
 * - GET /transacciones   - Listar transacciones (todos autenticados)
 * - POST /salida         - Registrar salida/premio (solo admin)
 *
 * El fondo se alimenta automáticamente al activar lotes.
 * Las salidas son premios/bonos que el admin otorga a vendedores destacados.
 */
@ApiTags('Fondo Recompensas')
@ApiBearerAuth('access-token')
@Controller('fondo-recompensas')
export class FondoRecompensasController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * GET /fondo-recompensas/saldo
   * Obtener saldo actual del fondo
   * Disponible para todos los usuarios autenticados
   */
  @Get('saldo')
  @ApiOperation({
    summary: 'Obtener saldo actual del fondo',
    description:
      'Retorna el saldo disponible en el fondo de recompensas. Disponible para todos los usuarios autenticados.',
  })
  @ApiResponse({ status: 200, type: SaldoFondoResponseDto })
  async obtenerSaldo(): Promise<SaldoFondoResponseDto> {
    return this.queryBus.execute(new ObtenerSaldoFondoQuery());
  }

  /**
   * GET /fondo-recompensas/transacciones
   * Listar transacciones del fondo
   * Disponible para todos los usuarios autenticados
   */
  @Get('transacciones')
  @ApiOperation({
    summary: 'Listar transacciones del fondo',
    description:
      'Lista todas las entradas y salidas del fondo. Disponible para todos los usuarios autenticados.',
  })
  @ApiResponse({ status: 200, type: TransaccionesPaginadasDto })
  async listarTransacciones(
    @Query() queryDto: QueryTransaccionesDto,
  ): Promise<TransaccionesPaginadasDto> {
    return this.queryBus.execute(new ListarTransaccionesFondoQuery(queryDto));
  }

  /**
   * POST /fondo-recompensas/salida
   * Registrar una salida (premio/bono a vendedor)
   * Solo admin puede realizar esta operación
   */
  @Post('salida')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar salida del fondo (admin)',
    description:
      'Registra un premio o bono para un vendedor. Requiere especificar el vendedor beneficiario. El vendedor será notificado.',
  })
  @ApiResponse({ status: 201, type: MovimientoFondoResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos o saldo insuficiente' })
  @ApiResponse({ status: 404, description: 'Vendedor beneficiario no encontrado' })
  async registrarSalida(
    @Body() dto: RegistrarSalidaDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<MovimientoFondoResponseDto> {
    const movimiento = await this.commandBus.execute(
      new RegistrarSalidaFondoCommand(
        new Decimal(dto.monto),
        dto.concepto,
        dto.vendedorBeneficiarioId,
        admin.id,
      ),
    );

    return {
      id: movimiento.id,
      tipo: movimiento.tipo,
      monto: Number.parseFloat(movimiento.monto.toFixed(2)),
      concepto: movimiento.concepto,
      vendedorBeneficiarioId: movimiento.vendedorBeneficiarioId,
      fechaTransaccion: movimiento.fechaTransaccion,
    };
  }
}
