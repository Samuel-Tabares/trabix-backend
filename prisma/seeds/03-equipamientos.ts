import { PrismaClient } from '@prisma/client';
import { V, V50, BIZ, daysAgo } from './helpers';

/**
 * Seed 03: Equipamientos
 * Cubre todos los estados: SOLICITADO, ACTIVO, DEVUELTO, DANADO, PERDIDO
 * Incluye escenarios de depósito, mensualidad al día, en mora, deudas
 */
export async function seedEquipamientos(prisma: PrismaClient) {
  console.log('  → Creando equipamientos...');

  const equipamientos = [
    // SOLICITADO - esperando entrega
    {
      vendedorId: V.eq_solicitado,
      estado: 'SOLICITADO' as const,
      tieneDeposito: false,
      depositoPagado: null,
      mensualidadActual: BIZ.mensualidadSinDeposito,
      ultimaMensualidadPagada: null,
      deudaDano: 0,
      deudaPerdida: 0,
      fechaSolicitud: daysAgo(3),
      fechaEntrega: null,
      fechaDevolucion: null,
      depositoDevuelto: false,
      fechaDevolucionDeposito: null,
    },
    // ACTIVO con depósito - mensualidad al día
    {
      vendedorId: V.eq_activo_deposito,
      estado: 'ACTIVO' as const,
      tieneDeposito: true,
      depositoPagado: BIZ.depositoEquipamiento,
      mensualidadActual: BIZ.mensualidadConDeposito,
      ultimaMensualidadPagada: daysAgo(10), // pagó hace 10 días → al día
      deudaDano: 0,
      deudaPerdida: 0,
      fechaSolicitud: daysAgo(50),
      fechaEntrega: daysAgo(45),
      fechaDevolucion: null,
      depositoDevuelto: false,
      fechaDevolucionDeposito: null,
    },
    // ACTIVO sin depósito - mensualidad al día
    {
      vendedorId: V.eq_activo_sin_dep,
      estado: 'ACTIVO' as const,
      tieneDeposito: false,
      depositoPagado: null,
      mensualidadActual: BIZ.mensualidadSinDeposito,
      ultimaMensualidadPagada: daysAgo(15), // pagó hace 15 días → al día
      deudaDano: 0,
      deudaPerdida: 0,
      fechaSolicitud: daysAgo(40),
      fechaEntrega: daysAgo(35),
      fechaDevolucion: null,
      depositoDevuelto: false,
      fechaDevolucionDeposito: null,
    },
    // DEVUELTO - depósito devuelto
    {
      vendedorId: V.eq_devuelto,
      estado: 'DEVUELTO' as const,
      tieneDeposito: true,
      depositoPagado: BIZ.depositoEquipamiento,
      mensualidadActual: BIZ.mensualidadConDeposito,
      ultimaMensualidadPagada: daysAgo(35),
      deudaDano: 0,
      deudaPerdida: 0,
      fechaSolicitud: daysAgo(140),
      fechaEntrega: daysAgo(135),
      fechaDevolucion: daysAgo(10),
      depositoDevuelto: true,
      fechaDevolucionDeposito: daysAgo(8),
    },
    // DANADO - tiene deuda por daño de nevera
    {
      vendedorId: V.eq_danado,
      estado: 'DANADO' as const,
      tieneDeposito: true,
      depositoPagado: BIZ.depositoEquipamiento,
      mensualidadActual: BIZ.mensualidadConDeposito,
      ultimaMensualidadPagada: daysAgo(20),
      deudaDano: BIZ.costoDanoNevera, // 30,000
      deudaPerdida: 0,
      fechaSolicitud: daysAgo(70),
      fechaEntrega: daysAgo(65),
      fechaDevolucion: null,
      depositoDevuelto: false,
      fechaDevolucionDeposito: null,
    },
    // PERDIDO - deuda completa (nevera + pijama)
    {
      vendedorId: V.eq_perdido,
      estado: 'PERDIDO' as const,
      tieneDeposito: false,
      depositoPagado: null,
      mensualidadActual: BIZ.mensualidadSinDeposito,
      ultimaMensualidadPagada: daysAgo(40),
      deudaDano: 0,
      deudaPerdida: BIZ.costoDanoNevera + BIZ.costoDanoPijama, // 90,000
      fechaSolicitud: daysAgo(60),
      fechaEntrega: daysAgo(55),
      fechaDevolucion: null,
      depositoDevuelto: false,
      fechaDevolucionDeposito: null,
    },
    // ACTIVO con mensualidad en mora (más de 30 días sin pagar)
    {
      vendedorId: V.eq_mensualidad_mora,
      estado: 'ACTIVO' as const,
      tieneDeposito: true,
      depositoPagado: BIZ.depositoEquipamiento,
      mensualidadActual: BIZ.mensualidadConDeposito,
      ultimaMensualidadPagada: daysAgo(65), // 65 días → 2 mensualidades de mora
      deudaDano: 0,
      deudaPerdida: 0,
      fechaSolicitud: daysAgo(85),
      fechaEntrega: daysAgo(80),
      fechaDevolucion: null,
      depositoDevuelto: false,
      fechaDevolucionDeposito: null,
    },
    // Vendedor 50/50 con equipamiento activo
    {
      vendedorId: V50.con_equip,
      estado: 'ACTIVO' as const,
      tieneDeposito: true,
      depositoPagado: BIZ.depositoEquipamiento,
      mensualidadActual: BIZ.mensualidadConDeposito,
      ultimaMensualidadPagada: daysAgo(5),
      deudaDano: 0,
      deudaPerdida: 0,
      fechaSolicitud: daysAgo(45),
      fechaEntrega: daysAgo(40),
      fechaDevolucion: null,
      depositoDevuelto: false,
      fechaDevolucionDeposito: null,
    },
  ];

  for (const eq of equipamientos) {
    await prisma.equipamiento.create({
      data: {
        vendedorId: eq.vendedorId,
        estado: eq.estado,
        tieneDeposito: eq.tieneDeposito,
        depositoPagado: eq.depositoPagado,
        mensualidadActual: eq.mensualidadActual,
        ultimaMensualidadPagada: eq.ultimaMensualidadPagada,
        deudaDano: eq.deudaDano,
        deudaPerdida: eq.deudaPerdida,
        fechaSolicitud: eq.fechaSolicitud,
        fechaEntrega: eq.fechaEntrega,
        fechaDevolucion: eq.fechaDevolucion,
        depositoDevuelto: eq.depositoDevuelto,
        fechaDevolucionDeposito: eq.fechaDevolucionDeposito,
      },
    });
  }

  console.log(`    ✓ ${equipamientos.length} equipamientos creados (SOLICITADO, ACTIVO×4, DEVUELTO, DANADO, PERDIDO)`);
}
