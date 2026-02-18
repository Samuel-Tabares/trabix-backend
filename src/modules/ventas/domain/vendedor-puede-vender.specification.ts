import { Injectable, Inject } from '@nestjs/common';
import { Usuario } from '@prisma/client';
import {
  IUsuarioRepository,
  USUARIO_REPOSITORY,
} from '../../usuarios/domain/usuario.repository.interface';
import { ILoteRepository, LOTE_REPOSITORY } from '../../lotes/domain/lote.repository.interface';
import { ITandaRepository, TANDA_REPOSITORY } from '../../lotes/domain/tanda.repository.interface';
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
 * - stock_actual >= cantidad_venta
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
  ) {}

  /**
   * Verifica si el vendedor puede realizar una venta
   * @returns El lote activo más antiguo y la tanda EN_CASA disponible
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

    // 7. stock_actual >= cantidad_venta
    if (tandaEnCasa.stockActual < cantidadTrabix) {
      throw new DomainException('VNT_001', 'Stock insuficiente en la tanda actual', {
        stockDisponible: tandaEnCasa.stockActual,
        cantidadSolicitada: cantidadTrabix,
      });
    }

    return {
      vendedor,
      lote: loteActivo,
      tanda: tandaEnCasa,
    };
  }
}

/**
 * Resultado de la verificación
 */
export interface VendedorPuedeVenderResult {
  vendedor: Usuario;
  lote: any; // LoteConTandas
  tanda: any; // Tanda
}
