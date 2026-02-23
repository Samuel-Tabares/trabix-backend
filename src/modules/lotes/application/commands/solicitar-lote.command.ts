import { CommandHandler, ICommandHandler, ICommand, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModeloNegocio } from '@prisma/client';
import { EnviarNotificacionARolCommand } from '../../../notificaciones/application/commands';
import {
  ILoteRepository,
  LOTE_REPOSITORY,
  LoteConTandas,
} from '../../domain/lote.repository.interface';
import {
  IUsuarioRepository,
  USUARIO_REPOSITORY,
} from '../../../usuarios/domain/usuario.repository.interface';
import { CalculadoraInversionService } from '../../domain/calculadora-inversion.service';
import { CalculadoraTandasService } from '../../domain/calculadora-tandas.service';
import { DomainException } from '../../../../domain/exceptions/domain.exception';

/**
 * Command para que un vendedor solicite un lote
 */
export class SolicitarLoteCommand implements ICommand {
  constructor(
    public readonly vendedorId: string,
    public readonly cantidadTrabix: number,
  ) {}
}

/**
 * Handler del comando SolicitarLote
 *
 * Validaciones:
 * 1. Vendedor existe y está activo
 * 2. Vendedor ya cambió su contraseña temporal
 * 3. Vendedor tiene menos de MAX_LOTES_CREADOS lotes en estado CREADO
 * 4. Cantidad mínima según inversión mínima configurada
 */
@CommandHandler(SolicitarLoteCommand)
export class SolicitarLoteHandler implements ICommandHandler<SolicitarLoteCommand, LoteConTandas> {
  private readonly logger = new Logger(SolicitarLoteHandler.name);

  private readonly maxLotesCreados: number;
  private readonly inversionMinimaVendedor: number;

  constructor(
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly calculadoraInversion: CalculadoraInversionService,
    private readonly calculadoraTandas: CalculadoraTandasService,
    private readonly configService: ConfigService,
    private readonly commandBus: CommandBus,
  ) {
    // Cargar límites desde configuración
    this.maxLotesCreados = this.configService.get<number>('lotes.maxLotesCreadosPorVendedor') ?? 2;
    this.inversionMinimaVendedor =
      this.configService.get<number>('lotes.inversionMinimaVendedor') ?? 20000;
  }

  async execute(command: SolicitarLoteCommand): Promise<LoteConTandas> {
    const { vendedorId, cantidadTrabix } = command;

    // 1. Validar que el vendedor existe y está activo
    const vendedor = await this.usuarioRepository.findById(vendedorId);
    if (!vendedor) {
      throw new DomainException('USR_001', 'Vendedor no encontrado', { vendedorId });
    }

    if (vendedor.eliminado) {
      throw new DomainException('USR_001', 'Vendedor no encontrado', { vendedorId });
    }

    if (vendedor.estado !== 'ACTIVO') {
      throw new DomainException('LOTE_002', 'El vendedor debe estar activo para solicitar lotes', {
        estadoVendedor: vendedor.estado,
      });
    }

    // 2. Validar que el vendedor ya cambió su contraseña temporal
    if (vendedor.requiereCambioPassword) {
      throw new DomainException(
        'LOTE_002',
        'Debe cambiar su contraseña temporal antes de solicitar lotes',
      );
    }

    // 3. Validar máximo de lotes en estado CREADO
    const lotesCreados = await this.loteRepository.count({
      vendedorId,
      estado: 'CREADO',
    });

    if (lotesCreados >= this.maxLotesCreados) {
      throw new DomainException(
        'LOTE_006',
        `Ya tiene ${this.maxLotesCreados} lotes pendientes de activación. Complete el pago de los lotes existentes antes de solicitar más.`,
        { lotesCreados, maxPermitidos: this.maxLotesCreados },
      );
    }

    // 4. Calcular y validar cantidad mínima
    const cantidadMinima = this.calcularCantidadMinima();

    if (cantidadTrabix < cantidadMinima) {
      const inversiones = this.calculadoraInversion.calcularInversiones(cantidadMinima);
      throw new DomainException(
        'LOTE_007',
        `La cantidad mínima es ${cantidadMinima} TRABIX para alcanzar la inversión mínima de $${this.inversionMinimaVendedor.toLocaleString()}`,
        {
          cantidadSolicitada: cantidadTrabix,
          cantidadMinima,
          inversionMinimaRequerida: this.inversionMinimaVendedor,
          inversionVendedorConMinimo: inversiones.inversionVendedor.toNumber(),
        },
      );
    }

    // 5. Determinar modelo de negocio según el reclutador
    let modeloNegocio: ModeloNegocio = 'MODELO_60_40';
    if (vendedor.reclutadorId) {
      const reclutador = await this.usuarioRepository.findById(vendedor.reclutadorId);
      if (reclutador && reclutador.rol !== 'ADMIN') {
        modeloNegocio = 'MODELO_50_50';
      }
    }

    // 6. Calcular inversiones
    const inversiones = this.calculadoraInversion.calcularInversiones(cantidadTrabix);

    // 7. Calcular distribución de tandas
    const distribucionTandas = this.calculadoraTandas.calcularDistribucionTandas(cantidadTrabix);

    // 8. Crear lote con tandas (estado CREADO)
    const lote = await this.loteRepository.create({
      vendedorId,
      cantidadTrabix,
      modeloNegocio,
      inversionTotal: inversiones.inversionTotal,
      inversionAdmin: inversiones.inversionAdmin,
      inversionVendedor: inversiones.inversionVendedor,
      tandas: distribucionTandas,
    });

    this.logger.log(
      `Lote solicitado: ${lote.id} - ${cantidadTrabix} TRABIX por vendedor ${vendedorId} (${modeloNegocio})`,
    );

    // Notificar a todos los admins de la nueva solicitud de lote
    try {
      await this.commandBus.execute(
        new EnviarNotificacionARolCommand('ADMIN', 'LOTE_SOLICITADO', {
          loteId: lote.id,
          cantidadTrabix,
          inversionTotal: lote.inversionTotal.toNumber(),
          inversionVendedor: lote.inversionVendedor.toNumber(),
          modeloNegocio,
          vendedorNombre: vendedor.nombre,
        }),
      );
    } catch (notifError) {
      this.logger.warn(`Error enviando notificación LOTE_SOLICITADO: ${notifError}`);
    }

    return lote;
  }

  /**
   * Calcula la cantidad mínima de TRABIX según la inversión mínima configurada
   * cantidad_minima = CEIL(INVERSION_MINIMA / inversion_vendedor_por_trabix)
   */
  private calcularCantidadMinima(): number {
    // Inversión vendedor por TRABIX = costo_percibido × porcentaje_inversion
    const inversionVendedorPorTrabix = this.calculadoraInversion
      .calcularInversiones(1)
      .inversionVendedor.toNumber();

    return Math.ceil(this.inversionMinimaVendedor / inversionVendedorPorTrabix);
  }
}

/**
 * Función auxiliar para calcular información de solicitud
 * Usada por el query ObtenerInfoSolicitud
 */
export function calcularInfoSolicitud(
  calculadoraInversion: CalculadoraInversionService,
  lotesCreadosActuales: number,
  maxLotesCreados: number,
  inversionMinimaVendedor: number,
): {
  cantidadMinima: number;
  costoPorTrabix: number;
  inversionTotalMinima: number;
  inversionVendedorMinima: number;
  lotesCreadosActuales: number;
  maxLotesCreados: number;
  puedeSolicitar: boolean;
} {
  const inversionUnitaria = calculadoraInversion.calcularInversiones(1);
  const costoPorTrabix = inversionUnitaria.inversionTotal.toNumber();
  const inversionVendedorPorTrabix = inversionUnitaria.inversionVendedor.toNumber();

  const cantidadMinima = Math.ceil(inversionMinimaVendedor / inversionVendedorPorTrabix);
  const inversionesMinimas = calculadoraInversion.calcularInversiones(cantidadMinima);

  return {
    cantidadMinima,
    costoPorTrabix,
    inversionTotalMinima: inversionesMinimas.inversionTotal.toNumber(),
    inversionVendedorMinima: inversionesMinimas.inversionVendedor.toNumber(),
    lotesCreadosActuales,
    maxLotesCreados,
    puedeSolicitar: lotesCreadosActuales < maxLotesCreados,
  };
}
