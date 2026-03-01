import { PrismaClient } from '@prisma/client';
import { seedConfiguraciones } from './seeds/01-configuraciones';
import { seedUsuarios } from './seeds/02-usuarios';
import { seedEquipamientos } from './seeds/03-equipamientos';
import { seedLotesTandas } from './seeds/04-lotes-tandas';
import { seedCuadresMiniCuadres } from './seeds/05-cuadres-mini-cuadres';
import { seedVentasMayorCuadresMayor } from './seeds/06-ventas-mayor-cuadres-mayor';
import { seedNotificaciones } from './seeds/08-notificaciones';

const prisma = new PrismaClient();

/**
 * TRABIX Seed Principal
 * Orquesta la ejecución de todos los módulos de seed en orden.
 *
 * Orden de ejecución (respeta foreign keys):
 * 1. Configuraciones del sistema, tipos de insumo, stock admin
 * 2. Usuarios (admin, vendedores, reclutadores)
 * 3. Equipamientos (depende de usuarios)
 * 4. Lotes y tandas (depende de usuarios)
 * 5. Ventas al detal (depende de usuarios, lotes, tandas)
 * 6. Cuadres y mini-cuadres (depende de tandas, lotes)
 * 7. Ventas al mayor y cuadres mayor (depende de usuarios, lotes, tandas)
 * 8. Notificaciones (depende de usuarios)
 * 9. Fondo de recompensas, movimientos y audit logs
 *
 * Uso:
 *   npx prisma db seed
 *   npx ts-node prisma/seed.ts
 */
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      🌱 TRABIX - Seed de Datos          ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log();

  const startTime = Date.now();

  try {
    // Limpiar todas las tablas en orden inverso de dependencias
    console.log('🗑️  Limpiando base de datos...');
    await cleanDatabase(prisma);
    console.log('   ✓ Base de datos limpia\n');

    // Ejecutar seeds en orden
    console.log('📦 [1/9] Configuraciones del sistema');
    await seedConfiguraciones(prisma);
    console.log();

    console.log('👥 [2/9] Usuarios (50 + admin)');
    await seedUsuarios(prisma);
    console.log();

    console.log('🧊 [3/9] Equipamientos');
    await seedEquipamientos(prisma);
    console.log();

    console.log('📦 [4/9] Lotes y tandas');
    await seedLotesTandas(prisma);
    console.log();

    console.log('📋 [5/9] Cuadres y mini-cuadres');
    await seedCuadresMiniCuadres(prisma);
    console.log();

    console.log('💰 [6/9] Ventas al mayor y cuadres al mayor (4 escenarios: A/B/C/D)');
    await seedVentasMayorCuadresMayor(prisma);
    console.log();

    console.log('🔔 [8/9] Notificaciones');
    await seedNotificaciones(prisma);
    console.log();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('╔══════════════════════════════════════════╗');
    console.log('║      ✅ Seed completado exitosamente     ║');
    console.log(`║      ⏱️  Tiempo: ${elapsed}s${' '.repeat(23 - elapsed.length)}║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log();

    // Resumen final
    await printResumen(prisma);

  } catch (error) {
    console.error('\n❌ Error durante el seed:');
    console.error(error);
    throw error;
  }
}

/**
 * Limpia todas las tablas en orden inverso de dependencias
 */
async function cleanDatabase(prisma: PrismaClient) {
  // Orden inverso de dependencias (hijos antes que padres)
  await prisma.gananciaReclutador.deleteMany();
  await prisma.cuadreMayor.deleteMany();
  await prisma.fuenteStockMayor.deleteMany();
  await prisma.loteVentaMayor.deleteMany();
  // Note: VentaMayor must be deleted AFTER FuenteStockMayor/LoteVentaMayor/CuadreMayor
  await prisma.ventaMayor.deleteMany();
  await prisma.miniCuadre.deleteMany();
  await prisma.cuadre.deleteMany();
  await prisma.detalleVenta.deleteMany();
  await prisma.venta.deleteMany();
  await prisma.tanda.deleteMany();
  await prisma.lote.deleteMany();
  await prisma.abonoEquipamiento.deleteMany();
  await prisma.equipamiento.deleteMany();
  await prisma.notificacion.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.movimientoFondo.deleteMany();
  await prisma.transaccionFondo.deleteMany();
  await prisma.historialConfiguracion.deleteMany();
  await prisma.detalleCostoPedido.deleteMany();
  await prisma.pedidoStock.deleteMany();
  await prisma.stockAdmin.deleteMany();
  await prisma.tipoInsumo.deleteMany();
  await prisma.configuracionSistema.deleteMany();
  await prisma.tokenBlacklist.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.eventStore.deleteMany();
  await prisma.outbox.deleteMany();
  await prisma.usuario.deleteMany();
}

/**
 * Imprime un resumen de los registros creados
 */
async function printResumen(prisma: PrismaClient) {
  console.log('📋 RESUMEN DE DATOS CREADOS:');
  console.log('─'.repeat(45));

  const counts = await Promise.all([
    prisma.usuario.count(),
    prisma.lote.count(),
    prisma.tanda.count(),
    prisma.venta.count(),
    prisma.detalleVenta.count(),
    prisma.cuadre.count(),
    prisma.miniCuadre.count(),
    prisma.ventaMayor.count(),
    prisma.cuadreMayor.count(),
    prisma.gananciaReclutador.count(),
    prisma.equipamiento.count(),
    prisma.notificacion.count(),
    prisma.transaccionFondo.count(),
    prisma.movimientoFondo.count(),
    prisma.auditLog.count(),
    prisma.configuracionSistema.count(),
    prisma.tipoInsumo.count(),
    prisma.stockAdmin.count(),
    prisma.pedidoStock.count(),
  ]);

  const labels = [
    'Usuarios', 'Lotes', 'Tandas', 'Ventas', 'Detalles venta',
    'Cuadres', 'Mini-cuadres', 'Ventas mayor', 'Cuadres mayor',
    'Ganancias reclutador', 'Equipamientos', 'Notificaciones',
    'Transacciones fondo', 'Movimientos fondo', 'Audit logs',
    'Configuraciones', 'Tipos insumo', 'Stock admin', 'Pedidos stock',
  ];

  let total = 0;
  labels.forEach((label, i) => {
    const count = counts[i];
    total += count;
    console.log(`  ${label.padEnd(25)} ${String(count).padStart(5)}`);
  });

  console.log('─'.repeat(45));
  console.log(`  ${'TOTAL'.padEnd(25)} ${String(total).padStart(5)}`);
  console.log();

  // Resumen de escenarios cubiertos
  console.log('📊 ESCENARIOS CUBIERTOS:');
  console.log('─'.repeat(45));
  console.log('  Usuarios:');
  console.log('    • Admin (1)');
  console.log('    • Vendedores 60/40 activos');
  console.log('    • Vendedores con pwd temporal');
  console.log('    • Vendedores inactivos');
  console.log('    • Vendedores eliminados (soft delete)');
  console.log('    • Vendedores bloqueados (L1, L2, permanente)');
  console.log('    • Reclutadores activos/inactivos/eliminados');
  console.log('    • Vendedores 50/50 con cascada multinivel');
  console.log('  Lotes:');
  console.log('    • CREADO, ACTIVO, FINALIZADO, FORZADO');
  console.log('    • 2 tandas (≤50) y 3 tandas (>50)');
  console.log('  Tandas:');
  console.log('    • INACTIVA, LIBERADA, EN_TRANSITO, EN_CASA, FINALIZADA');
  console.log('  Ventas:');
  console.log('    • PENDIENTE, APROBADA, RECHAZADA');
  console.log('    • Tipos: PROMO, UNIDAD, SIN_LICOR, REGALO');
  console.log('  Cuadres:');
  console.log('    • INACTIVO, PENDIENTE, EXITOSO');
  console.log('    • Conceptos: INVERSION_ADMIN, GANANCIAS, MIXTO');
  console.log('  Mini-cuadres:');
  console.log('    • INACTIVO, PENDIENTE, EXITOSO');
  console.log('  Ventas mayor:');
  console.log('    • PENDIENTE, COMPLETADA');
  console.log('    • ANTICIPADO, CONTRAENTREGA');
  console.log('  Equipamientos:');
  console.log('    • SOLICITADO, ACTIVO (con/sin depósito), DEVUELTO, DANADO, PERDIDO');
  console.log('    • Con mensualidad al día y en mora');
  console.log('  Pedidos stock:');
  console.log('    • BORRADOR, CONFIRMADO, RECIBIDO, CANCELADO');
  console.log('  Notificaciones:');
  console.log('    • Todos los TipoNotificacion');
  console.log('    • Canales: WEBSOCKET, PUSH, WHATSAPP');
  console.log();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });