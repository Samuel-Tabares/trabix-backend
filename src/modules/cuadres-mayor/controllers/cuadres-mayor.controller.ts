import {
    Controller,
    Get,
    Post,
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
    QueryCuadresMayorDto,
    CuadreMayorResponseDto,
    CuadresMayorPaginadosDto,
} from '../application/dto';

// Commands
import { ConfirmarCuadreMayorCommand } from '../application/commands';

// Queries
import {
    ObtenerCuadreMayorQuery,
    ListarCuadresMayorQuery,
} from '../application/queries';

/**
 * Controlador de Cuadres al Mayor
 * Según sección 20.9 del documento
 *
 * Endpoints:
 * - GET /              - Listar cuadres al mayor
 * - GET /:id           - Obtener cuadre al mayor
 * - POST /:id/confirmar - Confirmar cuadre al mayor (admin)
 *
 * Permisos:
 * - Vendedor/Reclutador: solo ve sus propios cuadres al mayor
 * - Admin: ve todos los cuadres al mayor
 */
@ApiTags('Cuadres Mayor')
@ApiBearerAuth('access-token')
@Controller('cuadres-mayor')
export class CuadresMayorController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
    ) {}

    /**
     * GET /cuadres-mayor
     * Lista cuadres al mayor
     */
    @Get()
    @ApiOperation({ summary: 'Listar cuadres al mayor' })
    @ApiResponse({
        status: 200,
        description: 'Lista de cuadres al mayor',
        type: CuadresMayorPaginadosDto,
    })
    async listar(
        @Query() queryDto: QueryCuadresMayorDto,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<CuadresMayorPaginadosDto> {
        // Si no es admin, solo ve sus propios cuadres
        if (user.rol !== 'ADMIN') {
            queryDto.vendedorId = user.id;
        }
        return this.queryBus.execute(new ListarCuadresMayorQuery(queryDto));
    }

    /**
     * GET /cuadres-mayor/:id
     * Obtiene un cuadre al mayor por ID
     */
    @Get(':id')
    @ApiOperation({ summary: 'Obtener cuadre al mayor' })
    @ApiParam({ name: 'id', description: 'ID del cuadre al mayor' })
    @ApiResponse({
        status: 200,
        description: 'Datos del cuadre al mayor',
        type: CuadreMayorResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Cuadre no encontrado' })
    async obtener(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<CuadreMayorResponseDto> {
        const cuadre = await this.queryBus.execute(new ObtenerCuadreMayorQuery(id));

        // Verificar acceso: admin o dueño del cuadre
        if (user.rol !== 'ADMIN' && cuadre.vendedorId !== user.id) {
            throw new DomainException(
                'CMA_003',
                'Cuadre al mayor no encontrado',
                { cuadreMayorId: id },
            );
        }

        return cuadre;
    }

    /**
     * POST /cuadres-mayor/:id/confirmar
     * Confirma un cuadre al mayor (admin)
     */
    @Post(':id/confirmar')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Confirmar cuadre al mayor (admin)' })
    @ApiParam({ name: 'id', description: 'ID del cuadre al mayor' })
    @ApiResponse({
        status: 200,
        description: 'Cuadre confirmado',
        type: CuadreMayorResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Cuadre no encontrado' })
    @ApiResponse({ status: 409, description: 'El cuadre no está pendiente' })
    async confirmar(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<CuadreMayorResponseDto> {
        if (!admin) throw new UnauthorizedException();

        await this.commandBus.execute(new ConfirmarCuadreMayorCommand(id, admin.id));
        return this.queryBus.execute(new ObtenerCuadreMayorQuery(id));
    }
}