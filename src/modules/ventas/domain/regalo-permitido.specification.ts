import { Injectable, Inject } from '@nestjs/common';
import { DomainException } from '../../../domain/exceptions/domain.exception';
import { IVentaRepository, VENTA_REPOSITORY } from './venta.repository.interface';
import { CalculadoraInversionService } from '../../lotes/domain/calculadora-inversion.service';

/**
 * Specification: RegaloPermitido
 * Según sección 6.3 y 17 del documento
 *
 * Validación:
 * Si incluye REGALO: total_regalos_lote + cantidad_regalo <= cantidad_lote × limite_regalos%
 *
 * El porcentaje máximo permitido se obtiene de configuración (por defecto 8%)
 */
@Injectable()
export class RegaloPermitidoSpecification {
  constructor(
    @Inject(VENTA_REPOSITORY)
    private readonly ventaRepository: IVentaRepository,
    private readonly calculadoraInversion: CalculadoraInversionService,
  ) {}

  /**
   * Verifica si se pueden agregar regalos a un lote
   * @param loteId ID del lote
   * @param cantidadLote Cantidad total de TRABIX del lote
   * @param cantidadRegalosNuevos Cantidad de regalos que se quieren agregar
   */
  async verificar(
    loteId: string,
    cantidadLote: number,
    cantidadRegalosNuevos: number,
  ): Promise<RegaloPermitidoResult> {
    // Calcular máximo de regalos permitidos usando el servicio de dominio
    const maximoRegalos = this.calculadoraInversion.calcularMaximoRegalos(cantidadLote);

    // Si no hay regalos nuevos, no hay nada que validar
    if (cantidadRegalosNuevos <= 0) {
      return {
        permitido: true,
        maximoRegalos,
        regalosActuales: 0,
        regalosDisponibles: maximoRegalos,
      };
    }

    // Obtener regalos ya utilizados en el lote
    const regalosActuales = await this.ventaRepository.contarRegalosPorLote(loteId);

    // Verificar si hay espacio para los nuevos regalos
    const regalosDisponibles = maximoRegalos - regalosActuales;
    const permitido = cantidadRegalosNuevos <= regalosDisponibles;

    if (!permitido) {
      throw new DomainException(
        'VNT_001',
        'Se excede el máximo de regalos permitidos para este lote',
        {
          maximoRegalos,
          regalosActuales,
          regalosDisponibles,
          cantidadSolicitada: cantidadRegalosNuevos,
        },
      );
    }

    return {
      permitido,
      maximoRegalos,
      regalosActuales,
      regalosDisponibles,
    };
  }
}

/**
 * Resultado de la verificación de regalo
 */
export interface RegaloPermitidoResult {
  permitido: boolean;
  maximoRegalos: number;
  regalosActuales: number;
  regalosDisponibles: number;
}
