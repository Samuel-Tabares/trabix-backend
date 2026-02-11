import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
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

// Auth
import { CurrentUser, AuthenticatedUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';

// DTOs
import {
    UsuarioResponseDto,
    UsuariosPaginadosDto,
    UsuarioJerarquiaDto,
} from '../application/dto/usuario-response.dto';
import { CreateUsuarioDto } from '../application/dto/create-usuario.dto';
import { UpdateUsuarioDto } from '../application/dto/update-usuario.dto';
import { QueryUsuariosDto } from '../application/dto/query-usuarios.dto';
import { CambiarEstadoDto } from '../application/dto/cambiar-estado.dto';

// Commands
import {
    CrearUsuarioCommand,
    ActualizarUsuarioCommand,
    CambiarEstadoCommand,
    EliminarUsuarioCommand,
    RestaurarUsuarioCommand,
} from '../application/commands';

// Queries
import {
    ObtenerUsuarioQuery,
    ListarUsuariosQuery,
    ObtenerJerarquiaQuery,
    ObtenerPerfilQuery,
} from '../application/queries';

/**
 * Controlador de Usuarios
 *
 * Endpoints:
 * - POST /              - Crear vendedor (admin)
 * - GET /               - Listar vendedores (admin)
 * - GET /eliminados     - Listar usuarios eliminados (admin)
 * - GET /me             - Obtener perfil propio
 * - GET /me/jerarquia   - Obtener jerarquía propia (solo reclutadores)
 * - GET /:id            - Obtener vendedor (admin)
 * - PATCH /:id          - Actualizar vendedor (admin)
 * - PATCH /:id/estado   - Cambiar estado (admin)
 * - DELETE /:id         - Eliminar vendedor (soft delete) (admin)
 * - POST /:id/restaurar - Restaurar usuario eliminado (admin)
 * - GET /:id/jerarquia  - Obtener árbol de jerarquía (admin)
 */
@ApiTags('Usuarios')
@ApiBearerAuth('access-token')
@Controller('usuarios')
export class UsuariosController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
    ) {}

    /**
     * POST /usuarios
     * Crea un nuevo vendedor (solo admin)
     */
    @Post()
    @Roles('ADMIN')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Crear vendedor (admin)',
        description:
            'Crea un nuevo vendedor con contraseña temporal. ' +
            'Si se especifica reclutadorId y el reclutador es VENDEDOR, ' +
            'se promueve automáticamente a RECLUTADOR.',
    })
    @ApiResponse({
        status: 201,
        description: 'Vendedor creado exitosamente',
        schema: {
            type: 'object',
            properties: {
                usuario: { $ref: '#/components/schemas/UsuarioResponseDto' },
                passwordTemporal: {
                    type: 'string',
                    description: 'Contraseña temporal generada',
                },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Datos inválidos' })
    @ApiResponse({
        status: 409,
        description: 'Usuario ya existe (cédula, email o teléfono duplicado)',
    })
    async crear(
        @Body() createDto: CreateUsuarioDto,
        @CurrentUser() admin: AuthenticatedUser,
    ) {
        const result = await this.commandBus.execute(
            new CrearUsuarioCommand(createDto, admin.id),
        );

        return {
            usuario: this.mapToResponse(result.usuario),
            passwordTemporal: result.passwordTemporal,
            message:
                'Vendedor creado exitosamente. Comparta la contraseña temporal con el vendedor.',
        };
    }

    /**
     * GET /usuarios
     * Lista vendedores con filtros y paginación
     */
    @Get()
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Listar vendedores activos (admin)' })
    @ApiResponse({
        status: 200,
        description: 'Lista de vendedores',
        type: UsuariosPaginadosDto,
    })
    async listar(
        @Query() queryDto: QueryUsuariosDto,
    ): Promise<UsuariosPaginadosDto> {
        // Asegurar que no muestre eliminados por defecto
        queryDto.eliminado = false;
        return this.queryBus.execute(new ListarUsuariosQuery(queryDto));
    }

    /**
     * GET /usuarios/eliminados
     * Lista usuarios eliminados (sección de eliminados)
     */
    @Get('eliminados')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Listar usuarios eliminados (admin)',
        description: 'Lista usuarios que han sido eliminados (soft delete)',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de usuarios eliminados',
        type: UsuariosPaginadosDto,
    })
    async listarEliminados(
        @Query() queryDto: QueryUsuariosDto,
    ): Promise<UsuariosPaginadosDto> {
        // Forzar filtro de eliminados
        queryDto.eliminado = true;
        return this.queryBus.execute(new ListarUsuariosQuery(queryDto));
    }

    /**
     * GET /usuarios/me
     * Obtiene el perfil del usuario autenticado
     */
    @Get('me')
    @ApiOperation({ summary: 'Obtener perfil propio' })
    @ApiResponse({
        status: 200,
        description: 'Perfil del usuario',
        type: UsuarioResponseDto,
    })
    async obtenerPerfil(
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<UsuarioResponseDto> {
        return this.queryBus.execute(new ObtenerPerfilQuery(user.id));
    }

    /**
     * GET /usuarios/me/jerarquia
     * Obtiene la jerarquía propia del usuario autenticado
     * Solo disponible para RECLUTADORES
     */
    @Get('me/jerarquia')
    @Roles('RECLUTADOR')
    @ApiOperation({
        summary: 'Obtener mi jerarquía (reclutador)',
        description:
            'Obtiene la jerarquía completa del reclutador autenticado. ' +
            'Incluye todos los reclutados directos e indirectos con sus ganancias. ' +
            'Solo disponible para usuarios con rol RECLUTADOR.',
    })
    @ApiResponse({
        status: 200,
        description: 'Jerarquía del reclutador con ganancias de cada vendedor',
        type: UsuarioJerarquiaDto,
    })
    @ApiResponse({
        status: 403,
        description: 'Solo los reclutadores pueden ver su jerarquía',
    })
    async obtenerMiJerarquia(
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<UsuarioJerarquiaDto> {
        return this.queryBus.execute(
            new ObtenerJerarquiaQuery(user.id, user.id, user.rol),
        );
    }

    /**
     * GET /usuarios/:id
     * Obtiene un vendedor por ID
     */
    @Get(':id')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Obtener vendedor (admin)' })
    @ApiParam({ name: 'id', description: 'ID del vendedor' })
    @ApiResponse({
        status: 200,
        description: 'Datos del vendedor',
        type: UsuarioResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Vendedor no encontrado' })
    async obtener(
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<UsuarioResponseDto> {
        return this.queryBus.execute(new ObtenerUsuarioQuery(id));
    }

    /**
     * PATCH /usuarios/:id
     * Actualiza los datos de un vendedor
     */
    @Patch(':id')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Actualizar vendedor (admin)' })
    @ApiParam({ name: 'id', description: 'ID del vendedor' })
    @ApiResponse({
        status: 200,
        description: 'Vendedor actualizado',
        type: UsuarioResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Vendedor no encontrado' })
    @ApiResponse({ status: 409, description: 'Email o teléfono ya existe' })
    async actualizar(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateDto: UpdateUsuarioDto,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<UsuarioResponseDto> {
        const usuario = await this.commandBus.execute(
            new ActualizarUsuarioCommand(id, updateDto, admin.id),
        );
        return this.queryBus.execute(new ObtenerUsuarioQuery(usuario.id));
    }

    /**
     * PATCH /usuarios/:id/estado
     * Cambia el estado de un vendedor (ACTIVO/INACTIVO)
     */
    @Patch(':id/estado')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Cambiar estado de vendedor (admin)',
        description:
            'Usuario ACTIVO puede operar. Usuario INACTIVO no puede crear lotes, ' +
            'registrar ventas ni solicitar equipamiento.',
    })
    @ApiParam({ name: 'id', description: 'ID del vendedor' })
    @ApiResponse({
        status: 200,
        description: 'Estado cambiado',
        type: UsuarioResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Vendedor no encontrado' })
    async cambiarEstado(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() cambiarEstadoDto: CambiarEstadoDto,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<UsuarioResponseDto> {
        const usuario = await this.commandBus.execute(
            new CambiarEstadoCommand(id, cambiarEstadoDto.estado, admin.id),
        );
        return this.queryBus.execute(new ObtenerUsuarioQuery(usuario.id));
    }

    /**
     * DELETE /usuarios/:id
     * Elimina un vendedor (soft delete)
     * Solo si NO tiene reclutados activos
     */
    @Delete(':id')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Eliminar vendedor (admin)',
        description:
            'Elimina un vendedor (soft delete). El registro pasa a la sección de eliminados. ' +
            'Solo se puede eliminar si el usuario NO tiene reclutados activos.',
    })
    @ApiParam({ name: 'id', description: 'ID del vendedor' })
    @ApiResponse({
        status: 200,
        description: 'Vendedor eliminado',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({ status: 404, description: 'Vendedor no encontrado' })
    @ApiResponse({
        status: 409,
        description: 'No se puede eliminar porque tiene reclutados activos',
    })
    async eliminar(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() admin: AuthenticatedUser,
    ) {
        await this.commandBus.execute(new EliminarUsuarioCommand(id, admin.id));
        return { message: 'Vendedor eliminado exitosamente' };
    }

    /**
     * POST /usuarios/:id/restaurar
     * Restaura un usuario eliminado
     * El usuario se restaura en estado INACTIVO
     */
    @Post(':id/restaurar')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Restaurar usuario eliminado (admin)',
        description:
            'Restaura un usuario de la sección de eliminados. ' +
            'El usuario se restaura en estado INACTIVO.',
    })
    @ApiParam({ name: 'id', description: 'ID del usuario eliminado' })
    @ApiResponse({
        status: 200,
        description: 'Usuario restaurado',
        type: UsuarioResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
    @ApiResponse({ status: 409, description: 'El usuario no está eliminado' })
    async restaurar(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<UsuarioResponseDto> {
        await this.commandBus.execute(new RestaurarUsuarioCommand(id, admin.id));
        return this.queryBus.execute(new ObtenerUsuarioQuery(id));
    }

    /**
     * GET /usuarios/:id/jerarquia
     * Obtiene el árbol de jerarquía de un usuario (solo admin)
     */
    @Get(':id/jerarquia')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Obtener árbol de jerarquía (admin)',
        description:
            'Obtiene el árbol completo de jerarquía de cualquier usuario. ' +
            'Incluye todos los reclutados directos e indirectos con sus ganancias.',
    })
    @ApiParam({ name: 'id', description: 'ID del usuario' })
    @ApiResponse({
        status: 200,
        description: 'Árbol de jerarquía con ganancias',
        type: UsuarioJerarquiaDto,
    })
    @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
    async obtenerJerarquia(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<UsuarioJerarquiaDto> {
        return this.queryBus.execute(
            new ObtenerJerarquiaQuery(id, admin.id, admin.rol),
        );
    }

    /**
     * Mapea un usuario de Prisma a UsuarioResponseDto básico
     */
    private mapToResponse(usuario: any): Partial<UsuarioResponseDto> {
        return {
            id: usuario.id,
            cedula: usuario.cedula,
            nombre: usuario.nombre,
            apellidos: usuario.apellidos,
            nombreCompleto: `${usuario.nombre} ${usuario.apellidos}`,
            email: usuario.email,
            telefono: usuario.telefono,
            rol: usuario.rol,
            estado: usuario.estado,
            requiereCambioPassword: usuario.requiereCambioPassword,
            reclutadorId: usuario.reclutadorId,
            fechaCreacion: usuario.fechaCreacion,
        };
    }
}