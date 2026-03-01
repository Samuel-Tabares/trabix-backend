import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../auth/decorators/current-user.decorator';
import { DomainException } from '../../../domain/exceptions/domain.exception';

// DTOs
import { QueryVentasMayorDto } from '../application/dto/query-ventas-mayor.dto';
import {
  VentaMayorResponseDto,
  VentasMayorPaginadasDto,
  StockDisponibleResponseDto,
} from '../application/dto/venta-mayor-response.dto';

// Commands
import {
  RegistrarVentaMayorCommand,
  ConfirmarVentaMayorCommand,
  EliminarVentaMayorCommand,
} from '../application/commands';
import { Idempotent } from '../../../presentation/http/decorators/idempotent.decorator';

// Queries
import {
  ObtenerVentaMayorQuery,
  ListarVentasMayorQuery,
  CalcularStockDisponibleQuery,
} from '../application/queries';
import { RegistrarVentaMayorDto } from '../application/dto/registrar-venta-mayor.dto';

/**
 * Controlador de Ventas al Mayor
 *
 * Endpoints:
 * - POST /             - Registrar venta al mayor (solo informativa)
 * - GET /              - Listar ventas al mayor
 * - GET /calcular-stock - Calcular stock disponible
 * - GET /:id           - Obtener venta al mayor
 * - POST /:id/confirmar - Confirma venta: crea CuadreMayor y marca COMPLETADA (admin)
 * - DELETE /:id        - Elimina venta PENDIENTE (admin)
 */
@ApiTags('Ventas Mayor')
@ApiBearerAuth('access-token')
@Controller('ventas-mayor')
export class VentasMayorController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * POST /ventas-mayor
   * Registra una venta al mayor (solo informativa — no crea CuadreMayor)
   */
  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar venta al mayor' })
  @ApiResponse({
    status: 201,
    description: 'Venta al mayor registrada',
    type: VentaMayorResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async registrar(@Body() dto: RegistrarVentaMayorDto): Promise<VentaMayorResponseDto> {
    const venta = await this.commandBus.execute(
      new RegistrarVentaMayorCommand(dto.vendedorId, dto.cantidadUnidades, dto.conLicor, dto.modalidad),
    );
    return this.queryBus.execute(new ObtenerVentaMayorQuery(venta.id));
  }

  /**
   * GET /ventas-mayor
   * Lista ventas al mayor
   */
  @Get()
  @ApiOperation({ summary: 'Listar ventas al mayor' })
  @ApiResponse({
    status: 200,
    description: 'Lista de ventas al mayor',
    type: VentasMayorPaginadasDto,
  })
  async listar(
    @Query() queryDto: QueryVentasMayorDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VentasMayorPaginadasDto> {
    // Si no es admin, solo ve sus propias ventas
    if (user.rol !== 'ADMIN') {
      queryDto.vendedorId = user.id;
    }
    return this.queryBus.execute(new ListarVentasMayorQuery(queryDto));
  }

  /**
   * GET /ventas-mayor/calcular-stock
   * Calcula el stock disponible para venta al mayor
   */
  @Get('calcular-stock')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Calcular stock disponible para un vendedor' })
  @ApiResponse({
    status: 200,
    description: 'Stock disponible calculado',
    type: StockDisponibleResponseDto,
  })
  async calcularStock(@Query('vendedorId') vendedorId: string): Promise<StockDisponibleResponseDto> {
    return this.queryBus.execute(new CalcularStockDisponibleQuery(vendedorId));
  }

  /**
   * GET /ventas-mayor/:id
   * Obtiene una venta al mayor por ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Obtener venta al mayor' })
  @ApiParam({ name: 'id', description: 'ID de la venta al mayor' })
  @ApiResponse({
    status: 200,
    description: 'Datos de la venta al mayor',
    type: VentaMayorResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VentaMayorResponseDto> {
    const venta = await this.queryBus.execute(new ObtenerVentaMayorQuery(id));

    // Verificar acceso: admin o dueño de la venta
    if (user.rol !== 'ADMIN' && venta.vendedorId !== user.id) {
      throw new DomainException('VTM_003', 'Venta al mayor no encontrada', { ventaMayorId: id });
    }

    return venta;
  }

  /**
   * POST /ventas-mayor/:id/confirmar
   * Confirma la venta: crea CuadreMayor con datos frescos y marca VentaMayor como COMPLETADA (admin)
   */
  @Post(':id/confirmar')
  @Roles('ADMIN')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar venta al mayor (admin)' })
  @ApiParam({ name: 'id', description: 'ID de la venta al mayor' })
  @ApiResponse({
    status: 200,
    description: 'Venta confirmada y CuadreMayor creado',
    type: VentaMayorResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  @ApiResponse({ status: 409, description: 'La venta no está pendiente' })
  async confirmar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<VentaMayorResponseDto> {
    const venta = await this.commandBus.execute(new ConfirmarVentaMayorCommand(id, admin.id));
    return venta ?? this.queryBus.execute(new ObtenerVentaMayorQuery(id));
  }

  /**
   * DELETE /ventas-mayor/:id
   * Elimina una venta al mayor PENDIENTE (sin side effects en stock ni finanzas)
   */
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar venta al mayor PENDIENTE (admin)' })
  @ApiParam({ name: 'id', description: 'ID de la venta al mayor' })
  @ApiResponse({ status: 204, description: 'Venta eliminada' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  @ApiResponse({ status: 409, description: 'La venta no está en estado PENDIENTE' })
  async eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(new EliminarVentaMayorCommand(id, admin.id));
  }
}
