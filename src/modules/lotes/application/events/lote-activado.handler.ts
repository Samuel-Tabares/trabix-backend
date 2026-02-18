import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { ConceptoCuadre } from '@prisma/client';
import { LoteActivadoEvent } from './lote-activado.event';
import { CalculadoraInversionService } from '../../domain/calculadora-inversion.service';
import {
  ICuadreRepository,
  CUADRE_REPOSITORY,
} from '../../../cuadres/domain/cuadre.repository.interface';
import { ILoteRepository, LOTE_REPOSITORY } from '../../../lotes/domain/lote.repository.interface';
import {
  IMiniCuadreRepository,
  MINI_CUADRE_REPOSITORY,
} from '../../../mini-cuadres/domain/mini-cuadre.repository.interface';
import { CalculadoraMontoEsperadoService } from '../../../cuadres/domain/calculadora-monto-esperado.service';
import { RegistrarEntradaFondoCommand } from '../../../fondo-recompensas/application/commands';
import { EnviarNotificacionCommand } from '../../../notificaciones/application/commands';

/**
 * Handler del evento LoteActivado
 * Según sección 23 del documento
 *
 * Acciones:
 * 1. Liberar Tanda 1 ✓ (ya se hace en el repositorio al activar)
 * 2. Crear cuadres para cada tanda (incluyendo deudas de equipamiento)
 * 3. Crear mini-cuadre para última tanda
 * 4. Registrar entrada en fondo de recompensas
 * 5. Enviar notificación LOTE_ACTIVADO al vendedor
 *
 * INTEGRACIÓN EQUIPAMIENTO:
 * - El monto esperado del cuadre T1 incluye deudas de equipamiento
 * - Deudas incluyen: mensualidades pendientes, daños, pérdida
 */
@EventsHandler(LoteActivadoEvent)
export class LoteActivadoHandler implements IEventHandler<LoteActivadoEvent> {
  private readonly logger = new Logger(LoteActivadoHandler.name);

  constructor(
    private readonly calculadoraInversion: CalculadoraInversionService,
    private readonly calculadoraMontoEsperado: CalculadoraMontoEsperadoService,
    @Inject(CUADRE_REPOSITORY)
    private readonly cuadreRepository: ICuadreRepository,
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    @Inject(MINI_CUADRE_REPOSITORY)
    private readonly miniCuadreRepository: IMiniCuadreRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async handle(event: LoteActivadoEvent): Promise<void> {
    this.logger.log(
      `Procesando LoteActivadoEvent: Lote ${event.loteId}, ` +
        `Vendedor ${event.vendedorId}, ${event.cantidadTrabix} TRABIX`,
    );

    try {
      // Obtener lote con tandas
      const lote = await this.loteRepository.findById(event.loteId);
      if (!lote) {
        throw new Error(`Lote no encontrado: ${event.loteId}`);
      }

      // Calcular aporte al fondo de recompensas
      const aporteFondo = this.calculadoraInversion.calcularAporteFondo(event.cantidadTrabix);

      this.logger.log(
        `Lote ${event.loteId}: Aporte a fondo de recompensas = $${aporteFondo.toFixed(2)}`,
      );

      // Crear cuadres para cada tanda según sección 8.9
      const numeroTandas = lote.tandas.length;
      const inversionAdmin = new Decimal(lote.inversionAdmin);

      for (const tanda of lote.tandas) {
        const concepto = this.determinarConceptoCuadre(tanda.numero, numeroTandas);

        // Usar el nuevo calculador que incluye deudas de equipamiento
        const resultado = await this.calculadoraMontoEsperado.calcularMontoEsperadoInicial({
          vendedorId: event.vendedorId,
          numeroTanda: tanda.numero,
          totalTandas: numeroTandas,
          inversionAdmin,
          concepto,
        });

        await this.cuadreRepository.create({
          tandaId: tanda.id,
          concepto,
          montoEsperado: resultado.montoTotal,
        });

        // Log detallado si hay deuda de equipamiento
        if (resultado.deudaEquipamiento && resultado.deudaEquipamiento.total.greaterThan(0)) {
          this.logger.log(
            `Cuadre T${tanda.numero} incluye deuda equipamiento: ` +
              `$${resultado.deudaEquipamiento.total.toFixed(2)} ` +
              `(daño: $${resultado.deudaEquipamiento.deudaDano.toFixed(2)}, ` +
              `pérdida: $${resultado.deudaEquipamiento.deudaPerdida.toFixed(2)}, ` +
              `mensualidades: ${resultado.deudaEquipamiento.mensualidadesPendientes} = $${resultado.deudaEquipamiento.montoMensualidades.toFixed(2)})`,
          );
        }

        this.logger.log(
          `Cuadre creado para tanda ${tanda.numero}: concepto=${concepto}, monto=$${resultado.montoTotal.toFixed(2)}`,
        );
      }

      // Crear mini-cuadre para última tanda
      const ultimaTanda = lote.tandas.reduce((prev, curr) =>
        prev.numero > curr.numero ? prev : curr,
      );

      await this.miniCuadreRepository.create({
        loteId: event.loteId,
        tandaId: ultimaTanda.id,
      });

      this.logger.log(
        `Mini-cuadre creado para lote ${event.loteId}, última tanda ${ultimaTanda.id}`,
      );

      // Registrar entrada en fondo de recompensas (sección 12)
      await this.commandBus.execute(
        new RegistrarEntradaFondoCommand(
          aporteFondo,
          `Aporte por activación de lote ${event.loteId}`,
          event.loteId,
        ),
      );
      this.logger.log(`Entrada registrada en fondo de recompensas: $${aporteFondo.toFixed(2)}`);

      // Enviar notificación LOTE_ACTIVADO al vendedor
      try {
        await this.commandBus.execute(
          new EnviarNotificacionCommand(event.vendedorId, 'LOTE_ACTIVADO', {
            loteId: event.loteId,
            cantidadTrabix: event.cantidadTrabix,
            numeroTandas,
            modeloNegocio: event.modeloNegocio,
          }),
        );
      } catch (notifError) {
        // No fallar el flujo principal si la notificación falla
        this.logger.warn(`Error enviando notificación LOTE_ACTIVADO: ${notifError}`);
      }

      this.logger.log(`LoteActivadoEvent procesado exitosamente: ${event.loteId}`);
    } catch (error) {
      this.logger.error(`Error procesando LoteActivadoEvent: ${event.loteId}`, error);
      throw error;
    }
  }

  /**
   * Determina el concepto del cuadre según número de tanda y total de tandas
   * Según sección 8.9 del documento
   */
  private determinarConceptoCuadre(numeroTanda: number, totalTandas: number): ConceptoCuadre {
    if (totalTandas === 3) {
      // Lote 3 tandas: T1=INVERSION_ADMIN, T2=GANANCIAS, T3=GANANCIAS
      return numeroTanda === 1 ? 'INVERSION_ADMIN' : 'GANANCIAS';
    } else {
      // Lote 2 tandas: T1=MIXTO, T2=GANANCIAS
      return numeroTanda === 1 ? 'MIXTO' : 'GANANCIAS';
    }
  }
}
