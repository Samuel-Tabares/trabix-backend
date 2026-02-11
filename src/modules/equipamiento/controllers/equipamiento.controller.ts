import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UnauthorizedException,
  NotFoundException,
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
    SolicitarEquipamientoDto,
    ReportarDanoDto,
    QueryEquipamientosDto,
    EquipamientoResponseDto,
    EquipamientosPaginadosDto,
    PagarDeudaDto,
    EquipamientoConAdvertenciaDto,
} from '../application/dto';

// Commands
import {
    SolicitarEquipamientoCommand,
    ActivarEquipamientoCommand,
    ReportarDanoCommand,
    ReportarPerdidaCommand,
    DevolverEquipamientoCommand,
    PagarMensualidadCommand,
    PagarDeudaDanoCommand,
    PagarDeudaPerdidaCommand,
} from '../application/commands';

// Queries
import {
    ObtenerEquipamientoQuery,
    ObtenerMiEquipamientoQuery,
    ListarEquipamientosQuery,
} from '../application/queries';

/**
 * Controlador de Equipamiento
 * Según sección 10 del documento
 *
 * Permisos:
 * - VENDEDOR: solo puede solicitar y ver su propio equipamiento
 * - ADMIN: puede listar, activar, reportar daños/pérdidas, y marcar devoluciones
 */
@ApiTags('Equipamiento')
@ApiBearerAuth('access-token')
@Controller('equipamiento')
export class EquipamientoController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
    ) {}

    // =============================================
    // ENDPOINTS PARA VENDEDOR
    // =============================================

    /**
     * POST /equipamiento/solicitar
     * Solicitar equipamiento (VENDEDOR)
     */
    @Post('solicitar')
    @Roles('VENDEDOR')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Solicitar equipamiento (vendedor)',
        description: 'Un vendedor solicita equipamiento (nevera + pijama). Solo puede tener uno activo.',
    })
    @ApiResponse({ status: 201, type: EquipamientoResponseDto })
    @ApiResponse({ status: 400, description: 'Ya tiene equipamiento activo' })
    @ApiResponse({ status: 403, description: 'Solo vendedores pueden solicitar equipamiento' })
    async solicitar(
        @Body() dto: SolicitarEquipamientoDto,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<EquipamientoResponseDto> {
        if (!user) throw new UnauthorizedException();

        const equipamiento = await this.commandBus.execute(
            new SolicitarEquipamientoCommand(user.id, dto.tieneDeposito),
        );
        return this.queryBus.execute(new ObtenerEquipamientoQuery(equipamiento.id));
    }

    /**
     * GET /equipamiento/me
     * Obtener mi equipamiento (VENDEDOR)
     */
    @Get('me')
 
    @Roles('VENDEDOR')
    @ApiOperation({
        summary: 'Obtener mi equipamiento',
        description: 'Retorna el equipamiento activo del vendedor autenticado',
    })
    @ApiResponse({ status: 200, type: EquipamientoResponseDto })
    @ApiResponse({ status: 403, description: 'Solo vendedores pueden acceder a este endpoint' })
    @ApiResponse({ status: 404, description: 'No tiene equipamiento' })
    async obtenerMio(
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<EquipamientoResponseDto> {
        if (!user) throw new UnauthorizedException();

        const equipamiento = await this.queryBus.execute(
            new ObtenerMiEquipamientoQuery(user.id),
        );

        // Manejar caso cuando no existe equipamiento
        if (!equipamiento) {
            throw new NotFoundException('No tiene equipamiento activo o solicitado');
        }

        return equipamiento;
    }

    // =============================================
    // ENDPOINTS PARA ADMIN
    // =============================================

    /**
     * GET /equipamiento
     * Listar equipamiento (ADMIN)
     */
    @Get()
 
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Listar equipamiento (admin)',
        description: 'Lista todos los equipamientos con filtros opcionales',
    })
    @ApiResponse({ status: 200, type: EquipamientosPaginadosDto })
    async listar(
        @Query() queryDto: QueryEquipamientosDto,
    ): Promise<EquipamientosPaginadosDto> {
        return this.queryBus.execute(new ListarEquipamientosQuery(queryDto));
    }

    /**
     * GET /equipamiento/:id
     * Obtener detalle de equipamiento (ADMIN)
     */
    @Get(':id')
 
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Obtener detalle de equipamiento (admin)',
        description: 'Obtiene el detalle completo de un equipamiento por ID',
    })
    @ApiParam({ name: 'id', description: 'ID del equipamiento' })
    @ApiResponse({ status: 200, type: EquipamientoResponseDto })
    @ApiResponse({ status: 404, description: 'Equipamiento no encontrado' })
    async obtenerPorId(
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<EquipamientoResponseDto> {
        return this.queryBus.execute(new ObtenerEquipamientoQuery(id));
    }

    /**
     * POST /equipamiento/:id/activar
     * Activar equipamiento - marcar como entregado (ADMIN)
     */
    @Post(':id/activar')
 
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Activar equipamiento (admin)',
        description: 'Admin confirma la entrega física del equipamiento al vendedor',
    })
    @ApiParam({ name: 'id', description: 'ID del equipamiento' })
    @ApiResponse({ status: 200, type: EquipamientoResponseDto })
    @ApiResponse({ status: 400, description: 'Estado inválido para activación' })
    async activar(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<EquipamientoResponseDto> {
        if (!admin) throw new UnauthorizedException();

        await this.commandBus.execute(new ActivarEquipamientoCommand(id, admin.id));
        return this.queryBus.execute(new ObtenerEquipamientoQuery(id));
    }

    /**
     * POST /equipamiento/:id/reportar-dano
     * Reportar daño (ADMIN)
     */
    @Post(':id/reportar-dano')
 
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Reportar daño (admin)',
        description:
            'Admin reporta daño de nevera ($30,000) o pijama ($60,000). ' +
            'Solo aumenta la deuda, no cambia el estado.',
    })
    @ApiParam({ name: 'id', description: 'ID del equipamiento' })
    @ApiResponse({ status: 200, type: EquipamientoConAdvertenciaDto })
    @ApiResponse({ status: 400, description: 'Estado inválido para reportar daño' })
    async reportarDano(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ReportarDanoDto,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<EquipamientoConAdvertenciaDto> {
        if (!admin) throw new UnauthorizedException();

        const resultado = await this.commandBus.execute(
            new ReportarDanoCommand(id, dto.tipoDano, admin.id),
        );

        const equipamiento = await this.queryBus.execute(new ObtenerEquipamientoQuery(id));

        return {
            ...equipamiento,
            advertenciaCuadres: resultado.advertenciaCuadres,
        };
    }

    /**
     * POST /equipamiento/:id/reportar-perdida
     * Reportar pérdida total (ADMIN)
     */
    @Post(':id/reportar-perdida')
 
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Reportar pérdida total (admin)',
        description:
            'Admin reporta pérdida total del equipamiento. ' +
            'Genera deuda por el costo total ($90,000) y cambia estado a PERDIDO.',
    })
    @ApiParam({ name: 'id', description: 'ID del equipamiento' })
    @ApiResponse({ status: 200, type: EquipamientoConAdvertenciaDto })
    @ApiResponse({ status: 400, description: 'Estado inválido para reportar pérdida' })
    async reportarPerdida(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<EquipamientoConAdvertenciaDto> {
        if (!admin) throw new UnauthorizedException();

        const resultado = await this.commandBus.execute(
            new ReportarPerdidaCommand(id, admin.id),
        );

        const equipamiento = await this.queryBus.execute(new ObtenerEquipamientoQuery(id));

        return {
            ...equipamiento,
            advertenciaCuadres: resultado.advertenciaCuadres,
        };
    }

    /**
     * POST /equipamiento/:id/devolver
     * Devolver equipamiento (ADMIN)
     */
    @Post(':id/devolver')
 
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Devolver equipamiento (admin)',
        description:
            'Admin registra la devolución del equipamiento. ' +
            'Solo si no hay deudas pendientes. Si tiene depósito, se devuelve.',
    })
    @ApiParam({ name: 'id', description: 'ID del equipamiento' })
    @ApiResponse({ status: 200, type: EquipamientoResponseDto })
    @ApiResponse({ status: 400, description: 'Tiene deudas pendientes o estado inválido' })
    async devolver(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<EquipamientoResponseDto> {
        if (!admin) throw new UnauthorizedException();

        await this.commandBus.execute(new DevolverEquipamientoCommand(id, admin.id));
        return this.queryBus.execute(new ObtenerEquipamientoQuery(id));
    }

    // =============================================
    // ENDPOINTS PARA PAGO MANUAL DE DEUDAS (ADMIN)
    // =============================================

    /**
     * POST /equipamiento/:id/pagar-mensualidad
     * Registrar pago de mensualidad (ADMIN)
     */
    @Post(':id/pagar-mensualidad')
 
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Registrar pago de mensualidad (admin)',
        description:
            'Admin registra que el vendedor pagó la mensualidad del equipamiento. ' +
            'Actualiza la fecha de última mensualidad pagada.',
    })
    @ApiParam({ name: 'id', description: 'ID del equipamiento' })
    @ApiResponse({ status: 200, type: EquipamientoConAdvertenciaDto })
    @ApiResponse({ status: 400, description: 'Estado inválido o equipamiento no encontrado' })
    async pagarMensualidad(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<EquipamientoConAdvertenciaDto> {
        if (!admin) throw new UnauthorizedException();

        const resultado = await this.commandBus.execute(
            new PagarMensualidadCommand(id, admin.id),
        );

        const equipamiento = await this.queryBus.execute(new ObtenerEquipamientoQuery(id));

        return {
            ...equipamiento,
            advertenciaCuadres: resultado.advertenciaCuadres,
        };
    }

    /**
     * POST /equipamiento/:id/pagar-deuda-dano
     * Abonar a deuda por daño (ADMIN)
     */
    @Post(':id/pagar-deuda-dano')
 
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Abonar a deuda por daño (admin)',
        description:
            'Admin registra un abono a la deuda por daño del equipamiento. ' +
            'Se puede abonar parcialmente o pagar el total.',
    })
    @ApiParam({ name: 'id', description: 'ID del equipamiento' })
    @ApiResponse({ status: 200, type: EquipamientoConAdvertenciaDto })
    @ApiResponse({ status: 400, description: 'Monto inválido o sin deuda pendiente' })
    async pagarDeudaDano(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: PagarDeudaDto,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<EquipamientoConAdvertenciaDto> {
        if (!admin) throw new UnauthorizedException();

        const resultado = await this.commandBus.execute(
            new PagarDeudaDanoCommand(id, dto.monto, admin.id),
        );

        const equipamiento = await this.queryBus.execute(new ObtenerEquipamientoQuery(id));

        return {
            ...equipamiento,
            advertenciaCuadres: resultado.advertenciaCuadres,
        };
    }

    /**
     * POST /equipamiento/:id/pagar-deuda-perdida
     * Abonar a deuda por pérdida (ADMIN)
     */
    @Post(':id/pagar-deuda-perdida')
 
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Abonar a deuda por pérdida (admin)',
        description:
            'Admin registra un abono a la deuda por pérdida total del equipamiento. ' +
            'Se puede abonar parcialmente o pagar el total.',
    })
    @ApiParam({ name: 'id', description: 'ID del equipamiento' })
    @ApiResponse({ status: 200, type: EquipamientoConAdvertenciaDto })
    @ApiResponse({ status: 400, description: 'Monto inválido o sin deuda pendiente' })
    async pagarDeudaPerdida(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: PagarDeudaDto,
        @CurrentUser() admin: AuthenticatedUser,
    ): Promise<EquipamientoConAdvertenciaDto> {
        if (!admin) throw new UnauthorizedException();

        const resultado = await this.commandBus.execute(
            new PagarDeudaPerdidaCommand(id, dto.monto, admin.id),
        );

        const equipamiento = await this.queryBus.execute(new ObtenerEquipamientoQuery(id));

        return {
            ...equipamiento,
            advertenciaCuadres: resultado.advertenciaCuadres,
        };
    }
}