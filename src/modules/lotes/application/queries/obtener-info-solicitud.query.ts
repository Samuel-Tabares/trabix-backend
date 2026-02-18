import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILoteRepository, LOTE_REPOSITORY } from '../../domain/lote.repository.interface';
import { CalculadoraInversionService } from '../../domain/calculadora-inversion.service';
import { InfoSolicitudLoteDto } from '../dto';
import { calcularInfoSolicitud } from '../commands/solicitar-lote.command';

/**
 * Query para obtener información necesaria antes de solicitar un lote
 */
export class ObtenerInfoSolicitudQuery implements IQuery {
  constructor(public readonly vendedorId: string) {}
}

/**
 * Handler de la query ObtenerInfoSolicitud
 *
 * Retorna:
 * - Cantidad mínima de TRABIX
 * - Costo por TRABIX
 * - Inversión total mínima
 * - Inversión del vendedor mínima
 * - Lotes en estado CREADO actuales
 * - Si puede solicitar más
 */
@QueryHandler(ObtenerInfoSolicitudQuery)
export class ObtenerInfoSolicitudHandler implements IQueryHandler<
  ObtenerInfoSolicitudQuery,
  InfoSolicitudLoteDto
> {
  private readonly maxLotesCreados: number;
  private readonly inversionMinimaVendedor: number;

  constructor(
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    private readonly calculadoraInversion: CalculadoraInversionService,
    private readonly configService: ConfigService,
  ) {
    // Cargar configuración desde .env
    this.maxLotesCreados = this.configService.get<number>('lotes.maxLotesCreadosPorVendedor') ?? 2;
    this.inversionMinimaVendedor =
      this.configService.get<number>('lotes.inversionMinimaVendedor') ?? 20000;
  }

  async execute(query: ObtenerInfoSolicitudQuery): Promise<InfoSolicitudLoteDto> {
    const { vendedorId } = query;

    // Contar lotes en estado CREADO del vendedor
    const lotesCreadosActuales = await this.loteRepository.count({
      vendedorId,
      estado: 'CREADO',
    });

    return calcularInfoSolicitud(
      this.calculadoraInversion,
      lotesCreadosActuales,
      this.maxLotesCreados,
      this.inversionMinimaVendedor,
    );
  }
}
