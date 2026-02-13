import { PrismaClient } from '@prisma/client';
import { ADMIN_ID, V, LOTE, BIZ, daysAgo } from './helpers';

/**
 * Seed 09: Fondo de recompensas, movimientos, transacciones y audit logs
 */
export async function seedFondoYAudit(prisma: PrismaClient) {
  console.log('  → Creando transacciones del fondo de recompensas...');

  // ========================================
  // TRANSACCIONES DEL FONDO (TransaccionFondo)
  // ========================================
  const transacciones = [
    // Entradas por lotes activados (200 COP × cantidad TRABIX)
    {
      tipo: 'ENTRADA' as const,
      monto: 30 * BIZ.aporteFondoPorTrabix, // 6,000
      motivo: 'Aporte por activación de lote (30 TRABIX) - María López',
      loteOrigenId: LOTE.v_activo_lote1,
      fechaTransaccion: daysAgo(50),
    },
    {
      tipo: 'ENTRADA' as const,
      monto: 40 * BIZ.aporteFondoPorTrabix, // 8,000
      motivo: 'Aporte por activación de lote (40 TRABIX) - Luis Moreno',
      loteOrigenId: LOTE.v_finalizado,
      fechaTransaccion: daysAgo(165),
    },
    {
      tipo: 'ENTRADA' as const,
      monto: 50 * BIZ.aporteFondoPorTrabix, // 10,000
      motivo: 'Aporte por activación de lote (50 TRABIX) - Valentina Díaz',
      loteOrigenId: LOTE.v_multi_1,
      fechaTransaccion: daysAgo(75),
    },
    {
      tipo: 'ENTRADA' as const,
      monto: 60 * BIZ.aporteFondoPorTrabix, // 12,000
      motivo: 'Aporte por activación de lote (60 TRABIX) - Emilio Castaño',
      loteOrigenId: LOTE.v_cuadre_pend,
      fechaTransaccion: daysAgo(65),
    },
    {
      tipo: 'ENTRADA' as const,
      monto: 40 * BIZ.aporteFondoPorTrabix,
      motivo: 'Aporte por activación de lote (40 TRABIX) - Catalina Agudelo',
      loteOrigenId: LOTE.v_cuadre_exit,
      fechaTransaccion: daysAgo(90),
    },
    // Salida - premio
    {
      tipo: 'SALIDA' as const,
      monto: 50000,
      motivo: 'Premio a María López por excelente desempeño',
      loteOrigenId: null,
      fechaTransaccion: daysAgo(10),
    },
  ];

  for (const t of transacciones) {
    await prisma.transaccionFondo.create({
      data: {
        tipo: t.tipo,
        monto: t.monto,
        motivo: t.motivo,
        loteOrigenId: t.loteOrigenId,
        fechaTransaccion: t.fechaTransaccion,
      },
    });
  }

  console.log(`    ✓ ${transacciones.length} transacciones del fondo (5 ENTRADA, 1 SALIDA)`);

  // ========================================
  // MOVIMIENTOS DEL FONDO (MovimientoFondo)
  // ========================================
  console.log('  → Creando movimientos del fondo...');

  const movimientos = [
    {
      tipo: 'ENTRADA',
      monto: 6000,
      concepto: 'Aporte activación lote 30 TRABIX',
      loteId: LOTE.v_activo_lote1,
      vendedorBeneficiarioId: null,
      fechaTransaccion: daysAgo(50),
    },
    {
      tipo: 'ENTRADA',
      monto: 8000,
      concepto: 'Aporte activación lote 40 TRABIX',
      loteId: LOTE.v_finalizado,
      vendedorBeneficiarioId: null,
      fechaTransaccion: daysAgo(165),
    },
    {
      tipo: 'SALIDA',
      monto: 50000,
      concepto: 'Premio por desempeño a vendedora destacada',
      loteId: null,
      vendedorBeneficiarioId: V.activo_ok,
      fechaTransaccion: daysAgo(10),
    },
  ];

  for (const m of movimientos) {
    await prisma.movimientoFondo.create({
      data: {
        tipo: m.tipo,
        monto: m.monto,
        concepto: m.concepto,
        loteId: m.loteId,
        vendedorBeneficiarioId: m.vendedorBeneficiarioId,
        fechaTransaccion: m.fechaTransaccion,
      },
    });
  }

  console.log(`    ✓ ${movimientos.length} movimientos del fondo`);

  // ========================================
  // AUDIT LOGS
  // ========================================
  console.log('  → Creando audit logs...');

  const auditLogs = [
    {
      usuarioId: ADMIN_ID,
      accion: 'CREAR_USUARIO',
      entidad: 'Usuario',
      entidadId: V.activo_ok,
      datosNuevos: { nombre: 'María', apellidos: 'López García', rol: 'VENDEDOR' },
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64)',
      fechaCreacion: daysAgo(60),
    },
    {
      usuarioId: ADMIN_ID,
      accion: 'ACTIVAR_LOTE',
      entidad: 'Lote',
      entidadId: LOTE.v_activo_lote1,
      datosAnteriores: { estado: 'CREADO' },
      datosNuevos: { estado: 'ACTIVO' },
      ip: '192.168.1.100',
      fechaCreacion: daysAgo(50),
    },
    {
      usuarioId: ADMIN_ID,
      accion: 'CONFIRMAR_CUADRE',
      entidad: 'Cuadre',
      entidadId: null,
      datosNuevos: { estado: 'EXITOSO', montoRecibido: 48000 },
      ip: '192.168.1.100',
      fechaCreacion: daysAgo(45),
    },
    {
      usuarioId: ADMIN_ID,
      accion: 'CAMBIAR_ESTADO_USUARIO',
      entidad: 'Usuario',
      entidadId: V.inactivo,
      datosAnteriores: { estado: 'ACTIVO' },
      datosNuevos: { estado: 'INACTIVO' },
      ip: '192.168.1.100',
      fechaCreacion: daysAgo(5),
    },
    {
      usuarioId: ADMIN_ID,
      accion: 'ELIMINAR_USUARIO',
      entidad: 'Usuario',
      entidadId: V.eliminado,
      datosNuevos: { eliminado: true },
      ip: '192.168.1.100',
      fechaCreacion: daysAgo(10),
    },
    {
      usuarioId: V.activo_ok,
      accion: 'REGISTRAR_VENTA',
      entidad: 'Venta',
      entidadId: null,
      datosNuevos: { cantidadTrabix: 5, montoTotal: 40000 },
      ip: '10.0.0.50',
      fechaCreacion: daysAgo(45),
    },
    {
      usuarioId: ADMIN_ID,
      accion: 'APROBAR_VENTA',
      entidad: 'Venta',
      entidadId: null,
      datosAnteriores: { estado: 'PENDIENTE' },
      datosNuevos: { estado: 'APROBADA' },
      ip: '192.168.1.100',
      fechaCreacion: daysAgo(44),
    },
    {
      usuarioId: ADMIN_ID,
      accion: 'RECHAZAR_VENTA',
      entidad: 'Venta',
      entidadId: null,
      datosAnteriores: { estado: 'PENDIENTE' },
      datosNuevos: { estado: 'RECHAZADA' },
      ip: '192.168.1.100',
      fechaCreacion: daysAgo(9),
    },
    {
      usuarioId: ADMIN_ID,
      accion: 'ENTREGAR_EQUIPAMIENTO',
      entidad: 'Equipamiento',
      entidadId: null,
      datosNuevos: { estado: 'ACTIVO', vendedorId: V.eq_activo_deposito },
      ip: '192.168.1.100',
      fechaCreacion: daysAgo(45),
    },
    {
      usuarioId: ADMIN_ID,
      accion: 'COMPLETAR_VENTA_MAYOR',
      entidad: 'VentaMayor',
      entidadId: null,
      datosNuevos: { estado: 'COMPLETADA', cantidadUnidades: 20 },
      ip: '192.168.1.100',
      fechaCreacion: daysAgo(12),
    },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({
      data: {
        usuarioId: log.usuarioId,
        accion: log.accion,
        entidad: log.entidad,
        entidadId: log.entidadId ?? null,
        datosAnteriores: (log as any).datosAnteriores ?? null,
        datosNuevos: log.datosNuevos ?? null,
        ip: log.ip ?? null,
        userAgent: (log as any).userAgent ?? null,
        fechaCreacion: log.fechaCreacion,
      },
    });
  }

  console.log(`    ✓ ${auditLogs.length} audit logs creados`);
}
