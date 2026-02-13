import { PrismaClient } from '@prisma/client';
import {
  V, V50, LOTE, TANDA, BIZ, daysAgo,
} from './helpers';

/**
 * Seed 05: Ventas al detal
 * Cubre estados: PENDIENTE, APROBADA, RECHAZADA
 * Tipos de venta: PROMO, UNIDAD, SIN_LICOR, REGALO
 */
export async function seedVentas(prisma: PrismaClient) {
  console.log('  → Creando ventas al detal...');

  let ventasCreadas = 0;

  // Helper para crear venta con detalles
  const crearVenta = async (config: VentaConfig) => {
    let montoTotal = 0;
    const detallesData = config.detalles.map((d) => {
      const precio = precioTipo(d.tipo);
      const subtotal = precio * d.cantidad;
      montoTotal += subtotal;
      return {
        tipo: d.tipo as any,
        cantidad: d.cantidad,
        precioUnitario: precio,
        subtotal,
      };
    });

    const cantidadTrabix = config.detalles.reduce((sum, d) => {
      const trabixPorTipo = d.tipo === 'PROMO' ? 2 : 1;
      return sum + d.cantidad * trabixPorTipo;
    }, 0);

    await prisma.venta.create({
      data: {
        vendedorId: config.vendedorId,
        loteId: config.loteId,
        tandaId: config.tandaId,
        estado: config.estado,
        montoTotal,
        cantidadTrabix,
        fechaRegistro: config.fechaRegistro,
        fechaValidacion: config.fechaValidacion ?? null,
        detalles: {
          create: detallesData,
        },
      },
    });
    ventasCreadas++;
  };

  // ========================================
  // 1. Ventas APROBADAS - V.activo_ok (lote activo, T1 en_casa)
  //    5 unidades vendidas = stock actual 10 (de 15 iniciales)
  // ========================================
  await crearVenta({
    vendedorId: V.activo_ok,
    loteId: LOTE.v_activo_lote1,
    tandaId: TANDA.activo_t1,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(45),
    fechaValidacion: daysAgo(44),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 3 },
      { tipo: 'PROMO', cantidad: 1 }, // 2 TRABIX
    ],
  });

  // ========================================
  // 2. Ventas APROBADAS - V.con_lote_finalizado (lote finalizado, toda T1 y T2 vendidas)
  // ========================================
  // T1 ventas
  await crearVenta({
    vendedorId: V.con_lote_finalizado,
    loteId: LOTE.v_finalizado,
    tandaId: TANDA.final_t1,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(150),
    fechaValidacion: daysAgo(149),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 10 },
      { tipo: 'PROMO', cantidad: 3 }, // 6 TRABIX
      { tipo: 'SIN_LICOR', cantidad: 2 },
      { tipo: 'REGALO', cantidad: 2 }, // 2 regalos
    ],
  });

  // T2 ventas
  await crearVenta({
    vendedorId: V.con_lote_finalizado,
    loteId: LOTE.v_finalizado,
    tandaId: TANDA.final_t2,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(50),
    fechaValidacion: daysAgo(49),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 12 },
      { tipo: 'PROMO', cantidad: 2 }, // 4 TRABIX
      { tipo: 'SIN_LICOR', cantidad: 4 },
    ],
  });

  // ========================================
  // 3. Ventas múltiples para V.multi_lotes (lote1, T1: vendió 10 de 25)
  // ========================================
  await crearVenta({
    vendedorId: V.multi_lotes,
    loteId: LOTE.v_multi_1,
    tandaId: TANDA.multi1_t1,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(60),
    fechaValidacion: daysAgo(59),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 5 },
      { tipo: 'SIN_LICOR', cantidad: 3 },
      { tipo: 'PROMO', cantidad: 1 }, // 2 TRABIX → total 10 TRABIX
    ],
  });

  // ========================================
  // 4. Ventas PENDIENTES - V.con_ventas_pend (3 ventas pendientes por aprobar)
  // ========================================
  await crearVenta({
    vendedorId: V.con_ventas_pend,
    loteId: LOTE.v_vta_pend,
    tandaId: TANDA.vpend_t1,
    estado: 'PENDIENTE',
    fechaRegistro: daysAgo(2),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 2 },
    ],
  });

  await crearVenta({
    vendedorId: V.con_ventas_pend,
    loteId: LOTE.v_vta_pend,
    tandaId: TANDA.vpend_t1,
    estado: 'PENDIENTE',
    fechaRegistro: daysAgo(1),
    detalles: [
      { tipo: 'PROMO', cantidad: 1 }, // 2 TRABIX
      { tipo: 'SIN_LICOR', cantidad: 1 },
    ],
  });

  // ========================================
  // 5. Ventas RECHAZADAS - V.con_ventas_rech
  // ========================================
  // Una aprobada
  await crearVenta({
    vendedorId: V.con_ventas_rech,
    loteId: LOTE.v_vta_rech,
    tandaId: TANDA.vrech_t1,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(15),
    fechaValidacion: daysAgo(14),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 2 },
    ],
  });

  // Dos rechazadas
  await crearVenta({
    vendedorId: V.con_ventas_rech,
    loteId: LOTE.v_vta_rech,
    tandaId: TANDA.vrech_t1,
    estado: 'RECHAZADA',
    fechaRegistro: daysAgo(10),
    fechaValidacion: daysAgo(9),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 3 },
      { tipo: 'REGALO', cantidad: 1 },
    ],
  });

  await crearVenta({
    vendedorId: V.con_ventas_rech,
    loteId: LOTE.v_vta_rech,
    tandaId: TANDA.vrech_t1,
    estado: 'RECHAZADA',
    fechaRegistro: daysAgo(5),
    fechaValidacion: daysAgo(4),
    detalles: [
      { tipo: 'PROMO', cantidad: 2 },
    ],
  });

  // ========================================
  // 6. Ventas para cuadre PENDIENTE - V.cuadre_pendiente (60u, 3 tandas, mucho vendido en T1)
  // ========================================
  await crearVenta({
    vendedorId: V.cuadre_pendiente,
    loteId: LOTE.v_cuadre_pend,
    tandaId: TANDA.cuadre_t1,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(55),
    fechaValidacion: daysAgo(54),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 8 },
      { tipo: 'PROMO', cantidad: 3 }, // 6 TRABIX
      { tipo: 'SIN_LICOR', cantidad: 3 },
    ],
  });

  // ========================================
  // 7. Ventas para cuadre EXITOSO - V.cuadre_exitoso (T1 agotada, T2 en_casa vendiendo)
  // ========================================
  await crearVenta({
    vendedorId: V.cuadre_exitoso,
    loteId: LOTE.v_cuadre_exit,
    tandaId: TANDA.exit_t1,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(80),
    fechaValidacion: daysAgo(79),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 12 },
      { tipo: 'PROMO', cantidad: 2 }, // 4 TRABIX
      { tipo: 'SIN_LICOR', cantidad: 4 },
    ],
  });

  await crearVenta({
    vendedorId: V.cuadre_exitoso,
    loteId: LOTE.v_cuadre_exit,
    tandaId: TANDA.exit_t2,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(30),
    fechaValidacion: daysAgo(29),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 8 },
      { tipo: 'PROMO', cantidad: 2 },
      { tipo: 'SIN_LICOR', cantidad: 2 },
    ],
  });

  // ========================================
  // 8. Ventas para mini-cuadre - V.mini_cuadre_pend (todoo agotado)
  // ========================================
  await crearVenta({
    vendedorId: V.mini_cuadre_pend,
    loteId: LOTE.v_mini_cuadre,
    tandaId: TANDA.mini_t1,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(35),
    fechaValidacion: daysAgo(34),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 10 },
      { tipo: 'PROMO', cantidad: 2 }, // 4 TRABIX
      { tipo: 'REGALO', cantidad: 1 },
    ],
  });

  await crearVenta({
    vendedorId: V.mini_cuadre_pend,
    loteId: LOTE.v_mini_cuadre,
    tandaId: TANDA.mini_t2,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(10),
    fechaValidacion: daysAgo(9),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 8 },
      { tipo: 'PROMO', cantidad: 2 }, // 4 TRABIX
      { tipo: 'SIN_LICOR', cantidad: 3 },
    ],
  });

  // ========================================
  // 9. Ventas modelo 50/50 - V50.con_lote
  // ========================================
  await crearVenta({
    vendedorId: V50.con_lote,
    loteId: LOTE.v50_con_lote,
    tandaId: TANDA.v50_t1,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(50),
    fechaValidacion: daysAgo(49),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 4 },
      { tipo: 'SIN_LICOR', cantidad: 2 },
      { tipo: 'REGALO', cantidad: 1 },
    ],
  });

  // ========================================
  // 10. Ventas para vendedor inactivo con lote - V.inactivo_con_lote
  // ========================================
  await crearVenta({
    vendedorId: V.inactivo_con_lote,
    loteId: LOTE.v_inactivo_lote,
    tandaId: TANDA.inact_t1,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(40),
    fechaValidacion: daysAgo(39),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 3 },
    ],
  });

  // ========================================
  // 11. Ventas para lotes de venta mayor
  // ========================================
  // V.venta_mayor_pend
  await crearVenta({
    vendedorId: V.venta_mayor_pend,
    loteId: LOTE.v_vta_mayor_pend,
    tandaId: TANDA.vmayp_t1,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(45),
    fechaValidacion: daysAgo(44),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 8 },
      { tipo: 'PROMO', cantidad: 2 },
      { tipo: 'SIN_LICOR', cantidad: 5 },
    ],
  });

  // V.venta_mayor_comp
  await crearVenta({
    vendedorId: V.venta_mayor_comp,
    loteId: LOTE.v_vta_mayor_comp,
    tandaId: TANDA.vmayc_t1,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(55),
    fechaValidacion: daysAgo(54),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 6 },
      { tipo: 'PROMO', cantidad: 2 },
      { tipo: 'SIN_LICOR', cantidad: 2 },
    ],
  });

  // V50.con_venta_mayor
  await crearVenta({
    vendedorId: V50.con_venta_mayor,
    loteId: LOTE.v50_vta_mayor,
    tandaId: TANDA.v50vm_t1,
    estado: 'APROBADA',
    fechaRegistro: daysAgo(45),
    fechaValidacion: daysAgo(44),
    detalles: [
      { tipo: 'UNIDAD', cantidad: 10 },
      { tipo: 'PROMO', cantidad: 2 },
      { tipo: 'SIN_LICOR', cantidad: 5 },
    ],
  });

  console.log(`    ✓ ${ventasCreadas} ventas creadas`);
  console.log('      Estados: PENDIENTE×2, APROBADA×14, RECHAZADA×2');
  console.log('      Tipos: UNIDAD, PROMO, SIN_LICOR, REGALO');
}

// ============================================================
// HELPERS LOCALES
// ============================================================
function precioTipo(tipo: string): number {
  switch (tipo) {
    case 'PROMO': return BIZ.precioPromoLicor;
    case 'UNIDAD': return BIZ.precioUnidadLicor;
    case 'SIN_LICOR': return BIZ.precioUnidadSinLicor;
    case 'REGALO': return 0;
    default: return 0;
  }
}

interface DetalleConfig {
  tipo: string;
  cantidad: number;
}

interface VentaConfig {
  vendedorId: string;
  loteId: string;
  tandaId: string;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  fechaRegistro: Date;
  fechaValidacion?: Date;
  detalles: DetalleConfig[];
}
