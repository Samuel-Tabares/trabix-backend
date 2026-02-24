import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../auth/decorators/current-user.decorator';

// DTOs
import {
  EnviarNotificacionDto,
  QueryNotificacionesDto,
  MarcarTodasLeidasDto,
  NotificacionResponseDto,
  NotificacionesPaginadasDto,
  ContadorNotificacionesDto,
  MarcarTodasLeidasResponseDto,
} from '../application/dto';

// Commands
import {
  EnviarNotificacionCommand,
  MarcarNotificacionLeidaCommand,
  MarcarTodasLeidasCommand,
} from '../application/commands';

// Queries
import {
  ListarMisNotificacionesQuery,
  ContarNoLeidasQuery,
  ObtenerNotificacionQuery,
} from '../application/queries';

/**
 * Controlador de Notificaciones
 * Según sección 20.13 del documento
 *
 * FIX #3: Rutas estáticas (contador, leer-todas, enviar) declaradas
 * ANTES de la ruta dinámica :id para evitar conflictos.
 */
@ApiTags('Notificaciones')
@ApiBearerAuth('access-token')
@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * GET /notificaciones
   * Listar mis notificaciones
   */
  @Get()
  @ApiOperation({ summary: 'Listar mis notificaciones' })
  @ApiResponse({ status: 200, type: NotificacionesPaginadasDto })
  async listarMias(
    @Query() queryDto: QueryNotificacionesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificacionesPaginadasDto> {
    return this.queryBus.execute(new ListarMisNotificacionesQuery(user.id, queryDto));
  }

  /**
   * GET /notificaciones/contador
   * Obtener contador de no leídas
   *
   * FIX #3: Declarado ANTES de :id
   */
  @Get('contador')
  @ApiOperation({ summary: 'Obtener contador de notificaciones no leídas' })
  @ApiResponse({ status: 200, type: ContadorNotificacionesDto })
  async contarNoLeidas(@CurrentUser() user: AuthenticatedUser): Promise<ContadorNotificacionesDto> {
    const noLeidas = await this.queryBus.execute(new ContarNoLeidasQuery(user.id));
    return { noLeidas };
  }

  /**
   * PATCH /notificaciones/leer-todas
   * Marcar todas como leídas
   *
   * FIX #3: Declarado ANTES de :id/leer
   */
  @Patch('leer-todas')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  @ApiResponse({ status: 200, type: MarcarTodasLeidasResponseDto })
  async marcarTodasLeidas(
    @Body() dto: MarcarTodasLeidasDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MarcarTodasLeidasResponseDto> {
    const marcadas = await this.commandBus.execute(new MarcarTodasLeidasCommand(user.id, dto.tipo));

    return { marcadas };
  }

  /**
   * POST /notificaciones/enviar
   * Enviar notificación manual (solo admin).
   * El tipo siempre es MANUAL y el canal siempre es WEBSOCKET.
   *
   * FIX #3: Declarado ANTES de :id
   */
  @Post('enviar')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enviar notificación manual (solo admin)' })
  @ApiResponse({ status: 201, type: NotificacionResponseDto })
  async enviar(@Body() dto: EnviarNotificacionDto): Promise<NotificacionResponseDto> {
    const notificacion = await this.commandBus.execute(
      new EnviarNotificacionCommand(
        dto.usuarioId,
        'MANUAL',
        { ...dto.datos, titulo: dto.titulo, mensaje: dto.mensaje },
      ),
    );

    return {
      id: notificacion.id,
      usuarioId: notificacion.usuarioId,
      tipo: notificacion.tipo,
      titulo: notificacion.titulo,
      mensaje: notificacion.mensaje,
      datos: notificacion.datos,
      canal: notificacion.canal,
      leida: notificacion.leida,
      fechaCreacion: notificacion.fechaCreacion,
      fechaLeida: notificacion.fechaLeida,
    };
  }

  /**
   * GET /notificaciones/:id
   * Obtener una notificación específica
   *
   * FIX #3: Declarado DESPUÉS de rutas estáticas
   */
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una notificación específica' })
  @ApiParam({ name: 'id', description: 'ID de la notificación' })
  @ApiResponse({ status: 200, type: NotificacionResponseDto })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada' })
  async obtenerNotificacion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificacionResponseDto> {
    const notificacion = await this.queryBus.execute(new ObtenerNotificacionQuery(id, user.id));

    if (!notificacion) {
      throw new NotFoundException('Notificación no encontrada');
    }

    return notificacion;
  }

  /**
   * PATCH /notificaciones/:id/leer
   * Marcar como leída
   *
   * FIX #3: Declarado DESPUÉS de rutas estáticas
   */
  @Patch(':id/leer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  @ApiParam({ name: 'id', description: 'ID de la notificación' })
  @ApiResponse({ status: 200, type: NotificacionResponseDto })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada' })
  async marcarLeida(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificacionResponseDto> {
    const notificacion = await this.commandBus.execute(
      new MarcarNotificacionLeidaCommand(id, user.id),
    );

    return {
      id: notificacion.id,
      usuarioId: notificacion.usuarioId,
      tipo: notificacion.tipo,
      titulo: notificacion.titulo,
      mensaje: notificacion.mensaje,
      datos: notificacion.datos,
      canal: notificacion.canal,
      leida: notificacion.leida,
      fechaCreacion: notificacion.fechaCreacion,
      fechaLeida: notificacion.fechaLeida,
    };
  }
}
