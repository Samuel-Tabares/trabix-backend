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
    UnauthorizedException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
} from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../auth/decorators/current-user.decorator';
import { DomainException } from '../../../domain/exceptions/domain.exception';

// DTOs
import {
    CreateVentaDto,
} from '../application/dto/create-venta.dto';
import {
    QueryVentasDto,
} from '../application/dto/query-ventas.dto';
import {
    VentaResponseDto,
    VentasPaginadasDto,
} from '../application/dto/venta-response.dto';

// Commands
import {
    RegistrarVentaCommand,
} from '../application/commands/registrar-venta.command';
import {
    RechazarVentaCommand,
} from '../application/commands/rechazar-venta.command';
import {
    AprobarVentaCommand,
} from '../application/commands/aprobar-venta.command';

// Queries
import {
    ObtenerVentaQuery,
    ListarVentasQuery,
} from '../application/queries';

/**
 * Controlador de Ventas
 * Según sección 20.6 del documento
 *
 * Endpoints:
 * - POST /        - Registrar venta
 * - GET /         - Listar ventas
 * - GET /:id      - Obtener venta
 * - POST /:id/aprobar - Aprobar venta (admin)
 * - POST /:id/rechazar - Rechazar venta (admin)
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
     * Registra una nueva venta
     */
    @Post()
    
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Registrar venta' })
    @ApiResponse({
        status: 201,
        description: 'Venta registrada exitosamente (estado PENDIENTE)',
        type: VentaResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Datos inválidos' })
    @ApiResponse({ status: 409, description: 'Stock insuficiente o límite de regalos excedido' })
    async registrar(
        @Body() createDto: CreateVentaDto,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<VentaResponseDto> {
        const venta = await this.commandBus.execute(
            new RegistrarVentaCommand(user.id, createDto),
        );
        return this.queryBus.execute(new ObtenerVentaQuery(venta.id));
    }

    /**
     * GET /ventas
     * Lista ventas con filtros y paginación
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
        // Si no es admin, solo ve sus propias ventas
        if (user.rol !== 'ADMIN') {
            queryDto.vendedorId = user.id;
        }
        return this.queryBus.execute(new ListarVentasQuery(queryDto));
    }

    /**
     * GET /ventas/:id
     * Obtiene una venta por ID
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

        // Verificar acceso: admin o dueño de la venta
        if (user.rol !== 'ADMIN' && venta.vendedorId !== user.id) {
            throw new DomainException(
                'VNT_003',
                'Venta no encontrada',
                { ventaId: id },
            );
        }

        return venta;
    }

    /**
     * POST /ventas/:id/aprobar
     * Aprueba una venta (admin)
     */
    @Post(':id/aprobar')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Aprobar venta (admin)' })
    @ApiParam({ name: 'id', description: 'ID de la venta' })
    @ApiResponse({
        status: 200,
        description: 'Venta aprobada exitosamente',
        type: VentaResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Venta no encontrada' })
    @ApiResponse({ status: 409, description: 'La venta no está en estado PENDIENTE' })
    async aprobar(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<VentaResponseDto> {
        if (!admin) throw new UnauthorizedException();

        await this.commandBus.execute(new AprobarVentaCommand(id, admin.id));
        return this.queryBus.execute(new ObtenerVentaQuery(id));
    }

    /**
     * POST /ventas/:id/rechazar
     * Rechaza una venta (admin)
     */
    @Post(':id/rechazar')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Rechazar venta (admin)' })
    @ApiParam({ name: 'id', description: 'ID de la venta' })
    @ApiResponse({
        status: 200,
        description: 'Venta rechazada exitosamente',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({ status: 404, description: 'Venta no encontrada' })
    @ApiResponse({ status: 409, description: 'La venta no está en estado PENDIENTE' })
    async rechazar(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<{ message: string }> {
        if (!admin) throw new UnauthorizedException();

        return this.commandBus.execute(new RechazarVentaCommand(id, admin.id));
    }
}