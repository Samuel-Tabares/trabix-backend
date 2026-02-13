import { PrismaClient } from '@prisma/client';
import { LOTE, TANDA, calcularInversiones, daysAgo } from './helpers';

/**
 * Seed 06: Cuadres normales y Mini-cuadres
 * Cubre todos los estados: INACTIVO, PENDIENTE, EXITOSO
 * Conceptos: INVERSION_ADMIN, GANANCIAS, MIXTO
 */
export async function seedCuadres(prisma: PrismaClient) {
  console.log('  → Creando cuadres y mini-cuadres...');

  // ========================================
  // CUADRES NORMALES
  // ========================================

  // 1. Cuadre INACTIVO - Tanda activo_t1 de V.activo_ok (aún no se ha disparado)
  await prisma.cuadre.create({
    data: {
      tandaId: TANDA.activo_t1,
      estado: 'INACTIVO',
      concepto: 'INVERSION_ADMIN',
      montoEsperado: calcularInversiones(30).inversionAdmin,
      montoRecibido: 0,
      montoFaltante: calcularInversiones(30).inversionAdmin,
      montoCubiertoPorMayor: 0,
    },
  });

  // 2. Cuadre INACTIVO - T2 de V.activo_ok
  await prisma.cuadre.create({
    data: {
      tandaId: TANDA.activo_t2,
      estado: 'INACTIVO',
      concepto: 'GANANCIAS',
      montoEsperado: 0, // se calcula cuando se activa
      montoRecibido: 0,
      montoFaltante: 0,
      montoCubiertoPorMayor: 0,
    },
  });

  // 3. Cuadre PENDIENTE - T1 de V.cuadre_pendiente (60u, 3 tandas)
  //    Concepto INVERSION_ADMIN (T1 de 3 tandas)
  const inv60 = calcularInversiones(60);
  await prisma.cuadre.create({
    data: {
      tandaId: TANDA.cuadre_t1,
      estado: 'PENDIENTE',
      concepto: 'INVERSION_ADMIN',
      montoEsperado: inv60.inversionAdmin, // 72,000
      montoRecibido: 0,
      montoFaltante: inv60.inversionAdmin,
      montoCubiertoPorMayor: 0,
      fechaPendiente: daysAgo(5),
    },
  });

  // 4. Cuadre INACTIVO - T2 de V.cuadre_pendiente (esperando)
  await prisma.cuadre.create({
    data: {
      tandaId: TANDA.cuadre_t2,
      estado: 'INACTIVO',
      concepto: 'GANANCIAS',
      montoEsperado: 0,
      montoRecibido: 0,
      montoFaltante: 0,
      montoCubiertoPorMayor: 0,
    },
  });

  // 5. Cuadre INACTIVO - T3 de V.cuadre_pendiente
  await prisma.cuadre.create({
    data: {
      tandaId: TANDA.cuadre_t3,
      estado: 'INACTIVO',
      concepto: 'GANANCIAS',
      montoEsperado: 0,
      montoRecibido: 0,
      montoFaltante: 0,
      montoCubiertoPorMayor: 0,
    },
  });

  // 6. Cuadre EXITOSO - T1 de V.cuadre_exitoso (ya se pagó la inversión admin)
  const inv40 = calcularInversiones(40);
  await prisma.cuadre.create({
    data: {
      tandaId: TANDA.exit_t1,
      estado: 'EXITOSO',
      concepto: 'INVERSION_ADMIN',
      montoEsperado: inv40.inversionAdmin, // 48,000
      montoRecibido: inv40.inversionAdmin,
      montoFaltante: 0,
      montoCubiertoPorMayor: 0,
      fechaPendiente: daysAgo(50),
      fechaExitoso: daysAgo(45),
    },
  });

  // 7. Cuadre PENDIENTE - T2 de V.cuadre_exitoso (ganancias, esperando transferencia)
  //    Recaudado 160000 - inversión total 96000 = ganancia 64000
  //    Ganancia admin (60/40) = 64000 * 0.4 = 25,600
  await prisma.cuadre.create({
    data: {
      tandaId: TANDA.exit_t2,
      estado: 'PENDIENTE',
      concepto: 'GANANCIAS',
      montoEsperado: 25600,
      montoRecibido: 0,
      montoFaltante: 25600,
      montoCubiertoPorMayor: 0,
      fechaPendiente: daysAgo(10),
    },
  });

  // 8. Cuadres EXITOSO para lote FINALIZADO - T1 y T2
  const invFin = calcularInversiones(40);
  await prisma.cuadre.create({
    data: {
      tandaId: TANDA.final_t1,
      estado: 'EXITOSO',
      concepto: 'INVERSION_ADMIN',
      montoEsperado: invFin.inversionAdmin,
      montoRecibido: invFin.inversionAdmin,
      montoFaltante: 0,
      montoCubiertoPorMayor: 0,
      fechaPendiente: daysAgo(100),
      fechaExitoso: daysAgo(95),
    },
  });

  await prisma.cuadre.create({
    data: {
      tandaId: TANDA.final_t2,
      estado: 'EXITOSO',
      concepto: 'GANANCIAS',
      montoEsperado: 20000,
      montoRecibido: 20000,
      montoFaltante: 0,
      montoCubiertoPorMayor: 0,
      fechaPendiente: daysAgo(40),
      fechaExitoso: daysAgo(35),
    },
  });

  // 9. Cuadres para mini-cuadre lote - T1 EXITOSO, T2 EXITOSO
  const invMini = calcularInversiones(30);
  await prisma.cuadre.create({
    data: {
      tandaId: TANDA.mini_t1,
      estado: 'EXITOSO',
      concepto: 'INVERSION_ADMIN',
      montoEsperado: invMini.inversionAdmin,
      montoRecibido: invMini.inversionAdmin,
      montoFaltante: 0,
      montoCubiertoPorMayor: 0,
      fechaPendiente: daysAgo(20),
      fechaExitoso: daysAgo(18),
    },
  });

  await prisma.cuadre.create({
    data: {
      tandaId: TANDA.mini_t2,
      estado: 'EXITOSO',
      concepto: 'GANANCIAS',
      montoEsperado: 15000,
      montoRecibido: 15000,
      montoFaltante: 0,
      montoCubiertoPorMayor: 0,
      fechaPendiente: daysAgo(5),
      fechaExitoso: daysAgo(3),
    },
  });

  // 10. Cuadres para multi_lotes lote1 - T1 INACTIVO
  await prisma.cuadre.create({
    data: {
      tandaId: TANDA.multi1_t1,
      estado: 'INACTIVO',
      concepto: 'INVERSION_ADMIN',
      montoEsperado: calcularInversiones(50).inversionAdmin,
      montoRecibido: 0,
      montoFaltante: calcularInversiones(50).inversionAdmin,
      montoCubiertoPorMayor: 0,
    },
  });

  // 11. Cuadre INACTIVO para V50.con_lote (modelo 50/50)
  await prisma.cuadre.create({
    data: {
      tandaId: TANDA.v50_t1,
      estado: 'INACTIVO',
      concepto: 'MIXTO', // modelo 50/50 usa MIXTO
      montoEsperado: calcularInversiones(40).inversionAdmin,
      montoRecibido: 0,
      montoFaltante: calcularInversiones(40).inversionAdmin,
      montoCubiertoPorMayor: 0,
    },
  });

  console.log('    ✓ 13 cuadres normales creados');
  console.log('      INACTIVO×5, PENDIENTE×2, EXITOSO×6');

  // ========================================
  // MINI-CUADRES
  // ========================================

  // 1. Mini-cuadre PENDIENTE - V.mini_cuadre_pend (stock última tanda = 0)
  await prisma.miniCuadre.create({
    data: {
      loteId: LOTE.v_mini_cuadre,
      tandaId: TANDA.mini_t2,
      estado: 'PENDIENTE',
      montoFinal: 200000 - 36000, // recaudado - transferido = consolidación
      fechaPendiente: daysAgo(2),
    },
  });

  // 2. Mini-cuadre EXITOSO - Lote finalizado (ya se cerró todoo)
  await prisma.miniCuadre.create({
    data: {
      loteId: LOTE.v_finalizado,
      tandaId: TANDA.final_t2,
      estado: 'EXITOSO',
      montoFinal: 300000 - (invFin.inversionAdmin + 20000),
      fechaPendiente: daysAgo(32),
      fechaExitoso: daysAgo(30),
    },
  });

  // 3. Mini-cuadre INACTIVO - V.activo_ok (stock > 0, no activado aún)
  await prisma.miniCuadre.create({
    data: {
      loteId: LOTE.v_activo_lote1,
      tandaId: TANDA.activo_t2,
      estado: 'INACTIVO',
      montoFinal: 0,
    },
  });

  console.log('    ✓ 3 mini-cuadres creados (INACTIVO×1, PENDIENTE×1, EXITOSO×1)');
}
