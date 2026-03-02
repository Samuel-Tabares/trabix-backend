import { PrismaClient } from '@prisma/client';

/**
 * Seed 01: Configuraciones del sistema, tipos de insumo y stock admin
 * Crea la base operativa que todoo lo demás necesita para funcionar.
 */
export async function seedConfiguraciones(prisma: PrismaClient) {
  console.log('  → Creando configuraciones del sistema...');

  // ========================================
  // CONFIGURACIONES DEL SISTEMA
  // ========================================
  const configuraciones = [
    // --- PRECIOS ---
    { clave: 'COSTO_PERCIBIDO_TRABIX', valor: '2400', tipo: 'DECIMAL', descripcion: 'Costo base percibido por vendedores/reclutadores por cada TRABIX', categoria: 'PRECIOS' },
    { clave: 'APORTE_FONDO_POR_TRABIX', valor: '200', tipo: 'DECIMAL', descripcion: 'Aporte inmediato al fondo por cada TRABIX de lotes ACTIVADOS', categoria: 'PRECIOS' },
    { clave: 'PRECIO_UNIDAD_LICOR', valor: '8000', tipo: 'DECIMAL', descripcion: 'Precio unitario con licor', categoria: 'PRECIOS' },
    { clave: 'PRECIO_PROMO_LICOR', valor: '12000', tipo: 'DECIMAL', descripcion: 'Precio promoción (2 TRABIX) con licor', categoria: 'PRECIOS' },
    { clave: 'PRECIO_UNIDAD_SIN_LICOR', valor: '7000', tipo: 'DECIMAL', descripcion: 'Precio unitario sin licor', categoria: 'PRECIOS' },
    { clave: 'PRECIO_MAYOR_20_LICOR', valor: '4900', tipo: 'DECIMAL', descripcion: 'Precio por unidad (>=20) con licor', categoria: 'PRECIOS' },
    { clave: 'PRECIO_MAYOR_50_LICOR', valor: '4700', tipo: 'DECIMAL', descripcion: 'Precio por unidad (>=50) con licor', categoria: 'PRECIOS' },
    { clave: 'PRECIO_MAYOR_100_LICOR', valor: '4500', tipo: 'DECIMAL', descripcion: 'Precio por unidad (>=100) con licor', categoria: 'PRECIOS' },
    { clave: 'PRECIO_MAYOR_20_SIN_LICOR', valor: '4800', tipo: 'DECIMAL', descripcion: 'Precio por unidad (>=20) sin licor', categoria: 'PRECIOS' },
    { clave: 'PRECIO_MAYOR_50_SIN_LICOR', valor: '4500', tipo: 'DECIMAL', descripcion: 'Precio por unidad (>=50) sin licor', categoria: 'PRECIOS' },
    { clave: 'PRECIO_MAYOR_100_SIN_LICOR', valor: '4200', tipo: 'DECIMAL', descripcion: 'Precio por unidad (>=100) sin licor', categoria: 'PRECIOS' },

    // --- PORCENTAJES ---
    { clave: 'PORCENTAJE_GANANCIA_VENDEDOR_60_40', valor: '60', tipo: 'PERCENT', descripcion: 'Ganancia del vendedor en modelo 60/40', categoria: 'PORCENTAJES' },
    { clave: 'PORCENTAJE_GANANCIA_ADMIN_60_40', valor: '40', tipo: 'PERCENT', descripcion: 'Ganancia del admin en modelo 60/40', categoria: 'PORCENTAJES' },
    { clave: 'PORCENTAJE_GANANCIA_VENDEDOR_50_50', valor: '50', tipo: 'PERCENT', descripcion: 'Ganancia del vendedor en modelo 50/50', categoria: 'PORCENTAJES' },
    { clave: 'PORCENTAJE_INVERSION_VENDEDOR', valor: '50', tipo: 'PERCENT', descripcion: 'Porcentaje de inversión del vendedor', categoria: 'PORCENTAJES' },
    { clave: 'LIMITE_REGALOS', valor: '8', tipo: 'PERCENT', descripcion: 'Máximo de regalos permitidos por lote', categoria: 'PORCENTAJES' },
    { clave: 'TRIGGER_CUADRE_T2', valor: '10', tipo: 'PERCENT', descripcion: 'Trigger de stock para cuadre T2 (3 tandas)', categoria: 'PORCENTAJES' },
    { clave: 'TRIGGER_CUADRE_T3', valor: '20', tipo: 'PERCENT', descripcion: 'Trigger de stock para cuadre T3 (3 tandas)', categoria: 'PORCENTAJES' },
    { clave: 'TRIGGER_CUADRE_T1_2TANDAS', valor: '10', tipo: 'PERCENT', descripcion: 'Trigger de stock para cuadre T1 (2 tandas)', categoria: 'PORCENTAJES' },
    { clave: 'TRIGGER_CUADRE_T2_2TANDAS', valor: '20', tipo: 'PERCENT', descripcion: 'Trigger de stock para cuadre T2 (2 tandas)', categoria: 'PORCENTAJES' },

    // --- LOTES ---
    { clave: 'MAX_LOTES_CREADOS_POR_VENDEDOR', valor: '2', tipo: 'INT', descripcion: 'Máximo de lotes en estado CREADO por vendedor', categoria: 'LOTES' },
    { clave: 'INVERSION_MINIMA_VENDEDOR', valor: '20000', tipo: 'DECIMAL', descripcion: 'Inversión mínima del vendedor en COP', categoria: 'LOTES' },
    { clave: 'UMBRAL_TANDAS_TRES', valor: '50', tipo: 'INT', descripcion: 'Umbral de TRABIX: >50 = 3 tandas, <=50 = 2 tandas', categoria: 'LOTES' },

    // --- TIEMPOS ---
    { clave: 'TIEMPO_AUTO_TRANSITO_HORAS', valor: '2', tipo: 'INT', descripcion: 'Horas para pasar automáticamente de LIBERADA a EN_TRANSITO', categoria: 'TIEMPOS' },
  ];

  for (const conf of configuraciones) {
    await prisma.configuracionSistema.upsert({
      where: { clave: conf.clave },
      update: { valor: conf.valor },
      create: {
        clave: conf.clave,
        valor: conf.valor,
        tipo: conf.tipo,
        descripcion: conf.descripcion,
        categoria: conf.categoria,
        modificable: true,
        modificadoPorId: null,
      },
    });
  }

  console.log(`    ✓ ${configuraciones.length} configuraciones creadas`);

  // ========================================
  // TIPOS DE INSUMO (obligatorios y opcionales)
  // ========================================
  console.log('  → Creando tipos de insumo...');

  const tiposInsumo = [
    { nombre: 'Trabix (unidad de producto)', esObligatorio: true },
    { nombre: 'Botella de licor', esObligatorio: true },
    { nombre: 'Empaque individual', esObligatorio: true },
    { nombre: 'Caja de envío (x12)', esObligatorio: false },
    { nombre: 'Etiqueta personalizada', esObligatorio: false },
    { nombre: 'Material publicitario', esObligatorio: false },
    { nombre: 'Bolsa de regalo', esObligatorio: false },
    { nombre: 'Hielo seco (envío)', esObligatorio: false },
  ];

  for (const tipo of tiposInsumo) {
    await prisma.tipoInsumo.upsert({
      where: { nombre: tipo.nombre },
      update: {},
      create: {
        nombre: tipo.nombre,
        esObligatorio: tipo.esObligatorio,
        activo: true,
      },
    });
  }

  console.log(`    ✓ ${tiposInsumo.length} tipos de insumo creados`);

  // ========================================
  // STOCK ADMIN
  // ========================================
  console.log('  → Creando stock admin...');

  const stockExistente = await prisma.stockAdmin.findFirst();
  if (!stockExistente) {
    await prisma.stockAdmin.create({
      data: {
        stockFisico: 500, // Stock inicial disponible
        ultimoPedidoId: null,
      },
    });
  }

  console.log('    ✓ Stock admin inicializado (500 unidades)');

  // ========================================
  // PEDIDOS DE STOCK (escenarios)
  // ========================================
  console.log('  → Creando pedidos de stock...');

  // Pedido RECIBIDO (el que llenó el stock)
  const pedidoRecibido = await prisma.pedidoStock.create({
    data: {
      cantidadTrabix: 500,
      estado: 'RECIBIDO',
      costoTotal: 600000,
      costoRealPorTrabix: 1200,
      fechaCreacion: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      fechaRecepcion: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
      notas: 'Primer pedido de stock - recibido correctamente',
      detallesCosto: {
        create: [
          { concepto: 'Trabix (unidad de producto)', esObligatorio: true, cantidad: 500, costoTotal: 500000 },
          { concepto: 'Botella de licor', esObligatorio: true, cantidad: 500, costoTotal: 75000 },
          { concepto: 'Empaque individual', esObligatorio: true, cantidad: 500, costoTotal: 25000 },
        ],
      },
    },
  });

  // Actualizar stock admin con referencia al pedido
  await prisma.stockAdmin.updateMany({
    data: { ultimoPedidoId: pedidoRecibido.id },
  });

  // Pedido en BORRADOR
  await prisma.pedidoStock.create({
    data: {
      cantidadTrabix: 200,
      estado: 'BORRADOR',
      costoTotal: 0,
      costoRealPorTrabix: 0,
      notas: 'Pedido en preparación',
    },
  });

  console.log('    ✓ 2 pedidos de stock creados (BORRADOR, RECIBIDO)');
}
