import { Injectable, Logger } from '@nestjs/common';
import { CuadreMayor, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import {
  ICuadreMayorRepository,
  CuadreMayorConRelaciones,
  FindCuadresMayorOptions,
  PaginatedCuadresMayor,
  CreateCuadreMayorData,
  ConfirmarCuadreMayorTransactionData,
  ConfirmarCuadreMayorTransactionResult,
} from '../domain/cuadre-mayor.repository.interface';
import { parseDecimalValue } from '../domain/cuadre-mayor.entity';

/**
 * Implementación del repositorio de cuadres al mayor con Prisma
 */
@Injectable()
export class PrismaCuadreMayorRepository implements ICuadreMayorRepository {
  private readonly logger = new Logger(PrismaCuadreMayorRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly includeRelations = {
    ventaMayor: {
      select: {
        id: true,
        cantidadUnidades: true,
        conLicor: true,
        estado: true,
      },
    },
    gananciasReclutadores: true,
  };

  async findById(id: string): Promise<CuadreMayorConRelaciones | null> {
    return this.prisma.cuadreMayor.findUnique({
      where: { id },
      include: this.includeRelations,
    }) as Promise<CuadreMayorConRelaciones | null>;
  }

  async findByVentaMayorId(ventaMayorId: string): Promise<CuadreMayorConRelaciones | null> {
    return this.prisma.cuadreMayor.findUnique({
      where: { ventaMayorId },
      include: this.includeRelations,
    }) as Promise<CuadreMayorConRelaciones | null>;
  }

  async findAll(options?: FindCuadresMayorOptions): Promise<PaginatedCuadresMayor> {
    const { skip = 0, take = 20, where = {} } = options || {};

    const conditions: Prisma.Sql[] = [Prisma.sql`1=1`];
    const needsUserJoin = !!where.searchVendedor;

    if (where.vendedorId) conditions.push(Prisma.sql`cm."vendedorId" = ${where.vendedorId}`);
    if (where.estado) conditions.push(Prisma.sql`cm.estado::text = ${where.estado}`);
    if (where.modalidad) conditions.push(Prisma.sql`cm.modalidad::text = ${where.modalidad}`);
    if (needsUserJoin) {
      const search = `%${where.searchVendedor}%`;
      conditions.push(Prisma.sql`(u.nombre ILIKE ${search} OR u.apellidos ILIKE ${search})`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    const fromClause = needsUserJoin
      ? Prisma.sql`"cuadres_mayor" cm LEFT JOIN "usuarios" u ON cm."vendedorId" = u.id`
      : Prisma.sql`"cuadres_mayor" cm`;

    const [rawIds, totalResult] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT cm.id FROM ${fromClause}
        WHERE ${whereClause}
        ORDER BY
          CASE cm.estado::text
            WHEN 'PENDIENTE' THEN 0
            WHEN 'EXITOSO' THEN 1
            ELSE 2
          END,
          cm."fechaRegistro" DESC,
          cm.id DESC
        LIMIT ${take + 1} OFFSET ${skip}
      `),
      this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
        SELECT COUNT(*) as count FROM ${fromClause}
        WHERE ${whereClause}
      `),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const ids = rawIds.map((r) => r.id);
    const hasMore = ids.length > take;
    if (hasMore) ids.pop();

    if (ids.length === 0) {
      return { data: [], total, hasMore: false, nextCursor: undefined };
    }

    const cuadres = await this.prisma.cuadreMayor.findMany({
      where: { id: { in: ids } },
      include: this.includeRelations,
    });

    const idOrder = new Map(ids.map((id, i) => [id, i]));
    cuadres.sort((a, b) => idOrder.get(a.id)! - idOrder.get(b.id)!);

    return {
      data: cuadres as CuadreMayorConRelaciones[],
      total,
      hasMore,
      nextCursor: undefined,
    };
  }

  async findByVendedorId(
    vendedorId: string,
    options?: FindCuadresMayorOptions,
  ): Promise<PaginatedCuadresMayor> {
    return this.findAll({
      ...options,
      where: { ...options?.where, vendedorId },
    });
  }

  async create(data: CreateCuadreMayorData): Promise<CuadreMayor> {
    return this.prisma.$transaction(async (tx) => {
      // Serializar evaluación financiera para JSON
      const evaluacionJson = {
        dineroRecaudadoDetal: data.evaluacionFinanciera.dineroRecaudadoDetal.toFixed(2),
        dineroVentaMayor: data.evaluacionFinanciera.dineroVentaMayor.toFixed(2),
        dineroTotalDisponible: data.evaluacionFinanciera.dineroTotalDisponible.toFixed(2),
        inversionAdminTotal: data.evaluacionFinanciera.inversionAdminTotal.toFixed(2),
        inversionVendedorTotal: data.evaluacionFinanciera.inversionVendedorTotal.toFixed(2),
        inversionAdminCubierta: data.evaluacionFinanciera.inversionAdminCubierta.toFixed(2),
        inversionVendedorCubierta: data.evaluacionFinanciera.inversionVendedorCubierta.toFixed(2),
        gananciaNeta: data.evaluacionFinanciera.gananciaNeta.toFixed(2),
        gananciaAdmin: data.evaluacionFinanciera.gananciaAdmin.toFixed(2),
        gananciaVendedor: data.evaluacionFinanciera.gananciaVendedor.toFixed(2),
        deudasSaldadas: data.evaluacionFinanciera.deudasSaldadas.toFixed(2),
        gananciasReclutadores: data.evaluacionFinanciera.gananciasReclutadores.map((g) => ({
          reclutadorId: g.reclutadorId,
          nivel: g.nivel,
          monto: g.monto.toFixed(2),
        })),
      };

      // Serializar tandas afectadas para JSON
      const tandasAfectadasJson = data.tandasAfectadas.map((t) => ({
        tandaId: t.tandaId,
        cantidadStockConsumido: t.cantidadStockConsumido,
        numeroTanda: t.numeroTanda,
        loteId: t.loteId,
      }));

      // Crear el cuadre al mayor
      const cuadre = await tx.cuadreMayor.create({
        data: {
          ventaMayorId: data.ventaMayorId,
          vendedorId: data.vendedorId,
          modalidad: data.modalidad,
          estado: 'PENDIENTE',
          cantidadUnidades: data.cantidadUnidades,
          precioUnidad: data.precioUnidad.toFixed(2),
          ingresoBruto: data.ingresoBruto.toFixed(2),
          deudasSaldadas: data.deudasSaldadas.toFixed(2),
          inversionAdminLotesExistentes: data.inversionAdminLotesExistentes.toFixed(2),
          inversionAdminLoteForzado: data.inversionAdminLoteForzado.toFixed(2),
          inversionVendedorLotesExistentes: data.inversionVendedorLotesExistentes.toFixed(2),
          inversionVendedorLoteForzado: data.inversionVendedorLoteForzado.toFixed(2),
          gananciasAdmin: data.gananciasAdmin.toFixed(2),
          gananciasVendedor: data.gananciasVendedor.toFixed(2),
          evaluacionFinanciera: evaluacionJson,
          montoTotalAdmin: data.montoTotalAdmin.toFixed(2),
          montoTotalVendedor: data.montoTotalVendedor.toFixed(2),
          lotesInvolucradosIds: data.lotesInvolucradosIds,
          tandasAfectadas: tandasAfectadasJson,
          cuadresCerradosIds: [],
          loteForzadoId: data.loteForzadoId || null,
        },
      });

      // Crear ganancias de reclutadores
      if (data.gananciasReclutadores.length > 0) {
        await tx.gananciaReclutador.createMany({
          data: data.gananciasReclutadores.map((g) => ({
            cuadreMayorId: cuadre.id,
            reclutadorId: g.reclutadorId,
            nivel: g.nivel,
            monto: g.monto.toFixed(2),
            transferido: false,
          })),
        });
      }

      return cuadre;
    });
  }

  /**
   * @deprecated Usar confirmarExitosoTransaccional para operaciones atómicas
   */
  async confirmarExitoso(id: string, cuadresCerradosIds: string[]): Promise<CuadreMayor> {
    return this.prisma.cuadreMayor.update({
      where: { id },
      data: {
        estado: 'EXITOSO',
        cuadresCerradosIds,
        fechaExitoso: new Date(),
      },
    });
  }

  /**
   * Confirma un cuadre al mayor con todas las operaciones en una transacción atómica.
   *
   * Orden de operaciones:
   * 1. Consumir stock de tandas afectadas
   * 2. Finalizar tandas con stock agotado (excepto últimas tandas)
   * 3. Cerrar cuadres normales de tandas COMPLETAMENTE consumidas
   * 4. Procesar lote forzado (activar, finalizar tandas, finalizar lote)
   * 5. Actualizar montos prorrateados en lotes involucrados
   * 6. Marcar cuadre al mayor como EXITOSO
   *
   * @returns Resultado con IDs de elementos procesados para emisión de eventos post-transacción
   */
  async confirmarExitosoTransaccional(
    data: ConfirmarCuadreMayorTransactionData,
  ): Promise<ConfirmarCuadreMayorTransactionResult> {
    return this.prisma.$transaction(async (tx) => {
      const cuadresCerradosIds: string[] = [];
      const tandasFinalizadasIds: string[] = [];
      const tandasConStockAgotadoUltimas: Array<{ tandaId: string; loteId: string }> = [];

      // ========== 1. CONSUMIR STOCK DE TANDAS AFECTADAS ==========
      for (const tanda of data.tandasParaProcesar) {
        await tx.tanda.update({
          where: { id: tanda.tandaId },
          data: {
            stockActual: { decrement: tanda.cantidadStockConsumido },
            version: { increment: 1 },
          },
        });

        this.logger.debug(
          `Stock consumido: Tanda ${tanda.tandaId} - ${tanda.cantidadStockConsumido} unidades`,
        );

        // Verificar si la tanda quedó con stock 0 y está EN_CASA
        if (tanda.stockRestanteDespuesConsumo === 0 && tanda.estadoActual === 'EN_CASA') {
          if (tanda.esUltimaTanda) {
            // Última tanda: NO finalizar aquí, guardar para emitir evento después
            tandasConStockAgotadoUltimas.push({
              tandaId: tanda.tandaId,
              loteId: tanda.loteId,
            });
          } else {
            // No es última tanda: finalizar directamente
            await tx.tanda.update({
              where: { id: tanda.tandaId },
              data: {
                estado: 'FINALIZADA',
                fechaFinalizada: new Date(),
                version: { increment: 1 },
              },
            });
            tandasFinalizadasIds.push(tanda.tandaId);
            this.logger.debug(`Tanda ${tanda.tandaId} finalizada por stock agotado`);
          }
        }
      }

      // ========== 2. CERRAR CUADRES NORMALES DE TANDAS COMPLETAMENTE CONSUMIDAS ==========
      // FIX: Ahora solo cierra cuadres de tandas cuyo stock fue completamente consumido
      // FIX: Usa el montoEsperado del propio cuadre como montoCubiertoPorMayor
      for (const cuadre of data.cuadresParaCerrar) {
        await tx.cuadre.update({
          where: { id: cuadre.cuadreId },
          data: {
            estado: 'EXITOSO',
            montoCubiertoPorMayor: cuadre.montoEsperado, // FIX: montoEsperado del cuadre, no montoTotalAdmin global
            cerradoPorCuadreMayorId: data.cuadreMayorId,
            montoFaltante: '0',
            fechaExitoso: new Date(),
            version: { increment: 1 },
          },
        });
        cuadresCerradosIds.push(cuadre.cuadreId);
        this.logger.debug(
          `Cuadre cerrado por mayor: ${cuadre.cuadreId} (tanda: ${cuadre.tandaId}, monto: $${cuadre.montoEsperado})`,
        );
      }

      // ========== 2b. ACREDITAR CUADRES PENDIENTES VÍA DEUDAS SALDADAS ==========
      for (const cuadreDeuda of data.cuadresDeudaSaldada) {
        const updateData: Prisma.CuadreUncheckedUpdateInput = {
          montoCubiertoPorMayor: cuadreDeuda.nuevaMontoCubiertoPorMayor,
          cerradoPorCuadreMayorId: data.cuadreMayorId,
          version: { increment: 1 },
        };

        if (cuadreDeuda.esFullClosure) {
          updateData.estado = 'EXITOSO';
          updateData.montoFaltante = '0';
          updateData.fechaExitoso = new Date();
          cuadresCerradosIds.push(cuadreDeuda.cuadreId);
        }

        await tx.cuadre.update({
          where: { id: cuadreDeuda.cuadreId },
          data: updateData,
        });

        this.logger.debug(
          `Cuadre acreditado vía deudasSaldadas: ${cuadreDeuda.cuadreId} ` +
            `nuevaCubierta=$${cuadreDeuda.nuevaMontoCubiertoPorMayor} esFullClosure=${cuadreDeuda.esFullClosure}`,
        );
      }

      // ========== 3. PROCESAR LOTE FORZADO (si existe) ==========
      if (data.loteForzado) {
        // Activar lote forzado
        await tx.lote.update({
          where: { id: data.loteForzado.id },
          data: {
            estado: 'ACTIVO',
            fechaActivacion: new Date(),
            version: { increment: 1 },
          },
        });

        // Finalizar todas las tandas del lote forzado
        for (const tandaId of data.loteForzado.tandasIds) {
          await tx.tanda.update({
            where: { id: tandaId },
            data: {
              estado: 'FINALIZADA',
              fechaFinalizada: new Date(),
              version: { increment: 1 },
            },
          });
        }

        // Finalizar lote forzado
        await tx.lote.update({
          where: { id: data.loteForzado.id },
          data: {
            estado: 'FINALIZADO',
            fechaFinalizacion: new Date(),
            version: { increment: 1 },
          },
        });

        this.logger.debug(`Lote forzado procesado: ${data.loteForzado.id}`);
      }

      // ========== 4. ACTUALIZAR MONTOS PRORRATEADOS EN LOTES ==========
      for (const distribucion of data.distribucionPorLote) {
        await tx.lote.update({
          where: { id: distribucion.loteId },
          data: {
            dineroRecaudado: {
              increment: Number.parseFloat(distribucion.montoRecaudado.toFixed(2)),
            },
            dineroTransferido: {
              increment: Number.parseFloat(distribucion.montoTransferido.toFixed(2)),
            },
            dineroVendedorDistribuido: {
              increment: Number.parseFloat(distribucion.montoVendedor.toFixed(2)),
            },
            version: { increment: 1 },
          },
        });

        this.logger.debug(
          `Lote ${distribucion.loteId} actualizado: ` +
            `+${distribucion.montoRecaudado.toFixed(2)} recaudado, ` +
            `+${distribucion.montoTransferido.toFixed(2)} transferido ` +
            `(${distribucion.stockConsumido} unidades)`,
        );
      }

      // ========== 5. CONFIRMAR CUADRE AL MAYOR ==========
      const cuadreMayor = await tx.cuadreMayor.update({
        where: { id: data.cuadreMayorId },
        data: {
          estado: 'EXITOSO',
          cuadresCerradosIds,
          fechaExitoso: new Date(),
        },
      });

      // ========== 6. ACTUALIZAR DEUDA DE EQUIPAMIENTO ==========
      if (data.equipamentoPago) {
        const pago = data.equipamentoPago;
        const danoReducir = parseDecimalValue(pago.deudaDanoReducir);
        const perdidaReducir = parseDecimalValue(pago.deudaPerdidaReducir);

        const eqUpdate: Prisma.EquipamientoUpdateInput = {};

        if (danoReducir.greaterThan(0)) {
          eqUpdate.deudaDano = { decrement: Number.parseFloat(danoReducir.toFixed(2)) };
        }
        if (perdidaReducir.greaterThan(0)) {
          eqUpdate.deudaPerdida = { decrement: Number.parseFloat(perdidaReducir.toFixed(2)) };
        }
        if (pago.nuevaUltimaMensualidadPagada) {
          eqUpdate.ultimaMensualidadPagada = pago.nuevaUltimaMensualidadPagada;
        }

        if (Object.keys(eqUpdate).length > 0) {
          await tx.equipamiento.update({
            where: { id: pago.equipamientoId },
            data: eqUpdate,
          });
          this.logger.debug(
            `Equipamiento actualizado: ${pago.equipamientoId} ` +
              `daño-$${danoReducir.toFixed(2)} pérdida-$${perdidaReducir.toFixed(2)}`,
          );
        }
      }

      this.logger.log(
        `Transacción completada para cuadre al mayor ${data.cuadreMayorId}: ` +
          `${cuadresCerradosIds.length} cuadres cerrados, ` +
          `${tandasFinalizadasIds.length} tandas finalizadas, ` +
          `${data.distribucionPorLote.length} lotes actualizados`,
      );

      return {
        cuadreMayor,
        cuadresCerradosIds,
        tandasFinalizadasIds,
        tandasConStockAgotadoUltimas,
      };
    });
  }

  async count(options?: { vendedorId?: string; estado?: any }): Promise<number> {
    const where: Prisma.CuadreMayorWhereInput = {};
    if (options?.vendedorId) where.vendedorId = options.vendedorId;
    if (options?.estado) where.estado = options.estado;
    return this.prisma.cuadreMayor.count({ where });
  }
}
