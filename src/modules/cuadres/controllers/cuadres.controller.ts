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
    CuadreResponseDto,
    CuadresPaginadosDto,
} from '../application/dto/cuadre-response.dto';
import {
    QueryCuadresDto,
} from '../application/dto/query-cuadres.dto';
import {
    ConfirmarCuadreDto,
} from '../application/dto/confirmar-cuadre.dto';

// Commands
import { ConfirmarCuadreCommand } from '../application/commands';

// Queries
import {
    ObtenerCuadreQuery,
    ListarCuadresQuery,
} from '../application/queries';

/**
 * Controlador de Cuadres
 * Según sección 20.8 del documento
 *
 * Endpoints:
 * - GET /         - Listar cuadres
 * - GET /:id      - Obtener cuadre
 * - POST /:id/confirmar - Confirmar cuadre exitoso (admin)
 *
 * Permisos:
 * - Vendedor/Reclutador: solo ve sus propios cuadres en estado PENDIENTE o EXITOSO
 * - Admin: ve todos los cuadres en cualquier estado
 */
@ApiTags('Cuadres')
@ApiBearerAuth('access-token')
@Controller('cuadres')
export class CuadresController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
    ) {}

    /**
     * GET /cuadres
     * Lista cuadres con filtros y paginación
     *
     * REGLA DE VISIBILIDAD:
     * - Admin: puede ver todos los estados
     * - Vendedor/Reclutador: solo ve PENDIENTE y EXITOSO (NO ve INACTIVO)
     */
    @Get()
    @ApiOperation({ summary: 'Listar cuadres' })
    @ApiResponse({
        status: 200,
        description: 'Lista de cuadres',
        type: CuadresPaginadosDto,
    })
    async listar(
        @Query() queryDto: QueryCuadresDto,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<CuadresPaginadosDto> {
        // Si no es admin, aplicar restricciones
        if (user.rol !== 'ADMIN') {
            // Solo ve sus propios cuadres
            queryDto.vendedorId = user.id;

            // Si el vendedor intenta filtrar por INACTIVO, retornar vacío
            // ya que no tiene permiso de ver cuadres inactivos
            if (queryDto.estado === 'INACTIVO') {
                return {
                    data: [],
                    total: 0,
                    hasMore: false,
                };
            }
        }

        const resultado = await this.queryBus.execute(new ListarCuadresQuery(queryDto));

        // Para vendedores, filtrar cuadres INACTIVO del resultado
        // (esto cubre el caso donde no se especificó filtro de estado)
        if (user.rol !== 'ADMIN') {
            const cuadresFiltrados = resultado.data.filter(
                (c: CuadreResponseDto) => c.estado !== 'INACTIVO',
            );
            return {
                data: cuadresFiltrados,
                total: cuadresFiltrados.length,
                hasMore: false, // Simplificado ya que filtramos en memoria
                nextCursor: undefined,
            };
        }

        return resultado;
    }

    /**
     * GET /cuadres/:id
     * Obtiene un cuadre por ID
     *
     * VERIFICACIÓN DE ACCESO:
     * - Admin: puede ver cualquier cuadre
     * - Vendedor: solo puede ver sus propios cuadres en estado PENDIENTE o EXITOSO
     */
    @Get(':id')
    @ApiOperation({ summary: 'Obtener cuadre' })
    @ApiParam({ name: 'id', description: 'ID del cuadre' })
    @ApiResponse({
        status: 200,
        description: 'Datos del cuadre',
        type: CuadreResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Cuadre no encontrado' })
    async obtener(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<CuadreResponseDto> {
        const cuadre = await this.queryBus.execute(new ObtenerCuadreQuery(id));

        // Verificar acceso para usuarios no admin
        if (user.rol !== 'ADMIN') {
            // Verificar que es el dueño del cuadre
            if (cuadre.vendedorId !== user.id) {
                throw new DomainException(
                    'CUA_005',
                    'Cuadre no encontrado',
                    { cuadreId: id },
                );
            }

            // Verificar que el estado sea visible para el vendedor
            if (cuadre.estado === 'INACTIVO') {
                throw new DomainException(
                    'CUA_005',
                    'Cuadre no encontrado',
                    { cuadreId: id },
                );
            }
        }

        return cuadre;
    }

    /**
     * POST /cuadres/:id/confirmar
     * Confirma un cuadre como exitoso (admin)
     */
    @Post(':id/confirmar')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Confirmar cuadre exitoso (admin)' })
    @ApiParam({ name: 'id', description: 'ID del cuadre' })
    @ApiResponse({
        status: 200,
        description: 'Cuadre confirmado exitosamente',
        type: CuadreResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Cuadre no encontrado' })
    @ApiResponse({ status: 409, description: 'El cuadre no está en estado PENDIENTE o monto insuficiente' })
    async confirmar(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ConfirmarCuadreDto,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<CuadreResponseDto> {
        await this.commandBus.execute(
            new ConfirmarCuadreCommand(id, dto.montoRecibido, admin.id),
        );
        return this.queryBus.execute(new ObtenerCuadreQuery(id));
    }
}