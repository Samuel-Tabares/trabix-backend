import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  IEquipamientoRepository,
  EQUIPAMIENTO_REPOSITORY,
} from '../../../modules/equipamiento/domain/equipamiento.repository.interface';
import { ActualizadorCuadresVendedorService } from '../../../modules/cuadres/domain/actualizador-cuadres-vendedor.service';

/**
 * Job programado: Verificar Mensualidades Vencidas
 *
 * Se ejecuta diariamente a las 00:00 (medianoche)
 *
 * Funciones:
 * 1. Buscar equipamientos ACTIVOS con mensualidad vencida (>30 días)
 * 2. Para cada uno, actualizar los cuadres del vendedor
 *
 * Esto asegura que las mensualidades pendientes se reflejen
 * en el montoEsperado de los cuadres activos.
 */
@Injectable()
export class MensualidadesVencidasJob {
  private readonly logger = new Logger(MensualidadesVencidasJob.name);

  constructor(
    @Inject(EQUIPAMIENTO_REPOSITORY)
    private readonly equipamientoRepository: IEquipamientoRepository,
    private readonly actualizadorCuadres: ActualizadorCuadresVendedorService,
  ) {}

  /**
   * Ejecuta la verificación de mensualidades vencidas
   * Se ejecuta cada día a medianoche
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async verificarMensualidadesVencidas(): Promise<void> {
    this.logger.log('Iniciando verificación de mensualidades vencidas...');

    try {
      let vendedoresActualizados = 0;
      let errores = 0;
      let skip = 0;
      const take = 100;
      let hasMore = true;

      // 1. Paginar equipamientos activos para no imponer un límite fijo
      while (hasMore) {
        const resultado = await this.equipamientoRepository.findAll({
          where: { estado: 'ACTIVO' },
          take,
          skip,
        });

        const equipamientosActivos = resultado.data;
        this.logger.log(`Equipamientos activos (skip=${skip}): ${equipamientosActivos.length}`);

        skip += take;
        hasMore = resultado.hasMore;

        // 2. Verificar cada equipamiento de la página actual
        for (const equipamiento of equipamientosActivos) {
          try {
            const diasDesdeUltimoPago = this.calcularDiasDesdeUltimoPago(
              equipamiento.ultimaMensualidadPagada,
              equipamiento.fechaEntrega,
            );

            // Si han pasado más de 30 días, hay mensualidad(es) pendiente(s)
            if (diasDesdeUltimoPago > 30) {
              const mensualidadesPendientes = Math.floor(diasDesdeUltimoPago / 30);

              this.logger.log(
                `Equipamiento ${equipamiento.id} (vendedor ${equipamiento.vendedorId}): ` +
                  `${mensualidadesPendientes} mensualidad(es) pendiente(s) ` +
                  `(${diasDesdeUltimoPago} días desde último pago)`,
              );

              // Actualizar cuadres del vendedor
              await this.actualizadorCuadres.actualizarPorCambioDeudaEquipamiento(
                equipamiento.vendedorId,
                `Mensualidad vencida detectada (${mensualidadesPendientes} pendientes)`,
              );

              vendedoresActualizados++;
            }
          } catch (error) {
            this.logger.error(`Error procesando equipamiento ${equipamiento.id}: ${error}`);
            errores++;
          }
        }
      }

      this.logger.log(
        `Verificación de mensualidades completada: ` +
          `${vendedoresActualizados} vendedores actualizados, ${errores} errores`,
      );
    } catch (error) {
      this.logger.error(`Error en job de mensualidades vencidas: ${error}`);
    }
  }

  /**
   * Calcula los días desde el último pago de mensualidad
   */
  private calcularDiasDesdeUltimoPago(
    ultimaMensualidadPagada: Date | null,
    fechaEntrega: Date | null,
  ): number {
    // Si no hay último pago, usar fecha de entrega
    const fechaReferencia = ultimaMensualidadPagada || fechaEntrega;

    if (!fechaReferencia) {
      return 0;
    }

    const ahora = new Date();
    const diferencia = ahora.getTime() - new Date(fechaReferencia).getTime();
    return Math.floor(diferencia / (1000 * 60 * 60 * 24));
  }
}
