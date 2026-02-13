import { PrismaClient } from '@prisma/client';
import {
  ADMIN_ID, V, V50, R, LOTE, daysAgo, hoursAgo,
} from './helpers';

/**
 * Seed 08: Notificaciones
 * Cubre TODOS los TipoNotificacion y CanalNotificacion
 * Con estados leída/no leída
 */
export async function seedNotificaciones(prisma: PrismaClient) {
  console.log('  → Creando notificaciones...');

  const notificaciones = [
    // --- Notificaciones para ADMIN ---
    {
      usuarioId: ADMIN_ID,
      tipo: 'LOTE_ACTIVADO' as const,
      titulo: 'Lote activado',
      mensaje: 'El lote de María López (30 TRABIX) ha sido activado exitosamente.',
      datos: { loteId: LOTE.v_activo_lote1, vendedorNombre: 'María López García' },
      canal: 'WEBSOCKET' as const,
      leida: true,
      fechaCreacion: daysAgo(50),
      fechaLeida: daysAgo(50),
    },
    {
      usuarioId: ADMIN_ID,
      tipo: 'CUADRE_PENDIENTE' as const,
      titulo: 'Cuadre pendiente de confirmación',
      mensaje: 'Emilio Castaño tiene un cuadre pendiente por $72,000.',
      datos: { vendedorId: V.cuadre_pendiente, monto: 72000 },
      canal: 'WEBSOCKET' as const,
      leida: false,
      fechaCreacion: daysAgo(5),
      fechaLeida: null,
    },
    {
      usuarioId: ADMIN_ID,
      tipo: 'EQUIPAMIENTO_SOLICITADO' as const,
      titulo: 'Solicitud de equipamiento',
      mensaje: 'Santiago Restrepo ha solicitado equipamiento.',
      datos: { vendedorId: V.eq_solicitado },
      canal: 'WEBSOCKET' as const,
      leida: false,
      fechaCreacion: daysAgo(3),
      fechaLeida: null,
    },
    {
      usuarioId: ADMIN_ID,
      tipo: 'MANUAL' as const,
      titulo: 'Recordatorio de revisión',
      mensaje: 'Recuerde revisar las ventas pendientes del día.',
      datos: undefined,
      canal: 'WEBSOCKET' as const,
      leida: true,
      fechaCreacion: daysAgo(1),
      fechaLeida: daysAgo(1),
    },

    // --- Notificaciones para VENDEDORES ---
    {
      usuarioId: V.activo_ok,
      tipo: 'LOTE_ACTIVADO' as const,
      titulo: 'Tu lote fue activado',
      mensaje: 'Tu lote de 30 TRABIX ha sido activado. ¡A vender!',
      datos: { loteId: LOTE.v_activo_lote1 },
      canal: 'WEBSOCKET' as const,
      leida: true,
      fechaCreacion: daysAgo(50),
      fechaLeida: daysAgo(49),
    },
    {
      usuarioId: V.activo_ok,
      tipo: 'TANDA_LIBERADA' as const,
      titulo: 'Tanda 1 liberada',
      mensaje: 'La tanda 1 de tu lote ha sido liberada con 15 TRABIX.',
      datos: { loteId: LOTE.v_activo_lote1, tandaNumero: 1 },
      canal: 'WEBSOCKET' as const,
      leida: true,
      fechaCreacion: daysAgo(50),
      fechaLeida: daysAgo(49),
    },
    {
      usuarioId: V.cuadre_pendiente,
      tipo: 'CUADRE_PENDIENTE' as const,
      titulo: 'Cuadre activado',
      mensaje: 'Debes transferir $72,000 al admin para completar tu cuadre.',
      datos: { monto: 72000 },
      canal: 'WEBSOCKET' as const,
      leida: false,
      fechaCreacion: daysAgo(5),
      fechaLeida: null,
    },
    {
      usuarioId: V.cuadre_exitoso,
      tipo: 'CUADRE_EXITOSO' as const,
      titulo: 'Cuadre confirmado',
      mensaje: 'Tu cuadre de la tanda 1 fue confirmado exitosamente.',
      datos: { tandaNumero: 1 },
      canal: 'WEBSOCKET' as const,
      leida: true,
      fechaCreacion: daysAgo(45),
      fechaLeida: daysAgo(44),
    },
    {
      usuarioId: V.cuadre_exitoso,
      tipo: 'INVERSION_RECUPERADA' as const,
      titulo: 'Inversión recuperada',
      mensaje: 'La inversión del admin ha sido recuperada en tu lote.',
      datos: { loteId: LOTE.v_cuadre_exit },
      canal: 'WEBSOCKET' as const,
      leida: true,
      fechaCreacion: daysAgo(45),
      fechaLeida: daysAgo(44),
    },
    {
      usuarioId: V.mini_cuadre_pend,
      tipo: 'STOCK_BAJO' as const,
      titulo: 'Stock agotado',
      mensaje: 'Tu última tanda se ha agotado. Se ha activado el mini-cuadre.',
      datos: { loteId: LOTE.v_mini_cuadre },
      canal: 'WEBSOCKET' as const,
      leida: false,
      fechaCreacion: daysAgo(2),
      fechaLeida: null,
    },
    {
      usuarioId: V.con_lote_finalizado,
      tipo: 'LOTE_FINALIZADO' as const,
      titulo: 'Lote finalizado',
      mensaje: '¡Felicidades! Tu lote de 40 TRABIX ha sido finalizado exitosamente.',
      datos: { loteId: LOTE.v_finalizado },
      canal: 'WEBSOCKET' as const,
      leida: true,
      fechaCreacion: daysAgo(30),
      fechaLeida: daysAgo(29),
    },
    {
      usuarioId: V.eq_activo_deposito,
      tipo: 'EQUIPAMIENTO_ENTREGADO' as const,
      titulo: 'Equipamiento entregado',
      mensaje: 'Tu equipamiento ha sido entregado. Recuerda cuidarlo bien.',
      datos: undefined,
      canal: 'WEBSOCKET' as const,
      leida: true,
      fechaCreacion: daysAgo(45),
      fechaLeida: daysAgo(44),
    },
    // Notificación vía PUSH
    {
      usuarioId: V.multi_lotes,
      tipo: 'MANUAL' as const,
      titulo: 'Promoción especial',
      mensaje: 'Tienes una promoción especial disponible esta semana.',
      datos: undefined,
      canal: 'PUSH' as const,
      leida: false,
      fechaCreacion: hoursAgo(5),
      fechaLeida: null,
    },
    // Notificación FONDO
    {
      usuarioId: V.activo_ok,
      tipo: 'PREMIO_RECIBIDO' as const,
      titulo: 'Premio del fondo de recompensas',
      mensaje: 'Has recibido un premio de $50,000 del fondo de recompensas.',
      datos: { monto: 50000 },
      canal: 'WEBSOCKET' as const,
      leida: true,
      fechaCreacion: daysAgo(10),
      fechaLeida: daysAgo(10),
    },
    // Notificación para reclutador
    {
      usuarioId: R.activo_con_recl,
      tipo: 'MANUAL' as const,
      titulo: 'Tu reclutado vendió',
      mensaje: 'Tu reclutado Esteban Ceballos realizó una venta exitosa.',
      datos: { reclutadoId: V50.activo_1 },
      canal: 'WEBSOCKET' as const,
      leida: false,
      fechaCreacion: daysAgo(1),
      fechaLeida: null,
    },
    // FONDO_EGRESO
    {
      usuarioId: ADMIN_ID,
      tipo: 'FONDO_EGRESO' as const,
      titulo: 'Egreso del fondo',
      mensaje: 'Se registró un egreso de $50,000 del fondo de recompensas.',
      datos: { monto: 50000 },
      canal: 'WEBSOCKET' as const,
      leida: true,
      fechaCreacion: daysAgo(10),
      fechaLeida: daysAgo(10),
    },
    // Notificación WHATSAPP
    {
      usuarioId: V50.con_lote,
      tipo: 'TANDA_LIBERADA' as const,
      titulo: 'Tanda liberada',
      mensaje: 'La tanda 1 de tu lote ha sido liberada.',
      datos: { tandaNumero: 1 },
      canal: 'WHATSAPP' as const,
      leida: false,
      fechaCreacion: daysAgo(60),
      fechaLeida: null,
    },
  ];

  for (const n of notificaciones) {
    await prisma.notificacion.create({
      data: {
        usuarioId: n.usuarioId,
        tipo: n.tipo,
        titulo: n.titulo,
        mensaje: n.mensaje,
        datos: n.datos,
        canal: n.canal,
        leida: n.leida,
        fechaCreacion: n.fechaCreacion,
        fechaLeida: n.fechaLeida,
      },
    });
  }

  console.log(`    ✓ ${notificaciones.length} notificaciones creadas`);
  console.log('      Tipos: STOCK_BAJO, CUADRE_PENDIENTE, INVERSION_RECUPERADA, CUADRE_EXITOSO,');
  console.log('             TANDA_LIBERADA, MANUAL, PREMIO_RECIBIDO, LOTE_ACTIVADO, LOTE_FINALIZADO,');
  console.log('             EQUIPAMIENTO_SOLICITADO, EQUIPAMIENTO_ENTREGADO, FONDO_EGRESO');
  console.log('      Canales: WEBSOCKET, PUSH, WHATSAPP');
}
