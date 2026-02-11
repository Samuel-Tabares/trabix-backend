import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UnauthorizedException,
  ForbiddenException,
    Inject
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../auth/decorators/current-user.decorator';
import {
  ITandaRepository,
  TANDA_REPOSITORY,
} from '../domain/tanda.repository.interface';
import {
  ILoteRepository,
  LOTE_REPOSITORY,
} from '../domain/lote.repository.interface';
import { TandaEntity } from '../domain/tanda.entity';
import { DomainException } from '../../../domain/exceptions/domain.exception';
import { TandaResponseDto } from '../application/dto';

/**
 * Controlador de Tandas
 * Según sección 20.5 del documento
 *
 * Endpoints:
 * - GET /lote/:loteId        - Listar tandas de lote (admin o dueño)
 * - GET /:id                 - Obtener tanda (admin o dueño del lote)
 * - POST /:id/confirmar-entrega - Confirmar EN_CASA (admin)
 */
@ApiTags('Tandas')
@ApiBearerAuth('access-token')
@Controller('tandas')
export class TandasController {
  constructor(
    @Inject(TANDA_REPOSITORY)
    private readonly tandaRepository: ITandaRepository,
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
  ) {}

  /**
   * GET /tandas/lote/:loteId
   * Lista las tandas de un lote
   * Admin puede ver cualquier lote, vendedor solo los suyos
   */
  @Get('lote/:loteId')
  @ApiOperation({
    summary: 'Listar tandas de lote',
    description: 'Lista todas las tandas de un lote. Admin ve cualquiera, vendedor solo de sus lotes.',
  })
  @ApiParam({ name: 'loteId', description: 'ID del lote' })
  @ApiResponse({
    status: 200,
    description: 'Lista de tandas del lote',
    type: [TandaResponseDto],
  })
  @ApiResponse({ status: 403, description: 'No tiene permisos para ver este lote' })
  @ApiResponse({ status: 404, description: 'Lote no encontrado' })
  async listarPorLote(
    @Param('loteId', ParseUUIDPipe) loteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TandaResponseDto[]> {
    if (!user) throw new UnauthorizedException();

    // Verificar que el lote existe y el usuario tiene permisos
    const lote = await this.loteRepository.findById(loteId);
    if (!lote) {
      throw new DomainException(
        'LOTE_003',
        'Lote no encontrado',
        { loteId },
      );
    }

    // Verificar permisos: admin puede ver cualquiera, vendedor solo los suyos
    if (user.rol !== 'ADMIN' && lote.vendedorId !== user.id) {
      throw new ForbiddenException('No tiene permisos para ver las tandas de este lote');
    }

    const tandas = await this.tandaRepository.findByLote(loteId);
    return tandas.map((tanda) => this.mapToDto(tanda));
  }

  /**
   * GET /tandas/:id
   * Obtiene una tanda por ID
   * Admin puede ver cualquier tanda, vendedor solo de sus lotes
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener tanda',
    description: 'Obtiene los datos de una tanda. Admin ve cualquiera, vendedor solo de sus lotes.',
  })
  @ApiParam({ name: 'id', description: 'ID de la tanda' })
  @ApiResponse({
    status: 200,
    description: 'Datos de la tanda',
    type: TandaResponseDto,
  })
  @ApiResponse({ status: 403, description: 'No tiene permisos para ver esta tanda' })
  @ApiResponse({ status: 404, description: 'Tanda no encontrada' })
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TandaResponseDto> {
    if (!user) throw new UnauthorizedException();

    const tanda = await this.tandaRepository.findById(id);
    if (!tanda) {
      throw new DomainException(
        'TND_001',
        'Tanda no encontrada',
        { tandaId: id },
      );
    }

    // Verificar permisos a través del lote
    const lote = await this.loteRepository.findById(tanda.loteId);
    if (!lote) {
      throw new DomainException(
        'LOTE_003',
        'Lote no encontrado',
        { loteId: tanda.loteId },
      );
    }

    if (user.rol !== 'ADMIN' && lote.vendedorId !== user.id) {
      throw new ForbiddenException('No tiene permisos para ver esta tanda');
    }

    return this.mapToDto(tanda);
  }

  /**
   * POST /tandas/:id/confirmar-entrega
   * Confirma la entrega de una tanda (EN_TRÁNSITO → EN_CASA)
   * Solo admin
   */
  @Post(':id/confirmar-entrega')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar entrega EN_CASA (admin)',
    description: 'Confirma que la tanda llegó al vendedor. Transición: EN_TRÁNSITO → EN_CASA.',
  })
  @ApiParam({ name: 'id', description: 'ID de la tanda' })
  @ApiResponse({
    status: 200,
    description: 'Entrega confirmada',
    type: TandaResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Tanda no encontrada' })
  @ApiResponse({ status: 409, description: 'La tanda no está en estado EN_TRÁNSITO' })
  async confirmarEntrega(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<TandaResponseDto> {
    if (!admin) throw new UnauthorizedException();

    const tanda = await this.tandaRepository.findById(id);
    if (!tanda) {
      throw new DomainException(
        'TND_001',
        'Tanda no encontrada',
        { tandaId: id },
      );
    }

    // Validar transición usando la entidad de dominio
    const tandaEntity = new TandaEntity(tanda);
    tandaEntity.validarConfirmacionEntrega();

    // Confirmar entrega
    const tandaActualizada = await this.tandaRepository.confirmarEntrega(id);

    return this.mapToDto(tandaActualizada);
  }

  /**
   * Mapea una tanda de Prisma a TandaResponseDto
   */
  private mapToDto(tanda: any): TandaResponseDto {
    return {
      id: tanda.id,
      loteId: tanda.loteId,
      numero: tanda.numero,
      estado: tanda.estado,
      stockInicial: tanda.stockInicial,
      stockActual: tanda.stockActual,
      stockConsumidoPorMayor: tanda.stockConsumidoPorMayor,
      porcentajeStockRestante:
        tanda.stockInicial > 0
          ? (tanda.stockActual / tanda.stockInicial) * 100
          : 0,
      fechaLiberacion: tanda.fechaLiberacion,
      fechaEnTransito: tanda.fechaEnTransito,
      fechaEnCasa: tanda.fechaEnCasa,
      fechaFinalizada: tanda.fechaFinalizada,
    };
  }
}
