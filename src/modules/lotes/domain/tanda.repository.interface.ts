import { Tanda } from '@prisma/client';

/**
 * Interface del repositorio de tandas
 */
export interface ITandaRepository {
  /**
   * Busca una tanda por ID
   */
  findById(id: string): Promise<Tanda | null>;

  /**
   * Busca tandas de un lote
   */
  findByLote(loteId: string): Promise<Tanda[]>;

  /**
   * Obtiene la tanda EN_CASA de un lote (para ventas)
   */
  findTandaEnCasa(loteId: string): Promise<Tanda | null>;

  /**
   * Obtiene tandas liberadas que deben transicionar a EN_TRÁNSITO
   * (liberadas hace más de 2 horas)
   */
  findTandasParaTransicion(): Promise<Tanda[]>;

  /**
   * Obtiene TODAS las tandas en estado LIBERADA, sin restricción de tiempo.
   * Solo para uso en entornos de desarrollo/testing.
   */
  findTodasLiberadas(): Promise<Tanda[]>;

  /**
   * Libera una tanda (INACTIVA → LIBERADA)
   */
  liberar(id: string): Promise<Tanda>;

  /**
   * Transiciona a EN_TRÁNSITO (LIBERADA → EN_TRÁNSITO)
   */
  transicionarAEnTransito(id: string): Promise<Tanda>;

  /**
   * Confirma entrega (EN_TRÁNSITO → EN_CASA)
   */
  confirmarEntrega(id: string): Promise<Tanda>;

  /**
   * Finaliza tanda (EN_CASA → FINALIZADA)
   */
  finalizar(id: string): Promise<Tanda>;

  /**
   * Actualiza el stock actual
   */
  actualizarStock(id: string, nuevoStock: number): Promise<Tanda>;

  /**
   * Consume stock de una tanda
   */
  consumirStock(id: string, cantidad: number): Promise<Tanda>;

  /**
   * Actualiza el stock consumido por ventas al mayor
   */
  actualizarStockConsumidoPorMayor(id: string, cantidad: number): Promise<Tanda>;
}

/**
 * Token de inyección para el repositorio
 */
export const TANDA_REPOSITORY = Symbol('TANDA_REPOSITORY');
