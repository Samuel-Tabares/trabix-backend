import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
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

// DTOs
import {
    ModificarConfiguracionDto,
    ConfiguracionResponseDto,
    CrearTipoInsumoDto,
    ModificarTipoInsumoDto,
    TipoInsumoResponseDto,
} from '../../admin/application/dto';

// Commands
import {
    ModificarConfiguracionCommand,
    CrearTipoInsumoCommand,
    ModificarTipoInsumoCommand,
    DesactivarTipoInsumoCommand,
} from '../../admin/application/commands';

// Queries
import {
    ListarConfiguracionesQuery,
    ObtenerConfiguracionQuery,
    ObtenerHistorialConfiguracionQuery,
    ListarTiposInsumoQuery,
} from '../../admin/application/queries';

/**
 * Controller de Configuraciones
 */
@ApiTags('Admin - Configuraciones')
@ApiBearerAuth('access-token')
@Controller('admin/configuraciones')
@Roles('ADMIN')
export class ConfiguracionesController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
    ) {}

    /**
     * GET /admin/configuraciones
     * Listar todas las configuraciones
     */
    @Get()
    @ApiOperation({ summary: 'Listar todas las configuraciones' })
    @ApiResponse({ status: 200, type: [ConfiguracionResponseDto] })
    async listar(): Promise<ConfiguracionResponseDto[]> {
        return this.queryBus.execute(new ListarConfiguracionesQuery());
    }

    /**
     * GET /admin/configuraciones/categoria/:categoria
     * Listar configuraciones por categoría
     */
    @Get('categoria/:categoria')
    @ApiOperation({ summary: 'Listar configuraciones por categoría' })
    @ApiParam({ name: 'categoria', description: 'Categoría (PRECIOS, PORCENTAJES, EQUIPAMIENTO, TIEMPOS)' })
    @ApiResponse({ status: 200, type: [ConfiguracionResponseDto] })
    async listarPorCategoria(
        @Param('categoria') categoria: string,
    ): Promise<ConfiguracionResponseDto[]> {
        return this.queryBus.execute(new ListarConfiguracionesQuery(categoria.toUpperCase()));
    }

    /**
     * GET /admin/configuraciones/historial
     * Ver historial de cambios
     */
    @Get('historial')
    @ApiOperation({ summary: 'Ver historial de cambios' })
    async obtenerHistorial(
        @Query('skip') skip?: number,
        @Query('take') take?: number,
    ): Promise<any> {
        return this.queryBus.execute(
            new ObtenerHistorialConfiguracionQuery(undefined, skip, take),
        );
    }

    /**
     * GET /admin/configuraciones/historial/:clave
     * Ver historial de una configuración
     */
    @Get('historial/:clave')
    @ApiOperation({ summary: 'Ver historial de una configuración' })
    @ApiParam({ name: 'clave', description: 'Clave de la configuración' })
    async obtenerHistorialPorClave(
        @Param('clave') clave: string,
        @Query('skip') skip?: number,
        @Query('take') take?: number,
    ): Promise<any> {
        return this.queryBus.execute(
            new ObtenerHistorialConfiguracionQuery(clave, skip, take),
        );
    }

    /**
     * GET /admin/configuraciones/:clave
     * Obtener configuración específica
     */
    @Get(':clave')
    @ApiOperation({ summary: 'Obtener configuración específica' })
    @ApiParam({ name: 'clave', description: 'Clave de la configuración' })
    @ApiResponse({ status: 200, type: ConfiguracionResponseDto })
    async obtener(@Param('clave') clave: string): Promise<ConfiguracionResponseDto> {
        return this.queryBus.execute(new ObtenerConfiguracionQuery(clave));
    }

    /**
     * PATCH /admin/configuraciones/:clave
     * Modificar valor de configuración
     */
    @Patch(':clave')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Modificar valor de configuración' })
    @ApiParam({ name: 'clave', description: 'Clave de la configuración' })
    @ApiResponse({ status: 200, type: ConfiguracionResponseDto })
    async modificar(
        @Param('clave') clave: string,
        @Body() dto: ModificarConfiguracionDto,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<ConfiguracionResponseDto> {
        await this.commandBus.execute(
            new ModificarConfiguracionCommand(clave, dto.valor, admin.id, dto.motivo),
        );
        return this.queryBus.execute(new ObtenerConfiguracionQuery(clave));
    }
}

/**
 * Controller de Tipos de Insumo
 */
@ApiTags('Admin - Tipos de Insumo')
@ApiBearerAuth('access-token')
@Controller('admin/tipos-insumo')
@Roles('ADMIN')
export class TiposInsumoController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
    ) {}

    /**
     * POST /admin/tipos-insumo
     * Crear nuevo tipo de insumo
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Crear nuevo tipo de insumo' })
    @ApiResponse({ status: 201, type: TipoInsumoResponseDto })
    async crear(@Body() dto: CrearTipoInsumoDto): Promise<TipoInsumoResponseDto> {
        const tipoInsumo = await this.commandBus.execute(
            new CrearTipoInsumoCommand(dto.nombre, dto.esObligatorio),
        );

        return {
            id: tipoInsumo.id,
            nombre: tipoInsumo.nombre,
            esObligatorio: tipoInsumo.esObligatorio,
            activo: tipoInsumo.activo,
            fechaCreacion: tipoInsumo.fechaCreacion,
        };
    }

    /**
     * GET /admin/tipos-insumo
     * Listar tipos de insumo
     */
    @Get()
    @ApiOperation({ summary: 'Listar tipos de insumo' })
    @ApiResponse({ status: 200, type: [TipoInsumoResponseDto] })
    async listar(@Query('activo') activo?: string): Promise<TipoInsumoResponseDto[]> {
        const activoBoolean = activo === 'true' ? true : activo === 'false' ? false : undefined;
        return this.queryBus.execute(new ListarTiposInsumoQuery(activoBoolean));
    }

    /**
     * PATCH /admin/tipos-insumo/:id
     * Modificar tipo de insumo
     */
    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Modificar tipo de insumo' })
    @ApiParam({ name: 'id', description: 'ID del tipo de insumo' })
    @ApiResponse({ status: 200, type: TipoInsumoResponseDto })
    async modificar(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ModificarTipoInsumoDto,
    ): Promise<TipoInsumoResponseDto> {
        const tipoInsumo = await this.commandBus.execute(
            new ModificarTipoInsumoCommand(id, dto.nombre),
        );

        return {
            id: tipoInsumo.id,
            nombre: tipoInsumo.nombre,
            esObligatorio: tipoInsumo.esObligatorio,
            activo: tipoInsumo.activo,
            fechaCreacion: tipoInsumo.fechaCreacion,
        };
    }

    /**
     * DELETE /admin/tipos-insumo/:id
     * Desactivar tipo de insumo
     */
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Desactivar tipo de insumo' })
    @ApiParam({ name: 'id', description: 'ID del tipo de insumo' })
    @ApiResponse({ status: 200, type: TipoInsumoResponseDto })
    async desactivar(@Param('id', ParseUUIDPipe) id: string): Promise<TipoInsumoResponseDto> {
        const tipoInsumo = await this.commandBus.execute(new DesactivarTipoInsumoCommand(id));

        return {
            id: tipoInsumo.id,
            nombre: tipoInsumo.nombre,
            esObligatorio: tipoInsumo.esObligatorio,
            activo: tipoInsumo.activo,
            fechaCreacion: tipoInsumo.fechaCreacion,
        };
    }
}