import { PrismaClient } from '@prisma/client';
import { LOTE, TANDA, calcularInversiones, daysAgo } from './helpers';

/**
 * Seed 05: Cuadres y Mini-cuadres
 *
 * Replica el comportamiento de LoteActivadoHandler:
 * - 2 tandas → T1=MIXTO (montoEsperado=invAdmin), T2=GANANCIAS (montoEsperado=0)
 * - 3 tandas → T1=INVERSION_ADMIN (montoEsperado=invAdmin), T2=GANANCIAS(0), T3=GANANCIAS(0)
 * - Un MiniCuadre INACTIVO por lote (apuntando a la última tanda)
 *
 * Lotes excluidos (sin cuadres/mini-cuadres):
 * - CREADO: v_creado (2), v_multi_2 (5)
 * - Forzado: v_lote_forzado (15) — activado y finalizado en mismo transaction, handler no aplica
 */

// ============================================================
// IDS PREDEFINIDOS
// ============================================================

/** Cuadre IDs: 00000000-0000-4000-d000-NNNNNNNNNNNN */
const CUADRE = {
  activo_t1:    '00000000-0000-4000-d000-000000000001', // Lote 1 T1 MIXTO INACTIVO
  activo_t2:    '00000000-0000-4000-d000-000000000002', // Lote 1 T2 GANANCIAS INACTIVO
  final_t1:     '00000000-0000-4000-d000-000000000003', // Lote 3 T1 MIXTO EXITOSO
  final_t2:     '00000000-0000-4000-d000-000000000004', // Lote 3 T2 GANANCIAS EXITOSO
  multi1_t1:    '00000000-0000-4000-d000-000000000005', // Lote 4 T1 MIXTO INACTIVO
  multi1_t2:    '00000000-0000-4000-d000-000000000006', // Lote 4 T2 GANANCIAS INACTIVO
  inact_t1:     '00000000-0000-4000-d000-000000000007', // Lote 6 T1 MIXTO INACTIVO
  inact_t2:     '00000000-0000-4000-d000-000000000008', // Lote 6 T2 GANANCIAS INACTIVO
  cuadre_t1:    '00000000-0000-4000-d000-000000000009', // Lote 7 T1 INVERSION_ADMIN PENDIENTE
  cuadre_t2:    '00000000-0000-4000-d000-000000000010', // Lote 7 T2 GANANCIAS INACTIVO
  cuadre_t3:    '00000000-0000-4000-d000-000000000011', // Lote 7 T3 GANANCIAS INACTIVO
  exit_t1:      '00000000-0000-4000-d000-000000000012', // Lote 8 T1 MIXTO EXITOSO
  exit_t2:      '00000000-0000-4000-d000-000000000013', // Lote 8 T2 GANANCIAS INACTIVO
  mini_t1:      '00000000-0000-4000-d000-000000000014', // Lote 9 T1 MIXTO EXITOSO
  mini_t2:      '00000000-0000-4000-d000-000000000015', // Lote 9 T2 GANANCIAS INACTIVO
  vpend_t1:     '00000000-0000-4000-d000-000000000016', // Lote 10 T1 MIXTO INACTIVO
  vpend_t2:     '00000000-0000-4000-d000-000000000017', // Lote 10 T2 GANANCIAS INACTIVO
  vrech_t1:     '00000000-0000-4000-d000-000000000018', // Lote 11 T1 MIXTO INACTIVO
  vrech_t2:     '00000000-0000-4000-d000-000000000019', // Lote 11 T2 GANANCIAS INACTIVO
  vmayp_t1:     '00000000-0000-4000-d000-000000000020', // Lote 12 T1 MIXTO INACTIVO
  vmayp_t2:     '00000000-0000-4000-d000-000000000021', // Lote 12 T2 GANANCIAS INACTIVO
  vmayc_t1:     '00000000-0000-4000-d000-000000000022', // Lote 13 T1 MIXTO PENDIENTE
  vmayc_t2:     '00000000-0000-4000-d000-000000000023', // Lote 13 T2 GANANCIAS INACTIVO
  v50_t1:       '00000000-0000-4000-d000-000000000024', // Lote 14 T1 MIXTO INACTIVO
  v50_t2:       '00000000-0000-4000-d000-000000000025', // Lote 14 T2 GANANCIAS INACTIVO
  v50vm_t1:     '00000000-0000-4000-d000-000000000026', // Lote 16 T1 MIXTO INACTIVO
  v50vm_t2:     '00000000-0000-4000-d000-000000000027', // Lote 16 T2 GANANCIAS INACTIVO
};

/** MiniCuadre IDs: 00000000-0000-4000-e000-NNNNNNNNNNNN */
const MINI = {
  lote1:   '00000000-0000-4000-e000-000000000001', // Lote 1 INACTIVO
  lote3:   '00000000-0000-4000-e000-000000000002', // Lote 3 EXITOSO (auto-confirmado)
  lote4:   '00000000-0000-4000-e000-000000000003', // Lote 4 INACTIVO
  lote6:   '00000000-0000-4000-e000-000000000004', // Lote 6 INACTIVO
  lote7:   '00000000-0000-4000-e000-000000000005', // Lote 7 INACTIVO
  lote8:   '00000000-0000-4000-e000-000000000006', // Lote 8 INACTIVO
  lote9:   '00000000-0000-4000-e000-000000000007', // Lote 9 PENDIENTE (montoFinal=51200)
  lote10:  '00000000-0000-4000-e000-000000000008', // Lote 10 INACTIVO
  lote11:  '00000000-0000-4000-e000-000000000009', // Lote 11 INACTIVO
  lote12:  '00000000-0000-4000-e000-000000000010', // Lote 12 INACTIVO
  lote13:  '00000000-0000-4000-e000-000000000011', // Lote 13 INACTIVO
  lote14:  '00000000-0000-4000-e000-000000000012', // Lote 14 INACTIVO
  lote16:  '00000000-0000-4000-e000-000000000013', // Lote 16 INACTIVO
};

export async function seedCuadresMiniCuadres(prisma: PrismaClient) {
  console.log('  → Creando cuadres y mini-cuadres...');

  // =========================================================
  // Inversiones por cantidad (inversionAdmin = cantidadTrabix * 2400 * 0.5)
  // =========================================================
  const inv30 = calcularInversiones(30); // invAdmin=36000
  const inv40 = calcularInversiones(40); // invAdmin=48000
  const inv50 = calcularInversiones(50); // invAdmin=60000
  const inv60 = calcularInversiones(60); // invAdmin=72000

  // =========================================================
  // Lote 1 — v_activo_lote1 (30u, 2 tandas, T1 EN_CASA stock=10, T2 INACTIVA)
  // Cuadres: T1=MIXTO INACTIVO, T2=GANANCIAS INACTIVO | Mini: INACTIVO
  // =========================================================
  await prisma.cuadre.create({
    data: {
      id: CUADRE.activo_t1,
      tandaId: TANDA.activo_t1,
      concepto: 'MIXTO',
      estado: 'INACTIVO',
      montoEsperado: String(inv30.inversionAdmin),
      montoFaltante: '0',
    },
  });
  await prisma.cuadre.create({
    data: {
      id: CUADRE.activo_t2,
      tandaId: TANDA.activo_t2,
      concepto: 'GANANCIAS',
      estado: 'INACTIVO',
      montoEsperado: '0',
      montoFaltante: '0',
    },
  });
  await prisma.miniCuadre.create({
    data: {
      id: MINI.lote1,
      loteId: LOTE.v_activo_lote1,
      tandaId: TANDA.activo_t2,
      estado: 'INACTIVO',
    },
  });

  // =========================================================
  // Lote 3 — v_finalizado (40u, 2 tandas, ambas FINALIZADA)
  // Cuadres: T1=MIXTO EXITOSO, T2=GANANCIAS EXITOSO | Mini: EXITOSO (auto-confirmado)
  // gananciaAdmin = (300000-96000)*0.4 = 81600
  // =========================================================
  await prisma.cuadre.create({
    data: {
      id: CUADRE.final_t1,
      tandaId: TANDA.final_t1,
      concepto: 'MIXTO',
      estado: 'EXITOSO',
      montoEsperado: String(inv40.inversionAdmin),
      montoFaltante: '0',
      montoCubiertoPorMayor: String(inv40.inversionAdmin),
      fechaExitoso: daysAgo(60),
      desglose: { inversionAdmin: inv40.inversionAdmin, gananciasAdmin: 0, mensualidades: 0, deudaDano: 0, deudaPerdida: 0 },
    },
  });
  await prisma.cuadre.create({
    data: {
      id: CUADRE.final_t2,
      tandaId: TANDA.final_t2,
      concepto: 'GANANCIAS',
      estado: 'EXITOSO',
      montoEsperado: '81600',      // gananciaAdmin total
      montoRecibido: '81600',      // pagado directamente por admin
      montoFaltante: '0',
      fechaExitoso: daysAgo(30),
      desglose: { inversionAdmin: 0, gananciasAdmin: 81600, mensualidades: 0, deudaDano: 0, deudaPerdida: 0 },
    },
  });
  await prisma.miniCuadre.create({
    data: {
      id: MINI.lote3,
      loteId: LOTE.v_finalizado,
      tandaId: TANDA.final_t2,
      estado: 'EXITOSO',
      montoFinal: '0',   // auto-confirmado: gananciasYaPagadas = gananciaAdmin completa
      fechaExitoso: daysAgo(30),
    },
  });

  // =========================================================
  // Lote 4 — v_multi_1 (50u, 2 tandas, T1 EN_CASA stock=15, T2 INACTIVA)
  // Cuadres: T1=MIXTO INACTIVO, T2=GANANCIAS INACTIVO | Mini: INACTIVO
  // =========================================================
  await prisma.cuadre.create({
    data: {
      id: CUADRE.multi1_t1,
      tandaId: TANDA.multi1_t1,
      concepto: 'MIXTO',
      estado: 'INACTIVO',
      montoEsperado: String(inv50.inversionAdmin),
      montoFaltante: '0',
    },
  });
  await prisma.cuadre.create({
    data: {
      id: CUADRE.multi1_t2,
      tandaId: TANDA.multi1_t2,
      concepto: 'GANANCIAS',
      estado: 'INACTIVO',
      montoEsperado: '0',
      montoFaltante: '0',
    },
  });
  await prisma.miniCuadre.create({
    data: {
      id: MINI.lote4,
      loteId: LOTE.v_multi_1,
      tandaId: TANDA.multi1_t2,
      estado: 'INACTIVO',
    },
  });

  // =========================================================
  // Lote 6 — v_inactivo_lote (30u, 2 tandas, T1 EN_CASA stock=12, T2 INACTIVA)
  // Cuadres: T1=MIXTO INACTIVO, T2=GANANCIAS INACTIVO | Mini: INACTIVO
  // =========================================================
  await prisma.cuadre.create({
    data: {
      id: CUADRE.inact_t1,
      tandaId: TANDA.inact_t1,
      concepto: 'MIXTO',
      estado: 'INACTIVO',
      montoEsperado: String(inv30.inversionAdmin),
      montoFaltante: '0',
    },
  });
  await prisma.cuadre.create({
    data: {
      id: CUADRE.inact_t2,
      tandaId: TANDA.inact_t2,
      concepto: 'GANANCIAS',
      estado: 'INACTIVO',
      montoEsperado: '0',
      montoFaltante: '0',
    },
  });
  await prisma.miniCuadre.create({
    data: {
      id: MINI.lote6,
      loteId: LOTE.v_inactivo_lote,
      tandaId: TANDA.inact_t2,
      estado: 'INACTIVO',
    },
  });

  // =========================================================
  // Lote 7 — v_cuadre_pend (60u, 3 tandas, T1 EN_CASA stock=3 → cuadre PENDIENTE)
  // Cuadres: T1=INVERSION_ADMIN PENDIENTE, T2=GANANCIAS INACTIVO, T3=GANANCIAS INACTIVO
  // Mini: INACTIVO (T3 tiene stock=20)
  // =========================================================
  await prisma.cuadre.create({
    data: {
      id: CUADRE.cuadre_t1,
      tandaId: TANDA.cuadre_t1,
      concepto: 'INVERSION_ADMIN',
      estado: 'PENDIENTE',
      montoEsperado: String(inv60.inversionAdmin),
      montoFaltante: String(inv60.inversionAdmin),
      fechaPendiente: daysAgo(5),
    },
  });
  await prisma.cuadre.create({
    data: {
      id: CUADRE.cuadre_t2,
      tandaId: TANDA.cuadre_t2,
      concepto: 'GANANCIAS',
      estado: 'INACTIVO',
      montoEsperado: '0',
      montoFaltante: '0',
    },
  });
  await prisma.cuadre.create({
    data: {
      id: CUADRE.cuadre_t3,
      tandaId: TANDA.cuadre_t3,
      concepto: 'GANANCIAS',
      estado: 'INACTIVO',
      montoEsperado: '0',
      montoFaltante: '0',
    },
  });
  await prisma.miniCuadre.create({
    data: {
      id: MINI.lote7,
      loteId: LOTE.v_cuadre_pend,
      tandaId: TANDA.cuadre_t3,
      estado: 'INACTIVO',
    },
  });

  // =========================================================
  // Lote 8 — v_cuadre_exit (40u, 2 tandas, T1 FINALIZADA, T2 EN_CASA stock=8)
  // Cuadres: T1=MIXTO EXITOSO (cerrado por cuadre mayor), T2=GANANCIAS INACTIVO
  // Mini: INACTIVO (T2 aún tiene stock)
  // =========================================================
  await prisma.cuadre.create({
    data: {
      id: CUADRE.exit_t1,
      tandaId: TANDA.exit_t1,
      concepto: 'MIXTO',
      estado: 'EXITOSO',
      montoEsperado: String(inv40.inversionAdmin),
      montoFaltante: '0',
      montoCubiertoPorMayor: String(inv40.inversionAdmin),
      fechaExitoso: daysAgo(40),
      desglose: { inversionAdmin: inv40.inversionAdmin, gananciasAdmin: 0, mensualidades: 0, deudaDano: 0, deudaPerdida: 0 },
    },
  });
  await prisma.cuadre.create({
    data: {
      id: CUADRE.exit_t2,
      tandaId: TANDA.exit_t2,
      concepto: 'GANANCIAS',
      estado: 'INACTIVO',
      montoEsperado: '0',
      montoFaltante: '0',
    },
  });
  await prisma.miniCuadre.create({
    data: {
      id: MINI.lote8,
      loteId: LOTE.v_cuadre_exit,
      tandaId: TANDA.exit_t2,
      estado: 'INACTIVO',
    },
  });

  // =========================================================
  // Lote 9 — v_mini_cuadre (30u, 2 tandas, T1 FINALIZADA, T2 EN_CASA stock=0)
  // Cuadres: T1=MIXTO EXITOSO, T2=GANANCIAS INACTIVO (stock fue a 0 sin trigger cuadre)
  // Mini: PENDIENTE (stock última tanda = 0, no hay cuadres PENDIENTE)
  // gananciaAdmin = (200000 - 72000) * 0.4 = 51200
  // gananciasYaPagadas = T1.desglose.gananciasAdmin = 0
  // montoFinal = 51200
  // =========================================================
  await prisma.cuadre.create({
    data: {
      id: CUADRE.mini_t1,
      tandaId: TANDA.mini_t1,
      concepto: 'MIXTO',
      estado: 'EXITOSO',
      montoEsperado: String(inv30.inversionAdmin),
      montoFaltante: '0',
      montoCubiertoPorMayor: String(inv30.inversionAdmin),
      fechaExitoso: daysAgo(15),
      desglose: { inversionAdmin: inv30.inversionAdmin, gananciasAdmin: 0, mensualidades: 0, deudaDano: 0, deudaPerdida: 0 },
    },
  });
  await prisma.cuadre.create({
    data: {
      id: CUADRE.mini_t2,
      tandaId: TANDA.mini_t2,
      concepto: 'GANANCIAS',
      estado: 'INACTIVO',
      montoEsperado: '0',
      montoFaltante: '0',
    },
  });
  await prisma.miniCuadre.create({
    data: {
      id: MINI.lote9,
      loteId: LOTE.v_mini_cuadre,
      tandaId: TANDA.mini_t2,
      estado: 'PENDIENTE',
      montoFinal: '51200', // (200000-72000)*0.4
      fechaPendiente: daysAgo(14),
    },
  });

  // =========================================================
  // Lote 10 — v_vta_pend (30u, 2 tandas, T1 EN_CASA stock=10, T2 INACTIVA)
  // =========================================================
  await prisma.cuadre.create({
    data: {
      id: CUADRE.vpend_t1,
      tandaId: TANDA.vpend_t1,
      concepto: 'MIXTO',
      estado: 'INACTIVO',
      montoEsperado: String(inv30.inversionAdmin),
      montoFaltante: '0',
    },
  });
  await prisma.cuadre.create({
    data: {
      id: CUADRE.vpend_t2,
      tandaId: TANDA.vpend_t2,
      concepto: 'GANANCIAS',
      estado: 'INACTIVO',
      montoEsperado: '0',
      montoFaltante: '0',
    },
  });
  await prisma.miniCuadre.create({
    data: {
      id: MINI.lote10,
      loteId: LOTE.v_vta_pend,
      tandaId: TANDA.vpend_t2,
      estado: 'INACTIVO',
    },
  });

  // =========================================================
  // Lote 11 — v_vta_rech (30u, 2 tandas, T1 EN_CASA stock=13, T2 INACTIVA)
  // =========================================================
  await prisma.cuadre.create({
    data: {
      id: CUADRE.vrech_t1,
      tandaId: TANDA.vrech_t1,
      concepto: 'MIXTO',
      estado: 'INACTIVO',
      montoEsperado: String(inv30.inversionAdmin),
      montoFaltante: '0',
    },
  });
  await prisma.cuadre.create({
    data: {
      id: CUADRE.vrech_t2,
      tandaId: TANDA.vrech_t2,
      concepto: 'GANANCIAS',
      estado: 'INACTIVO',
      montoEsperado: '0',
      montoFaltante: '0',
    },
  });
  await prisma.miniCuadre.create({
    data: {
      id: MINI.lote11,
      loteId: LOTE.v_vta_rech,
      tandaId: TANDA.vrech_t2,
      estado: 'INACTIVO',
    },
  });

  // =========================================================
  // Lote 12 — v_vta_mayor_pend (50u, 2 tandas, T1 EN_CASA stock=10, T2 LIBERADA)
  // =========================================================
  await prisma.cuadre.create({
    data: {
      id: CUADRE.vmayp_t1,
      tandaId: TANDA.vmayp_t1,
      concepto: 'MIXTO',
      estado: 'INACTIVO',
      montoEsperado: String(inv50.inversionAdmin),
      montoFaltante: '0',
    },
  });
  await prisma.cuadre.create({
    data: {
      id: CUADRE.vmayp_t2,
      tandaId: TANDA.vmayp_t2,
      concepto: 'GANANCIAS',
      estado: 'INACTIVO',
      montoEsperado: '0',
      montoFaltante: '0',
    },
  });
  await prisma.miniCuadre.create({
    data: {
      id: MINI.lote12,
      loteId: LOTE.v_vta_mayor_pend,
      tandaId: TANDA.vmayp_t2,
      estado: 'INACTIVO',
    },
  });

  // =========================================================
  // Lote 13 — v_vta_mayor_comp (40u, 2 tandas, T1 EN_CASA stock=5, T2 EN_TRANSITO)
  // T1 stock=5/20 = 25% → threshold triggered → PENDIENTE
  // =========================================================
  await prisma.cuadre.create({
    data: {
      id: CUADRE.vmayc_t1,
      tandaId: TANDA.vmayc_t1,
      concepto: 'MIXTO',
      estado: 'PENDIENTE',
      montoEsperado: String(inv40.inversionAdmin),
      montoFaltante: String(inv40.inversionAdmin),
      fechaPendiente: daysAgo(10),
    },
  });
  await prisma.cuadre.create({
    data: {
      id: CUADRE.vmayc_t2,
      tandaId: TANDA.vmayc_t2,
      concepto: 'GANANCIAS',
      estado: 'INACTIVO',
      montoEsperado: '0',
      montoFaltante: '0',
    },
  });
  await prisma.miniCuadre.create({
    data: {
      id: MINI.lote13,
      loteId: LOTE.v_vta_mayor_comp,
      tandaId: TANDA.vmayc_t2,
      estado: 'INACTIVO',
    },
  });

  // =========================================================
  // Lote 14 — v50_con_lote (40u, 2 tandas, MODELO_50_50, T1 EN_CASA stock=13, T2 INACTIVA)
  // =========================================================
  await prisma.cuadre.create({
    data: {
      id: CUADRE.v50_t1,
      tandaId: TANDA.v50_t1,
      concepto: 'MIXTO',
      estado: 'INACTIVO',
      montoEsperado: String(inv40.inversionAdmin),
      montoFaltante: '0',
    },
  });
  await prisma.cuadre.create({
    data: {
      id: CUADRE.v50_t2,
      tandaId: TANDA.v50_t2,
      concepto: 'GANANCIAS',
      estado: 'INACTIVO',
      montoEsperado: '0',
      montoFaltante: '0',
    },
  });
  await prisma.miniCuadre.create({
    data: {
      id: MINI.lote14,
      loteId: LOTE.v50_con_lote,
      tandaId: TANDA.v50_t2,
      estado: 'INACTIVO',
    },
  });

  // =========================================================
  // Lote 16 — v50_vta_mayor (50u, 2 tandas, MODELO_50_50, T1 EN_CASA stock=8, T2 INACTIVA)
  // =========================================================
  await prisma.cuadre.create({
    data: {
      id: CUADRE.v50vm_t1,
      tandaId: TANDA.v50vm_t1,
      concepto: 'MIXTO',
      estado: 'INACTIVO',
      montoEsperado: String(inv50.inversionAdmin),
      montoFaltante: '0',
    },
  });
  await prisma.cuadre.create({
    data: {
      id: CUADRE.v50vm_t2,
      tandaId: TANDA.v50vm_t2,
      concepto: 'GANANCIAS',
      estado: 'INACTIVO',
      montoEsperado: '0',
      montoFaltante: '0',
    },
  });
  await prisma.miniCuadre.create({
    data: {
      id: MINI.lote16,
      loteId: LOTE.v50_vta_mayor,
      tandaId: TANDA.v50vm_t2,
      estado: 'INACTIVO',
    },
  });

  console.log('    ✓ 27 cuadres creados');
  console.log('    ✓ 13 mini-cuadres creados');
  console.log('      Estados cuadres: INACTIVO×19, PENDIENTE×2, EXITOSO×6');
  console.log('      Estados mini-cuadres: INACTIVO×11, PENDIENTE×1, EXITOSO×1');
}

// Export IDs for use by later seeds (ventas mayor, etc.)
export { CUADRE as CUADRE_ID, MINI as MINI_ID };
