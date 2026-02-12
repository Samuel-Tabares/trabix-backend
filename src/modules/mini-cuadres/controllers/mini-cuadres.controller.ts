import {
    Controller,
    Get,
    Post,
    Param,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
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
import { MiniCuadreResponseDto } from '../application/dto';

// Commands
import { ConfirmarMiniCuadreCommand } from '../application/commands';

// Queries
import {
    ObtenerMiniCuadrePorLoteQuery,
    ObtenerMiniCuadreQuery,
} from '../application/queries';

/**
 * Controlador de Mini-Cuadres
 * Según sección 20.10 del documento
 *
 * Endpoints:
 * - GET /lote/:loteId    - Obtener mini-cuadre de lote
 * - GET /:id             - Obtener mini-cuadre por ID
 * - POST /:id/confirmar  - Confirmar mini-cuadre (admin)
 *
 * Permisos:
 * - Vendedor/Reclutador: solo ve el mini-cuadre de sus propios lotes en estado PENDIENTE o EXITOSO
 * - Admin: ve todos los mini-cuadres en cualquier estado
 */
@ApiTags('Mini-Cuadres')
@ApiBearerAuth('access-token')
@Controller('mini-cuadres')
export class MiniCuadresController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
    ) {}

    /**
     * GET /mini-cuadres/lote/:loteId
     * Obtiene el mini-cuadre de un lote
     *
     * REGLA DE VISIBILIDAD:
     * - Admin: puede ver cualquier estado
     * - Vendedor: solo puede ver PENDIENTE y EXITOSO (NO ve INACTIVO)
     */
    @Get('lote/:loteId')
    @ApiOperation({ summary: 'Obtener mini-cuadre de lote' })
    @ApiParam({ name: 'loteId', description: 'ID del lote' })
    @ApiResponse({
        status: 200,
        description: 'Datos del mini-cuadre',
        type: MiniCuadreResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Mini-cuadre no encontrado' })
    async obtenerPorLote(
        @Param('loteId', ParseUUIDPipe) loteId: string,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<MiniCuadreResponseDto> {
        const miniCuadre = await this.queryBus.execute(
            new ObtenerMiniCuadrePorLoteQuery(loteId),
        );

        // Verificar acceso para usuarios no admin
        if (user.rol !== 'ADMIN') {
            // Verificar que es el dueño del lote
            if (!miniCuadre.lote || miniCuadre.lote.vendedorId !== user.id) {
                throw new DomainException(
                    'MCU_005',
                    'Mini-cuadre no encontrado',
                    { loteId },
                );
            }

            // Verificar que el estado sea visible para el vendedor
            if (miniCuadre.estado === 'INACTIVO') {
                throw new DomainException(
                    'MCU_005',
                    'Mini-cuadre no encontrado',
                    { loteId },
                );
            }
        }

        return miniCuadre;
    }

    /**
     * GET /mini-cuadres/:id
     * Obtiene un mini-cuadre por ID
     *
     * REGLA DE VISIBILIDAD:
     * - Admin: puede ver cualquier estado
     * - Vendedor: solo puede ver PENDIENTE y EXITOSO (NO ve INACTIVO)
     */
    @Get(':id')
    @ApiOperation({ summary: 'Obtener mini-cuadre por ID' })
    @ApiParam({ name: 'id', description: 'ID del mini-cuadre' })
    @ApiResponse({
        status: 200,
        description: 'Datos del mini-cuadre',
        type: MiniCuadreResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Mini-cuadre no encontrado' })
    async obtenerPorId(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<MiniCuadreResponseDto> {
        const miniCuadre = await this.queryBus.execute(new ObtenerMiniCuadreQuery(id));

        // Verificar acceso para usuarios no admin
        if (user.rol !== 'ADMIN') {
            // Verificar que es el dueño del lote
            if (!miniCuadre.lote || miniCuadre.lote.vendedorId !== user.id) {
                throw new DomainException(
                    'MCU_005',
                    'Mini-cuadre no encontrado',
                    { miniCuadreId: id },
                );
            }

            // Verificar que el estado sea visible para el vendedor
            if (miniCuadre.estado === 'INACTIVO') {
                throw new DomainException(
                    'MCU_005',
                    'Mini-cuadre no encontrado',
                    { miniCuadreId: id },
                );
            }
        }

        return miniCuadre;
    }

    /**
     * POST /mini-cuadres/:id/confirmar
     * Confirma un mini-cuadre (admin)
     */
    @Post(':id/confirmar')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Confirmar mini-cuadre (admin)' })
    @ApiParam({ name: 'id', description: 'ID del mini-cuadre' })
    @ApiResponse({
        status: 200,
        description: 'Mini-cuadre confirmado',
        type: MiniCuadreResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Mini-cuadre no encontrado' })
    @ApiResponse({ status: 409, description: 'El mini-cuadre no está pendiente' })
    async confirmar(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<MiniCuadreResponseDto> {
        await this.commandBus.execute(new ConfirmarMiniCuadreCommand(id, admin.id));
        return this.queryBus.execute(new ObtenerMiniCuadreQuery(id));
    }
}