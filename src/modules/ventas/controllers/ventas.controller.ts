import {
  Controller,
  Get,
  Post,
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
import { CreateVentaDto } from '../application/dto/create-venta.dto';
import { QueryVentasDto } from '../application/dto/query-ventas.dto';
import { VentaResponseDto, VentasPaginadasDto } from '../application/dto/venta-response.dto';

// Commands
import { RegistrarVentaCommand } from '../application/commands/registrar-venta.command';

// Queries
import { ObtenerVentaQuery, ListarVentasQuery } from '../application/queries';

/**
 * Controlador de Ventas
 *
 * Endpoints:
 * - POST /        - Registrar venta (vendedor/reclutador)
 * - GET /         - Listar ventas
 * - GET /:id      - Obtener venta
 */
@ApiTags('Ventas')
@ApiBearerAuth('access-token')
@Controller('ventas')
export class VentasController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * POST /ventas
   * Registra y confirma una nueva venta automáticamente.
   * El vendedor/reclutador debe confirmar antes de enviar (no hay vuelta atrás).
   */
  @Post()
  @Roles('VENDEDOR', 'RECLUTADOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar venta' })
  @ApiResponse({
    status: 201,
    description: 'Venta registrada y confirmada exitosamente',
    type: VentaResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Stock insuficiente o límite de regalos excedido' })
  async registrar(
    @Body() createDto: CreateVentaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VentaResponseDto> {
    const venta = await this.commandBus.execute(new RegistrarVentaCommand(user.id, createDto));
    return this.queryBus.execute(new ObtenerVentaQuery(venta.id));
  }

  /**
   * GET /ventas
   * Lista ventas con filtros y paginación.
   * Admin ve todas; vendedor/reclutador solo las propias.
   */
  @Get()
  @ApiOperation({ summary: 'Listar ventas' })
  @ApiResponse({
    status: 200,
    description: 'Lista de ventas',
    type: VentasPaginadasDto,
  })
  async listar(
    @Query() queryDto: QueryVentasDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VentasPaginadasDto> {
    if (user.rol !== 'ADMIN') {
      queryDto.vendedorId = user.id;
    }
    return this.queryBus.execute(new ListarVentasQuery(queryDto));
  }

  /**
   * GET /ventas/:id
   * Obtiene una venta por ID.
   * Admin puede ver cualquier venta; vendedor solo las propias.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Obtener venta' })
  @ApiParam({ name: 'id', description: 'ID de la venta' })
  @ApiResponse({
    status: 200,
    description: 'Datos de la venta',
    type: VentaResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VentaResponseDto> {
    const venta = await this.queryBus.execute(new ObtenerVentaQuery(id));

    if (user.rol !== 'ADMIN' && venta.vendedorId !== user.id) {
      throw new DomainException('VNT_003', 'Venta no encontrada', { ventaId: id });
    }

    return venta;
  }
}
