import { PrismaClient } from '@prisma/client';
import { V, V50, LOTE, TANDA, calcularInversiones, daysAgo } from './helpers';

/**
 * Seed 04: Lotes y Tandas
 * Cubre todos los estados de lotes (CREADO, ACTIVO, FINALIZADO)
 * y tandas (INACTIVA, LIBERADA, EN_TRANSITO, EN_CASA, FINALIZADA)
 * con escenarios de 2 y 3 tandas, lotes forzados, etc.
 */
export async function seedLotesTandas(prisma: PrismaClient) {
  console.log('  → Creando lotes y tandas...');

  // Helper local
  const crearLoteConTandas = async (config: LoteConfig) => {
    const inv = calcularInversiones(config.cantidadTrabix);

    await prisma.lote.create({
      data: {
        id: config.loteId,
        vendedorId: config.vendedorId,
        cantidadTrabix: config.cantidadTrabix,
        modeloNegocio: config.modeloNegocio,
        estado: config.estado,
        inversionTotal: inv.inversionTotal,
        inversionAdmin: inv.inversionAdmin,
        inversionVendedor: inv.inversionVendedor,
        dineroRecaudado: config.dineroRecaudado ?? 0,
        dineroTransferido: config.dineroTransferido ?? 0,
        dineroVendedorDistribuido: config.dineroVendedorDistribuido ?? 0,
        esLoteForzado: config.esLoteForzado ?? false,
        ventaMayorOrigenId: config.ventaMayorOrigenId ?? null,
        fechaCreacion: config.fechaCreacion,
        fechaActivacion: config.fechaActivacion ?? null,
        fechaFinalizacion: config.fechaFinalizacion ?? null,
      },
    });

    for (const t of config.tandas) {
      await prisma.tanda.create({
        data: {
          id: t.id,
          loteId: config.loteId,
          numero: t.numero,
          estado: t.estado,
          stockInicial: t.stockInicial,
          stockActual: t.stockActual,
          stockConsumidoPorMayor: t.stockConsumidoPorMayor ?? 0,
          liberadaPorCuadreMayorId: t.liberadaPorCuadreMayorId ?? null,
          fechaLiberacion: t.fechaLiberacion ?? null,
          fechaEnTransito: t.fechaEnTransito ?? null,
          fechaEnCasa: t.fechaEnCasa ?? null,
          fechaFinalizada: t.fechaFinalizada ?? null,
        },
      });
    }
  };

  // ========================================
  // 1. Lote ACTIVO - V.activo_ok (30u, 2 tandas, T1 en_casa vendiendo, T2 inactiva)
  // ========================================
  await crearLoteConTandas({
    loteId: LOTE.v_activo_lote1,
    vendedorId: V.activo_ok,
    cantidadTrabix: 30,
    modeloNegocio: 'MODELO_60_40',
    estado: 'ACTIVO',
    dineroRecaudado: 40000, // vendió 5 unidades a 8000
    fechaCreacion: daysAgo(55),
    fechaActivacion: daysAgo(50),
    tandas: [
      {
        id: TANDA.activo_t1, numero: 1, estado: 'EN_CASA',
        stockInicial: 15, stockActual: 10,
        fechaLiberacion: daysAgo(50), fechaEnTransito: daysAgo(50), fechaEnCasa: daysAgo(49),
      },
      {
        id: TANDA.activo_t2, numero: 2, estado: 'INACTIVA',
        stockInicial: 15, stockActual: 15,
      },
    ],
  });

  // ========================================
  // 2. Lote CREADO - V.con_lote_creado (25u, esperando activación)
  // ========================================
  await crearLoteConTandas({
    loteId: LOTE.v_creado,
    vendedorId: V.con_lote_creado,
    cantidadTrabix: 25,
    modeloNegocio: 'MODELO_60_40',
    estado: 'CREADO',
    fechaCreacion: daysAgo(2),
    tandas: [
      { id: '00000000-0000-4000-c000-000000000030', numero: 1, estado: 'INACTIVA', stockInicial: 12, stockActual: 12 },
      { id: '00000000-0000-4000-c000-000000000031', numero: 2, estado: 'INACTIVA', stockInicial: 13, stockActual: 13 },
    ],
  });

  // ========================================
  // 3. Lote FINALIZADO - V.con_lote_finalizado (40u, todoo vendido y cuadrado)
  // ========================================
  const inv40 = calcularInversiones(40);
  // dineroRecaudado=300000, invTotal=96000, gananciaAdmin=(300000-96000)*0.4=81600
  // dineroTransferido = invAdmin(48000) + gananciaAdmin(81600) = 129600
  // dineroVendedorDistribuido = invVendedor(48000) + gananciaVendedor(122400) = 170400
  await crearLoteConTandas({
    loteId: LOTE.v_finalizado,
    vendedorId: V.con_lote_finalizado,
    cantidadTrabix: 40,
    modeloNegocio: 'MODELO_60_40',
    estado: 'FINALIZADO',
    dineroRecaudado: 300000,
    dineroTransferido: inv40.inversionAdmin + 81600, // invAdmin(48000) + gananciaAdmin(81600)
    dineroVendedorDistribuido: inv40.inversionVendedor + 122400, // invVend(48000) + gananciaVend(122400)
    fechaCreacion: daysAgo(170),
    fechaActivacion: daysAgo(165),
    fechaFinalizacion: daysAgo(30),
    tandas: [
      {
        id: TANDA.final_t1, numero: 1, estado: 'FINALIZADA',
        stockInicial: 20, stockActual: 0,
        fechaLiberacion: daysAgo(165), fechaEnTransito: daysAgo(165),
        fechaEnCasa: daysAgo(164), fechaFinalizada: daysAgo(60),
      },
      {
        id: TANDA.final_t2, numero: 2, estado: 'FINALIZADA',
        stockInicial: 20, stockActual: 0,
        fechaLiberacion: daysAgo(60), fechaEnTransito: daysAgo(60),
        fechaEnCasa: daysAgo(59), fechaFinalizada: daysAgo(30),
      },
    ],
  });

  // ========================================
  // 4. Lotes múltiples - V.multi_lotes (lote1 ACTIVO 50u, lote2 CREADO 20u)
  // ========================================
  await crearLoteConTandas({
    loteId: LOTE.v_multi_1,
    vendedorId: V.multi_lotes,
    cantidadTrabix: 50,
    modeloNegocio: 'MODELO_60_40',
    estado: 'ACTIVO',
    dineroRecaudado: 80000,
    fechaCreacion: daysAgo(80),
    fechaActivacion: daysAgo(75),
    tandas: [
      {
        id: TANDA.multi1_t1, numero: 1, estado: 'EN_CASA',
        stockInicial: 25, stockActual: 15,
        fechaLiberacion: daysAgo(75), fechaEnTransito: daysAgo(75), fechaEnCasa: daysAgo(74),
      },
      {
        id: TANDA.multi1_t2, numero: 2, estado: 'INACTIVA',
        stockInicial: 25, stockActual: 25,
      },
    ],
  });

  await crearLoteConTandas({
    loteId: LOTE.v_multi_2,
    vendedorId: V.multi_lotes,
    cantidadTrabix: 20,
    modeloNegocio: 'MODELO_60_40',
    estado: 'CREADO',
    fechaCreacion: daysAgo(5),
    tandas: [
      { id: '00000000-0000-4000-c000-000000000032', numero: 1, estado: 'INACTIVA', stockInicial: 10, stockActual: 10 },
      { id: '00000000-0000-4000-c000-000000000033', numero: 2, estado: 'INACTIVA', stockInicial: 10, stockActual: 10 },
    ],
  });

  // ========================================
  // 5. Lote ACTIVO vendedor inactivo - V.inactivo_con_lote (30u)
  // ========================================
  await crearLoteConTandas({
    loteId: LOTE.v_inactivo_lote,
    vendedorId: V.inactivo_con_lote,
    cantidadTrabix: 30,
    modeloNegocio: 'MODELO_60_40',
    estado: 'ACTIVO',
    dineroRecaudado: 24000,
    fechaCreacion: daysAgo(55),
    fechaActivacion: daysAgo(50),
    tandas: [
      {
        id: TANDA.inact_t1, numero: 1, estado: 'EN_CASA',
        stockInicial: 15, stockActual: 12,
        fechaLiberacion: daysAgo(50), fechaEnTransito: daysAgo(50), fechaEnCasa: daysAgo(49),
      },
      {
        id: TANDA.inact_t2, numero: 2, estado: 'INACTIVA',
        stockInicial: 15, stockActual: 15,
      },
    ],
  });

  // ========================================
  // 6. Lote para cuadre PENDIENTE - V.cuadre_pendiente (60u, 3 tandas)
  //    T1 en_casa (stock bajo → cuadre activado)
  // ========================================
  await crearLoteConTandas({
    loteId: LOTE.v_cuadre_pend,
    vendedorId: V.cuadre_pendiente,
    cantidadTrabix: 60,
    modeloNegocio: 'MODELO_60_40',
    estado: 'ACTIVO',
    dineroRecaudado: 120000,
    fechaCreacion: daysAgo(70),
    fechaActivacion: daysAgo(65),
    tandas: [
      {
        id: TANDA.cuadre_t1, numero: 1, estado: 'EN_CASA',
        stockInicial: 20, stockActual: 3, // vendió mucho, trigger cuadre
        fechaLiberacion: daysAgo(65), fechaEnTransito: daysAgo(65), fechaEnCasa: daysAgo(64),
      },
      {
        id: TANDA.cuadre_t2, numero: 2, estado: 'INACTIVA',
        stockInicial: 20, stockActual: 20,
      },
      {
        id: TANDA.cuadre_t3, numero: 3, estado: 'INACTIVA',
        stockInicial: 20, stockActual: 20,
      },
    ],
  });

  // ========================================
  // 7. Lote para cuadre EXITOSO - V.cuadre_exitoso (40u, 2 tandas)
  //    T1 finalizada (cuadre exitoso), T2 en_casa
  // ========================================
  await crearLoteConTandas({
    loteId: LOTE.v_cuadre_exit,
    vendedorId: V.cuadre_exitoso,
    cantidadTrabix: 40,
    modeloNegocio: 'MODELO_60_40',
    estado: 'ACTIVO',
    dineroRecaudado: 160000,
    dineroTransferido: 48000, // ya transfirió inversión admin
    fechaCreacion: daysAgo(95),
    fechaActivacion: daysAgo(90),
    tandas: [
      {
        id: TANDA.exit_t1, numero: 1, estado: 'FINALIZADA',
        stockInicial: 20, stockActual: 0,
        fechaLiberacion: daysAgo(90), fechaEnTransito: daysAgo(90),
        fechaEnCasa: daysAgo(89), fechaFinalizada: daysAgo(40),
      },
      {
        id: TANDA.exit_t2, numero: 2, estado: 'EN_CASA',
        stockInicial: 20, stockActual: 8,
        fechaLiberacion: daysAgo(40), fechaEnTransito: daysAgo(40), fechaEnCasa: daysAgo(39),
      },
    ],
  });

  // ========================================
  // 8. Lote para mini-cuadre PENDIENTE - V.mini_cuadre_pend (30u)
  //    Última tanda stock = 0 → mini-cuadre activado
  // ========================================
  await crearLoteConTandas({
    loteId: LOTE.v_mini_cuadre,
    vendedorId: V.mini_cuadre_pend,
    cantidadTrabix: 30,
    modeloNegocio: 'MODELO_60_40',
    estado: 'ACTIVO',
    dineroRecaudado: 200000,
    dineroTransferido: 36000,
    fechaCreacion: daysAgo(45),
    fechaActivacion: daysAgo(40),
    tandas: [
      {
        id: TANDA.mini_t1, numero: 1, estado: 'FINALIZADA',
        stockInicial: 15, stockActual: 0,
        fechaLiberacion: daysAgo(40), fechaEnTransito: daysAgo(40),
        fechaEnCasa: daysAgo(39), fechaFinalizada: daysAgo(15),
      },
      {
        id: TANDA.mini_t2, numero: 2, estado: 'EN_CASA',
        stockInicial: 15, stockActual: 0, // agotado → mini-cuadre
        fechaLiberacion: daysAgo(15), fechaEnTransito: daysAgo(15), fechaEnCasa: daysAgo(14),
      },
    ],
  });

  // ========================================
  // 9. Lote para ventas PENDIENTES - V.con_ventas_pend (30u)
  // ========================================
  await crearLoteConTandas({
    loteId: LOTE.v_vta_pend,
    vendedorId: V.con_ventas_pend,
    cantidadTrabix: 30,
    modeloNegocio: 'MODELO_60_40',
    estado: 'ACTIVO',
    dineroRecaudado: 0,
    fechaCreacion: daysAgo(35),
    fechaActivacion: daysAgo(30),
    tandas: [
      {
        id: TANDA.vpend_t1, numero: 1, estado: 'EN_CASA',
        stockInicial: 15, stockActual: 10, // 5 en pendientes
        fechaLiberacion: daysAgo(30), fechaEnTransito: daysAgo(30), fechaEnCasa: daysAgo(29),
      },
      {
        id: TANDA.vpend_t2, numero: 2, estado: 'INACTIVA',
        stockInicial: 15, stockActual: 15,
      },
    ],
  });

  // ========================================
  // 10. Lote para ventas RECHAZADAS - V.con_ventas_rech (30u)
  // ========================================
  await crearLoteConTandas({
    loteId: LOTE.v_vta_rech,
    vendedorId: V.con_ventas_rech,
    cantidadTrabix: 30,
    modeloNegocio: 'MODELO_60_40',
    estado: 'ACTIVO',
    dineroRecaudado: 16000, // 2 unidades aprobadas
    fechaCreacion: daysAgo(30),
    fechaActivacion: daysAgo(25),
    tandas: [
      {
        id: TANDA.vrech_t1, numero: 1, estado: 'EN_CASA',
        stockInicial: 15, stockActual: 13,
        fechaLiberacion: daysAgo(25), fechaEnTransito: daysAgo(25), fechaEnCasa: daysAgo(24),
      },
      {
        id: TANDA.vrech_t2, numero: 2, estado: 'INACTIVA',
        stockInicial: 15, stockActual: 15,
      },
    ],
  });

  // ========================================
  // 11. Lote para venta mayor PENDIENTE - V.venta_mayor_pend (50u)
  //     T1 en_casa, T2 LIBERADA
  // ========================================
  await crearLoteConTandas({
    loteId: LOTE.v_vta_mayor_pend,
    vendedorId: V.venta_mayor_pend,
    cantidadTrabix: 50,
    modeloNegocio: 'MODELO_60_40',
    estado: 'ACTIVO',
    dineroRecaudado: 60000,
    fechaCreacion: daysAgo(60),
    fechaActivacion: daysAgo(55),
    tandas: [
      {
        id: TANDA.vmayp_t1, numero: 1, estado: 'EN_CASA',
        stockInicial: 25, stockActual: 10,
        fechaLiberacion: daysAgo(55), fechaEnTransito: daysAgo(55), fechaEnCasa: daysAgo(54),
      },
      {
        id: TANDA.vmayp_t2, numero: 2, estado: 'LIBERADA',
        stockInicial: 25, stockActual: 25,
        fechaLiberacion: daysAgo(10),
      },
    ],
  });

  // ========================================
  // 12. Lote para venta mayor COMPLETADA - V.venta_mayor_comp (40u)
  // ========================================
  await crearLoteConTandas({
    loteId: LOTE.v_vta_mayor_comp,
    vendedorId: V.venta_mayor_comp,
    cantidadTrabix: 40,
    modeloNegocio: 'MODELO_60_40',
    estado: 'ACTIVO',
    dineroRecaudado: 100000,
    fechaCreacion: daysAgo(75),
    fechaActivacion: daysAgo(70),
    tandas: [
      {
        id: TANDA.vmayc_t1, numero: 1, estado: 'EN_CASA',
        stockInicial: 20, stockActual: 5,
        stockConsumidoPorMayor: 5,
        fechaLiberacion: daysAgo(70), fechaEnTransito: daysAgo(70), fechaEnCasa: daysAgo(69),
      },
      {
        id: TANDA.vmayc_t2, numero: 2, estado: 'EN_TRANSITO',
        stockInicial: 20, stockActual: 20,
        fechaLiberacion: daysAgo(5), fechaEnTransito: daysAgo(4),
      },
    ],
  });

  // ========================================
  // 13. Lote 50/50 - V50.con_lote (40u, modelo 50/50)
  //     T1 en_casa, vendiendo
  // ========================================
  await crearLoteConTandas({
    loteId: LOTE.v50_con_lote,
    vendedorId: V50.con_lote,
    cantidadTrabix: 40,
    modeloNegocio: 'MODELO_50_50',
    estado: 'ACTIVO',
    dineroRecaudado: 56000,
    fechaCreacion: daysAgo(65),
    fechaActivacion: daysAgo(60),
    tandas: [
      {
        id: TANDA.v50_t1, numero: 1, estado: 'EN_CASA',
        stockInicial: 20, stockActual: 13,
        fechaLiberacion: daysAgo(60), fechaEnTransito: daysAgo(60), fechaEnCasa: daysAgo(59),
      },
      {
        id: TANDA.v50_t2, numero: 2, estado: 'INACTIVA',
        stockInicial: 20, stockActual: 20,
      },
    ],
  });

  // ========================================
  // 14. Lote FORZADO - V.lote_forzado (25u, creado por venta al mayor)
  //     T1 LIBERADA
  // ========================================
  await crearLoteConTandas({
    loteId: LOTE.v_lote_forzado,
    vendedorId: V.lote_forzado,
    cantidadTrabix: 25,
    modeloNegocio: 'MODELO_60_40',
    estado: 'ACTIVO',
    esLoteForzado: true,
    fechaCreacion: daysAgo(10),
    fechaActivacion: daysAgo(10),
    tandas: [
      {
        id: TANDA.forz_t1, numero: 1, estado: 'LIBERADA',
        stockInicial: 12, stockActual: 12,
        fechaLiberacion: daysAgo(10),
      },
      {
        id: TANDA.forz_t2, numero: 2, estado: 'INACTIVA',
        stockInicial: 13, stockActual: 13,
      },
    ],
  });

  // ========================================
  // 15. Lote V50 venta mayor - V50.con_venta_mayor (50u, modelo 50/50)
  // ========================================
  await crearLoteConTandas({
    loteId: LOTE.v50_vta_mayor,
    vendedorId: V50.con_venta_mayor,
    cantidadTrabix: 50,
    modeloNegocio: 'MODELO_50_50',
    estado: 'ACTIVO',
    dineroRecaudado: 90000,
    fechaCreacion: daysAgo(60),
    fechaActivacion: daysAgo(55),
    tandas: [
      {
        id: TANDA.v50vm_t1, numero: 1, estado: 'EN_CASA',
        stockInicial: 25, stockActual: 8,
        fechaLiberacion: daysAgo(55), fechaEnTransito: daysAgo(55), fechaEnCasa: daysAgo(54),
      },
      {
        id: TANDA.v50vm_t2, numero: 2, estado: 'INACTIVA',
        stockInicial: 25, stockActual: 25,
      },
    ],
  });

  console.log('    ✓ 15 lotes creados con sus tandas');
  console.log('      Estados lotes: 2 CREADO, 11 ACTIVO, 1 FINALIZADO, 1 FORZADO');
  console.log('      Estados tandas: INACTIVA, LIBERADA, EN_TRANSITO, EN_CASA, FINALIZADA');
}

// ============================================================
// TYPES
// ============================================================
interface TandaConfig {
  id: string;
  numero: number;
  estado: 'INACTIVA' | 'LIBERADA' | 'EN_TRANSITO' | 'EN_CASA' | 'FINALIZADA';
  stockInicial: number;
  stockActual: number;
  stockConsumidoPorMayor?: number;
  liberadaPorCuadreMayorId?: string;
  fechaLiberacion?: Date;
  fechaEnTransito?: Date;
  fechaEnCasa?: Date;
  fechaFinalizada?: Date;
}

interface LoteConfig {
  loteId: string;
  vendedorId: string;
  cantidadTrabix: number;
  modeloNegocio: 'MODELO_60_40' | 'MODELO_50_50';
  estado: 'CREADO' | 'ACTIVO' | 'FINALIZADO';
  dineroRecaudado?: number;
  dineroTransferido?: number;
  dineroVendedorDistribuido?: number;
  esLoteForzado?: boolean;
  ventaMayorOrigenId?: string;
  fechaCreacion: Date;
  fechaActivacion?: Date;
  fechaFinalizacion?: Date;
  tandas: TandaConfig[];
}
