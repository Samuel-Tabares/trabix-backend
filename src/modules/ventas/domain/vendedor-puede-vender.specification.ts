import { Injectable, Inject } from '@nestjs/common';
import { Tanda, Usuario } from '@prisma/client';
import {
  IUsuarioRepository,
  USUARIO_REPOSITORY,
} from '../../usuarios/domain/usuario.repository.interface';
import { ILoteRepository, LOTE_REPOSITORY, LoteConTandas } from '../../lotes/domain/lote.repository.interface';
import { ITandaRepository, TANDA_REPOSITORY } from '../../lotes/domain/tanda.repository.interface';
import { ICuadreRepository, CUADRE_REPOSITORY } from '../../cuadres/domain/cuadre.repository.interface';
import { DomainException } from '../../../domain/exceptions/domain.exception';

/**
 * Specification: VendedorPuedeVender
 * Según sección 17 del documento - Validaciones para REGISTRAR VENTA
 *
 * Validaciones:
 * - Vendedor existe y está ACTIVO
 * - Vendedor ya cambió contraseña temporal
 * - Existe al menos un lote ACTIVO
 * - Existe tanda EN_CASA con stock_actual > 0
 * - stock_actual >= cantidad_venta  (o hay cross-lote disponible)
 */
@Injectable()
export class VendedorPuedeVenderSpecification {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    @Inject(TANDA_REPOSITORY)
    private readonly tandaRepository: ITandaRepository,
    @Inject(CUADRE_REPOSITORY)
    private readonly cuadreRepository: ICuadreRepository,
  ) {}

  /**
   * Verifica si el vendedor puede realizar una venta.
   * Cuando hay stock insuficiente en el lote actual pero el último cuadre
   * normal de ese lote ya es EXITOSO y existe otro lote activo con tanda
   * EN_CASA, se habilita la venta cross-lote.
   *
   * @returns El lote activo, tanda, y opcionalmente datos cross-lote
   */
  async verificar(vendedorId: string, cantidadTrabix: number): Promise<VendedorPuedeVenderResult> {
    // 1. Vendedor existe
    const vendedor = await this.usuarioRepository.findById(vendedorId);
    if (!vendedor) {
      throw new DomainException('USR_001', 'Vendedor no encontrado', { vendedorId });
    }

    // 2. Vendedor no está eliminado
    if (vendedor.eliminado) {
      throw new DomainException('USR_001', 'Vendedor no encontrado', { vendedorId });
    }

    // 3. Vendedor está ACTIVO
    if (vendedor.estado !== 'ACTIVO') {
      throw new DomainException('VNT_005', 'El vendedor debe estar activo para registrar ventas', {
        estadoVendedor: vendedor.estado,
      });
    }

    // 4. Vendedor ya cambió contraseña temporal
    if (vendedor.requiereCambioPassword) {
      throw new DomainException(
        'VNT_005',
        'El vendedor debe cambiar su contraseña temporal antes de registrar ventas',
      );
    }

    // 5. Existe al menos un lote ACTIVO (el más antiguo)
    const loteActivo = await this.loteRepository.findLoteActivoMasAntiguo(vendedorId);
    if (!loteActivo) {
      throw new DomainException('VNT_002', 'No existe un lote activo para este vendedor', {
        vendedorId,
      });
    }

    // 6. Existe tanda EN_CASA con stock_actual > 0
    const tandaEnCasa = await this.tandaRepository.findTandaEnCasa(loteActivo.id);
    if (!tandaEnCasa) {
      throw new DomainException('VNT_002', 'No hay tanda EN_CASA disponible para ventas', {
        loteId: loteActivo.id,
      });
    }

    // 7. Validar stock
    if (tandaEnCasa.stockActual >= cantidadTrabix) {
      // Stock suficiente en el lote actual → flujo normal
      return { vendedor, lote: loteActivo, tanda: tandaEnCasa };
    }

    // 8. Stock insuficiente → verificar si aplica venta cross-lote
    const crossLote = await this.verificarCrossLote(
      vendedorId,
      loteActivo,
      tandaEnCasa,
      cantidadTrabix,
    );

    if (crossLote) {
      return { vendedor, lote: loteActivo, tanda: tandaEnCasa, crossLote };
    }

    throw new DomainException('VNT_001', 'Stock insuficiente en la tanda actual', {
      stockDisponible: tandaEnCasa.stockActual,
      cantidadSolicitada: cantidadTrabix,
    });
  }

  /**
   * Verifica si se puede hacer una venta cross-lote:
   * - La tanda en casa DEBE ser la última tanda del lote
   * - El cuadre de esa tanda debe estar EXITOSO
   * - Debe existir otro lote ACTIVO con tanda EN_CASA con stock suficiente para el excedente
   */
  private async verificarCrossLote(
    vendedorId: string,
    loteActual: LoteConTandas,
    tandaActual: Tanda,
    cantidadTotal: number,
  ): Promise<CrossLoteInfo | null> {
    // La tanda en casa debe ser la última del lote
    const ultimaTandaDelLote = loteActual.tandas[loteActual.tandas.length - 1];
    if (tandaActual.id !== ultimaTandaDelLote.id) {
      return null;
    }

    // El cuadre de esta última tanda debe estar EXITOSO
    const cuadre = await this.cuadreRepository.findByTandaId(tandaActual.id);
    if (!cuadre || cuadre.estado !== 'EXITOSO') {
      return null;
    }

    // Buscar el siguiente lote activo
    const lotesActivos = await this.loteRepository.findLotesActivos(vendedorId);
    const siguienteLote = lotesActivos.find((l) => l.id !== loteActual.id);
    if (!siguienteLote) {
      return null;
    }

    // El siguiente lote debe tener tanda EN_CASA con stock para el excedente
    const tandaSiguiente = await this.tandaRepository.findTandaEnCasa(siguienteLote.id);
    if (!tandaSiguiente) {
      return null;
    }

    const stockRestanteLote1 = tandaActual.stockActual;
    const excedente = cantidadTotal - stockRestanteLote1;

    if (tandaSiguiente.stockActual < excedente) {
      throw new DomainException('VNT_001', 'Stock insuficiente incluso combinando ambos lotes', {
        stockLote1: stockRestanteLote1,
        stockLote2: tandaSiguiente.stockActual,
        cantidadSolicitada: cantidadTotal,
      });
    }

    return {
      lote: siguienteLote,
      tanda: tandaSiguiente,
      stockRestanteLote1,
    };
  }
}

/**
 * Datos para una venta cross-lote
 */
export interface CrossLoteInfo {
  lote: LoteConTandas;
  tanda: Tanda;
  stockRestanteLote1: number;
}

/**
 * Resultado de la verificación
 */
export interface VendedorPuedeVenderResult {
  vendedor: Usuario;
  lote: LoteConTandas;
  tanda: Tanda;
  crossLote?: CrossLoteInfo;
}
