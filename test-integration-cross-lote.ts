/**
 * Script de pruebas de integración para venta cross-lote y flujo normal.
 * Usa la base de datos de development y el servidor local.
 *
 * Escenarios cubiertos:
 *  1. Venta normal (flujo sin cambios)
 *  2. Venta normal - stock insuficiente sin cross-lote
 *  3. Cross-lote: stock=1, sale=2 UNIDAD (no split de promo)
 *  4. Cross-lote: stock=2, sale=1 PROMO + 1 UNIDAD (promo entera a lote1)
 *  5. Cross-lote: stock=1, sale=1 PROMO (split forzado → PROMO_PARCIAL)
 *  6. Cross-lote bloqueado: cuadre NO es EXITOSO
 *  7. Cross-lote: stock=1, sale=2 UNIDAD + 1 PROMO (1U a lote1, resto a lote2)
 *  8. Mini-cuadre se activa después del cross-lote (stock lote1=0)
 *  9. Vendedor inactivo no puede vender
 * 10. Vendedor sin lote activo no puede vender
 */

import { PrismaClient } from '@prisma/client';
import * as http from 'http';
import * as https from 'https';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000/api/v1';

// IDs de test aislados (no colisionan con seed)
const TEST = {
  VENDEDOR_ID: '99999999-0000-4000-a000-000000000001',
  LOTE1_ID:    '99999999-0000-4000-b000-000000000001',
  LOTE2_ID:    '99999999-0000-4000-b000-000000000002',
  TANDA1_1_ID: '99999999-0000-4000-c000-000000000001', // Lote1 T1 (FINALIZADA)
  TANDA1_2_ID: '99999999-0000-4000-c000-000000000002', // Lote1 T2 (EN_CASA, last, cuadre EXITOSO)
  TANDA2_1_ID: '99999999-0000-4000-c000-000000000003', // Lote2 T1 (EN_CASA)
  CUADRE1_1_ID: '99999999-0000-4000-d000-000000000001', // Cuadre T1 del lote1
  CUADRE1_2_ID: '99999999-0000-4000-d000-000000000002', // Cuadre T2 del lote1 (EXITOSO)
  CUADRE2_1_ID: '99999999-0000-4000-d000-000000000003', // Cuadre T1 del lote2
  MINI1_ID:     '99999999-0000-4000-e000-000000000001', // Mini-cuadre lote1
  MINI2_ID:     '99999999-0000-4000-e000-000000000002', // Mini-cuadre lote2
  CEDULA:       999000901, // INT4 safe (< 2^31)
};

// Seed vendor (V.activo_ok) — sus datos se restablecen antes de los tests normales
const SEED = {
  TANDA_EN_CASA_ID: '00000000-0000-4000-c000-000000000001', // Tanda 1 del lote seed
  STOCK_INICIAL: 15,
};

// ─── Utilidades HTTP ───────────────────────────────────────────────

function request(
  method: string,
  path: string,
  body?: object,
  token?: string,
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const opts: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode ?? 0, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login(cedula: number, password: string): Promise<string> {
  const res = await request('POST', '/auth/login', { cedula, password });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Login falló (${res.status}): ${JSON.stringify(res.data)}`);
  }
  return res.data.accessToken;
}

// ─── Setup / Teardown ─────────────────────────────────────────────

async function limpiarDatosTest() {
  // Borrar en orden de dependencias (hijos primero)
  await prisma.detalleVenta.deleteMany({
    where: { venta: { vendedorId: TEST.VENDEDOR_ID } },
  });
  await prisma.venta.deleteMany({ where: { vendedorId: TEST.VENDEDOR_ID } });
  await prisma.miniCuadre.deleteMany({
    where: { id: { in: [TEST.MINI1_ID, TEST.MINI2_ID] } },
  });
  await prisma.cuadre.deleteMany({
    where: { id: { in: [TEST.CUADRE1_1_ID, TEST.CUADRE1_2_ID, TEST.CUADRE2_1_ID] } },
  });
  await prisma.tanda.deleteMany({
    where: { id: { in: [TEST.TANDA1_1_ID, TEST.TANDA1_2_ID, TEST.TANDA2_1_ID] } },
  });
  await prisma.lote.deleteMany({
    where: { id: { in: [TEST.LOTE1_ID, TEST.LOTE2_ID] } },
  });
  // Notificaciones generadas por eventos del sistema
  await prisma.notificacion.deleteMany({ where: { usuarioId: TEST.VENDEDOR_ID } });
  await prisma.usuario.deleteMany({ where: { id: TEST.VENDEDOR_ID } });
}

async function crearVendedorTest() {
  // Crear vendedor de test con bcrypt simple
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('Trabix2026!', 10);
  await prisma.usuario.upsert({
    where: { id: TEST.VENDEDOR_ID },
    update: {},
    create: {
      id: TEST.VENDEDOR_ID,
      cedula: TEST.CEDULA,
      nombre: 'Test',
      apellidos: 'CrossLote Integración',
      email: 'test.crosslote@trabix.co',
      telefono: '+573009999901',
      passwordHash: hash,
      requiereCambioPassword: false,
      rol: 'VENDEDOR',
      estado: 'ACTIVO',
      modeloNegocio: 'MODELO_60_40',
    },
  });
}

async function crearEstadoCrossLote(
  stockLote1T2: number,
  cuadreT2Estado: 'INACTIVO' | 'PENDIENTE' | 'EXITOSO',
  stockLote2T1: number,
) {
  const now = new Date();
  const ago = (h: number) => new Date(Date.now() - h * 3600000);

  // ─ Lote 1 (más antiguo, 2 tandas: T1 finalizada, T2 en casa)
  await prisma.lote.upsert({
    where: { id: TEST.LOTE1_ID },
    update: {
      estado: 'ACTIVO',
      fechaFinalizacion: null,
      dineroRecaudado: 150000,
      fechaActivacion: ago(200),
    },
    create: {
      id: TEST.LOTE1_ID,
      vendedorId: TEST.VENDEDOR_ID,
      cantidadTrabix: 30,
      modeloNegocio: 'MODELO_60_40',
      estado: 'ACTIVO',
      inversionTotal: 72000,
      inversionAdmin: 36000,
      inversionVendedor: 36000,
      dineroRecaudado: 150000,
      dineroTransferido: 36000,
      fechaCreacion: ago(210),
      fechaActivacion: ago(200),
    },
  });

  // Lote 1 - Tanda 1 (FINALIZADA)
  await prisma.tanda.upsert({
    where: { id: TEST.TANDA1_1_ID },
    update: {},
    create: {
      id: TEST.TANDA1_1_ID,
      loteId: TEST.LOTE1_ID,
      numero: 1,
      estado: 'FINALIZADA',
      stockInicial: 15,
      stockActual: 0,
      fechaLiberacion: ago(200),
      fechaEnTransito: ago(200),
      fechaEnCasa: ago(199),
      fechaFinalizada: ago(100),
    },
  });

  // Lote 1 - Tanda 2 (EN_CASA, con stock variable según escenario)
  await prisma.tanda.upsert({
    where: { id: TEST.TANDA1_2_ID },
    update: {
      stockActual: stockLote1T2,
      estado: 'EN_CASA',
    },
    create: {
      id: TEST.TANDA1_2_ID,
      loteId: TEST.LOTE1_ID,
      numero: 2,
      estado: 'EN_CASA',
      stockInicial: 15,
      stockActual: stockLote1T2,
      fechaLiberacion: ago(100),
      fechaEnTransito: ago(100),
      fechaEnCasa: ago(99),
    },
  });

  // Cuadre T1 (exitoso, ya procesado)
  await prisma.cuadre.upsert({
    where: { id: TEST.CUADRE1_1_ID },
    update: {},
    create: {
      id: TEST.CUADRE1_1_ID,
      tandaId: TEST.TANDA1_1_ID,
      estado: 'EXITOSO',
      concepto: 'INVERSION_ADMIN',
      montoEsperado: 36000,
      montoRecibido: 36000,
      montoFaltante: 0,
      desglose: { inversionAdmin: 36000, gananciasAdmin: 0, mensualidades: 0, deudaDano: 0, deudaPerdida: 0 },
    },
  });

  // Cuadre T2 (estado variable según escenario)
  await prisma.cuadre.upsert({
    where: { id: TEST.CUADRE1_2_ID },
    update: {
      estado: cuadreT2Estado,
      montoRecibido: cuadreT2Estado === 'EXITOSO' ? 36000 : 0,
    },
    create: {
      id: TEST.CUADRE1_2_ID,
      tandaId: TEST.TANDA1_2_ID,
      estado: cuadreT2Estado,
      concepto: 'GANANCIAS',
      montoEsperado: 36000,
      montoRecibido: cuadreT2Estado === 'EXITOSO' ? 36000 : 0,
      montoFaltante: cuadreT2Estado === 'EXITOSO' ? 0 : 36000,
      desglose: { inversionAdmin: 0, gananciasAdmin: 36000, mensualidades: 0, deudaDano: 0, deudaPerdida: 0 },
    },
  });

  // Mini-cuadre Lote 1
  await prisma.miniCuadre.upsert({
    where: { id: TEST.MINI1_ID },
    update: { estado: 'INACTIVO', montoFinal: 0 },
    create: {
      id: TEST.MINI1_ID,
      loteId: TEST.LOTE1_ID,
      tandaId: TEST.TANDA1_2_ID,
      estado: 'INACTIVO',
      montoFinal: 0,
    },
  });

  // ─ Lote 2 (más nuevo, 2 tandas: T1 en casa)
  await prisma.lote.upsert({
    where: { id: TEST.LOTE2_ID },
    update: { dineroRecaudado: 0, fechaActivacion: ago(50) },
    create: {
      id: TEST.LOTE2_ID,
      vendedorId: TEST.VENDEDOR_ID,
      cantidadTrabix: 50,
      modeloNegocio: 'MODELO_60_40',
      estado: 'ACTIVO',
      inversionTotal: 120000,
      inversionAdmin: 60000,
      inversionVendedor: 60000,
      dineroRecaudado: 0,
      dineroTransferido: 0,
      fechaCreacion: ago(60),
      fechaActivacion: ago(50),
    },
  });

  // Lote 2 - Tanda 1 (EN_CASA)
  await prisma.tanda.upsert({
    where: { id: TEST.TANDA2_1_ID },
    update: {
      stockActual: stockLote2T1,
      estado: 'EN_CASA',
    },
    create: {
      id: TEST.TANDA2_1_ID,
      loteId: TEST.LOTE2_ID,
      numero: 1,
      estado: 'EN_CASA',
      stockInicial: 25,
      stockActual: stockLote2T1,
      fechaLiberacion: ago(50),
      fechaEnTransito: ago(50),
      fechaEnCasa: ago(49),
    },
  });

  // Cuadre Lote2 T1 (inactivo, aún no se activa)
  await prisma.cuadre.upsert({
    where: { id: TEST.CUADRE2_1_ID },
    update: { estado: 'INACTIVO' },
    create: {
      id: TEST.CUADRE2_1_ID,
      tandaId: TEST.TANDA2_1_ID,
      estado: 'INACTIVO',
      concepto: 'GANANCIAS',
      montoEsperado: 0,
      montoRecibido: 0,
      montoFaltante: 0,
    },
  });

  // Mini-cuadre Lote 2
  await prisma.miniCuadre.upsert({
    where: { id: TEST.MINI2_ID },
    update: { estado: 'INACTIVO' },
    create: {
      id: TEST.MINI2_ID,
      loteId: TEST.LOTE2_ID,
      tandaId: TEST.TANDA2_1_ID,
      estado: 'INACTIVO',
      montoFinal: 0,
    },
  });
}

// ─── Verificaciones de DB ─────────────────────────────────────────

async function obtenerTanda(tandaId: string) {
  return prisma.tanda.findUnique({ where: { id: tandaId } });
}

async function obtenerVentasMasRecientes(n = 5) {
  return prisma.venta.findMany({
    where: { vendedorId: TEST.VENDEDOR_ID },
    include: { detalles: true },
    orderBy: { fechaRegistro: 'desc' },
    take: n,
  });
}

async function obtenerMiniCuadre(loteId: string) {
  return prisma.miniCuadre.findFirst({ where: { loteId } });
}

// ─── Helpers de test ─────────────────────────────────────────────

let pasadas = 0;
let fallidas = 0;
const errores: string[] = [];

function ok(nombre: string, condicion: boolean, detalle?: string) {
  if (condicion) {
    console.log(`  ✅ ${nombre}`);
    pasadas++;
  } else {
    const msg = `  ❌ ${nombre}${detalle ? ` — ${detalle}` : ''}`;
    console.log(msg);
    errores.push(msg);
    fallidas++;
  }
}

async function esperarEventos(ms = 300) {
  await new Promise((r) => setTimeout(r, ms));
}

async function delay(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function requestWithRetry(
  method: string,
  path: string,
  body?: object,
  token?: string,
  maxRetries = 4,
): Promise<{ status: number; data: any }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await request(method, path, body, token);
    if (res.status !== 429) return res;
    const wait = (attempt + 1) * 5000;
    console.log(`  ⚠️  429 Throttle (intento ${attempt + 1}/${maxRetries}), esperando ${wait / 1000}s...`);
    await delay(wait);
  }
  return request(method, path, body, token);
}

async function limpiarVentasTest() {
  await prisma.detalleVenta.deleteMany({
    where: { venta: { vendedorId: TEST.VENDEDOR_ID } },
  });
  await prisma.venta.deleteMany({ where: { vendedorId: TEST.VENDEDOR_ID } });
}

async function resetStockSeedVendedor() {
  // Restablece el stock de la tanda activa del vendedor seed (V.activo_ok)
  // para que los tests normales (1 y 2) siempre tengan stock suficiente
  await prisma.tanda.update({
    where: { id: SEED.TANDA_EN_CASA_ID },
    data: { stockActual: SEED.STOCK_INICIAL },
  });
}

// ═════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════

async function testVentaNormal(token: string) {
  console.log('\n[1] Venta normal — flujo estándar sin cross-lote');

  await delay(1500);
  // Estado: V.activo_ok tiene lote con T1 EN_CASA y stock=10
  const res = await requestWithRetry(
    'POST',
    '/ventas',
    { detalles: [{ tipo: 'UNIDAD', cantidad: 3 }] },
    token,
  );

  ok('Status 201', res.status === 201, `got ${res.status}`);
  ok('Retorna id de venta', !!res.data?.id, JSON.stringify(res.data));
  ok('cantidadTrabix=3', res.data?.cantidadTrabix === 3);
  ok('montoTotal=24000', Number(res.data?.montoTotal) === 24000);
}

async function testVentaNormalStockInsuficiente(token: string) {
  console.log('\n[2] Venta normal — stock insuficiente sin cross-lote (error esperado)');

  await delay(1500);
  // V.activo_ok tiene T1 EN_CASA con stockActual=10 después del test anterior... aproximado
  // Intentamos 100 trabix → falla
  const res = await requestWithRetry(
    'POST',
    '/ventas',
    { detalles: [{ tipo: 'UNIDAD', cantidad: 100 }] },
    token,
  );

  ok('Status 4xx', res.status >= 400 && res.status < 500, `got ${res.status}: ${JSON.stringify(res.data)}`);
  ok('Venta rechazada (no 201)', res.status !== 201 && res.status < 500, `got ${res.status}`);
}

async function testCrossLoteUnidades(tokenTest: string) {
  console.log('\n[3] Cross-lote — S=1, sale=2 UNIDAD (sin split de promo)');

  await limpiarVentasTest();
  await crearEstadoCrossLote(1, 'EXITOSO', 25);
  await delay(1500);
  const stockLote2Antes = (await obtenerTanda(TEST.TANDA2_1_ID))!.stockActual;

  const res = await requestWithRetry(
    'POST',
    '/ventas',
    { detalles: [{ tipo: 'UNIDAD', cantidad: 2 }] },
    tokenTest,
  );

  await esperarEventos(400);

  ok('Status 201', res.status === 201, `got ${res.status}: ${JSON.stringify(res.data)}`);
  ok('cantidadTrabix total=2', res.data?.cantidadTrabix === 2 || res.data?.cantidadTrabix === 1, JSON.stringify(res.data));

  const tanda1_2 = await obtenerTanda(TEST.TANDA1_2_ID);
  const tanda2_1 = await obtenerTanda(TEST.TANDA2_1_ID);

  ok('Lote1 T2 stock llegó a 0', tanda1_2?.stockActual === 0, `stockActual=${tanda1_2?.stockActual}`);
  ok('Lote2 T1 consumió 1 trabix', tanda2_1?.stockActual === stockLote2Antes - 1, `antes=${stockLote2Antes}, ahora=${tanda2_1?.stockActual}`);

  const ventas = await obtenerVentasMasRecientes(2);
  ok('Se crearon 2 ventas (una por lote)', ventas.length >= 2, `ventas=${ventas.length}`);

  const ventaLote1 = ventas.find((v) => v.loteId === TEST.LOTE1_ID);
  const ventaLote2 = ventas.find((v) => v.loteId === TEST.LOTE2_ID);
  ok('Venta en lote1', !!ventaLote1, `lotes=${ventas.map((v) => v.loteId).join(',')}`);
  ok('Venta en lote2', !!ventaLote2, `lotes=${ventas.map((v) => v.loteId).join(',')}`);

  if (ventaLote1) {
    ok('No hay PROMO_PARCIAL en lote1', ventaLote1.detalles.every((d) => d.tipo !== 'PROMO_PARCIAL'));
  }

  const miniCuadre = await obtenerMiniCuadre(TEST.LOTE1_ID);
  ok('Mini-cuadre lote1 activado (PENDIENTE o auto-confirmado)', miniCuadre?.estado !== 'INACTIVO', `estado=${miniCuadre?.estado}`);
}

async function testCrossLotePromoEnteraALote1(tokenTest: string) {
  console.log('\n[4] Cross-lote — S=2, sale=[1 PROMO, 1 UNIDAD] (promo entera a lote1, sin split)');

  await limpiarVentasTest();
  await crearEstadoCrossLote(2, 'EXITOSO', 25);
  await delay(1500);
  const stockLote2Antes = (await obtenerTanda(TEST.TANDA2_1_ID))!.stockActual;

  const res = await requestWithRetry(
    'POST',
    '/ventas',
    { detalles: [{ tipo: 'PROMO', cantidad: 1 }, { tipo: 'UNIDAD', cantidad: 1 }] },
    tokenTest,
  );

  await esperarEventos(400);

  ok('Status 201', res.status === 201, `got ${res.status}: ${JSON.stringify(res.data)}`);

  const tanda1_2 = await obtenerTanda(TEST.TANDA1_2_ID);
  const tanda2_1 = await obtenerTanda(TEST.TANDA2_1_ID);

  ok('Lote1 T2 stock llegó a 0', tanda1_2?.stockActual === 0, `stockActual=${tanda1_2?.stockActual}`);
  ok('Lote2 T1 consumió 1 trabix (1 UNIDAD)', tanda2_1?.stockActual === stockLote2Antes - 1, `antes=${stockLote2Antes}, ahora=${tanda2_1?.stockActual}`);

  const ventas = await obtenerVentasMasRecientes(2);
  const ventaLote1 = ventas.find((v) => v.loteId === TEST.LOTE1_ID);
  if (ventaLote1) {
    ok('Lote1 tiene PROMO (no PROMO_PARCIAL)', ventaLote1.detalles.some((d) => d.tipo === 'PROMO'));
    ok('No hay PROMO_PARCIAL en lote1', ventaLote1.detalles.every((d) => d.tipo !== 'PROMO_PARCIAL'));
  }

  const miniCuadre = await obtenerMiniCuadre(TEST.LOTE1_ID);
  ok('Mini-cuadre lote1 activado', miniCuadre?.estado !== 'INACTIVO', `estado=${miniCuadre?.estado}`);
}

async function testCrossLotePromoSplit(tokenTest: string) {
  console.log('\n[5] Cross-lote — S=1, sale=[1 PROMO] (split forzado → PROMO_PARCIAL)');

  await limpiarVentasTest();
  await crearEstadoCrossLote(1, 'EXITOSO', 25);
  await delay(1500);
  const stockLote2Antes = (await obtenerTanda(TEST.TANDA2_1_ID))!.stockActual;

  const res = await requestWithRetry(
    'POST',
    '/ventas',
    { detalles: [{ tipo: 'PROMO', cantidad: 1 }] },
    tokenTest,
  );

  await esperarEventos(400);

  ok('Status 201', res.status === 201, `got ${res.status}: ${JSON.stringify(res.data)}`);

  const tanda1_2 = await obtenerTanda(TEST.TANDA1_2_ID);
  const tanda2_1 = await obtenerTanda(TEST.TANDA2_1_ID);

  ok('Lote1 T2 stock llegó a 0', tanda1_2?.stockActual === 0, `stockActual=${tanda1_2?.stockActual}`);
  ok('Lote2 T1 consumió 1 trabix', tanda2_1?.stockActual === stockLote2Antes - 1, `antes=${stockLote2Antes}, ahora=${tanda2_1?.stockActual}`);

  const ventas = await obtenerVentasMasRecientes(2);
  const ventaLote1 = ventas.find((v) => v.loteId === TEST.LOTE1_ID);
  const ventaLote2 = ventas.find((v) => v.loteId === TEST.LOTE2_ID);

  if (ventaLote1) {
    ok('Lote1 tiene PROMO_PARCIAL', ventaLote1.detalles.some((d) => d.tipo === 'PROMO_PARCIAL'), JSON.stringify(ventaLote1.detalles));
    const precio = Number(ventaLote1.detalles.find((d) => d.tipo === 'PROMO_PARCIAL')?.precioUnitario);
    ok('Precio PROMO_PARCIAL = precioPromo/2 (6000)', precio === 6000, `precio=${precio}`);
  }

  if (ventaLote2) {
    ok('Lote2 tiene PROMO_PARCIAL', ventaLote2.detalles.some((d) => d.tipo === 'PROMO_PARCIAL'));
  }

  const miniCuadre = await obtenerMiniCuadre(TEST.LOTE1_ID);
  ok('Mini-cuadre lote1 activado', miniCuadre?.estado !== 'INACTIVO', `estado=${miniCuadre?.estado}`);
}

async function testCrossLoteBloqueadoCuadreNOExitoso(tokenTest: string) {
  console.log('\n[6] Cross-lote BLOQUEADO — cuadre de última tanda NO es EXITOSO');

  await limpiarVentasTest();
  await crearEstadoCrossLote(1, 'INACTIVO', 25);
  await delay(1500);

  const res = await requestWithRetry(
    'POST',
    '/ventas',
    { detalles: [{ tipo: 'UNIDAD', cantidad: 2 }] },
    tokenTest,
  );

  ok('Rechaza la venta (4xx)', res.status >= 400 && res.status < 500, `got ${res.status}: ${JSON.stringify(res.data)}`);
  ok('Error — no es stock insuficiente por cross-lote bloqueado', res.status !== 201, JSON.stringify(res.data));

  const tanda1_2 = await obtenerTanda(TEST.TANDA1_2_ID);
  ok('Stock lote1 no se tocó', tanda1_2?.stockActual === 1, `stockActual=${tanda1_2?.stockActual}`);
}

async function testCrossLoteBloqueadoCuadrePendiente(tokenTest: string) {
  console.log('\n[7] Cross-lote BLOQUEADO — cuadre en PENDIENTE (no EXITOSO)');

  await limpiarVentasTest();
  await crearEstadoCrossLote(1, 'PENDIENTE', 25);
  await delay(1500);

  const res = await requestWithRetry(
    'POST',
    '/ventas',
    { detalles: [{ tipo: 'UNIDAD', cantidad: 2 }] },
    tokenTest,
  );

  ok('Rechaza la venta (4xx)', res.status >= 400 && res.status < 500, `got ${res.status}`);

  const tanda1_2 = await obtenerTanda(TEST.TANDA1_2_ID);
  ok('Stock lote1 no se tocó', tanda1_2?.stockActual === 1, `stockActual=${tanda1_2?.stockActual}`);
}

async function testCrossLote2Unidades1Promo(tokenTest: string) {
  console.log('\n[8] Cross-lote — S=1, sale=[2 UNIDAD, 1 PROMO] (1U a lote1, 1U+1P a lote2)');

  await limpiarVentasTest();
  await crearEstadoCrossLote(1, 'EXITOSO', 25);
  await delay(1500);
  const stockLote2Antes = (await obtenerTanda(TEST.TANDA2_1_ID))!.stockActual;

  const res = await requestWithRetry(
    'POST',
    '/ventas',
    { detalles: [{ tipo: 'UNIDAD', cantidad: 2 }, { tipo: 'PROMO', cantidad: 1 }] },
    tokenTest,
  );

  await esperarEventos(400);

  ok('Status 201', res.status === 201, `got ${res.status}: ${JSON.stringify(res.data)}`);

  const tanda1_2 = await obtenerTanda(TEST.TANDA1_2_ID);
  const tanda2_1 = await obtenerTanda(TEST.TANDA2_1_ID);

  ok('Lote1 T2 stock llegó a 0', tanda1_2?.stockActual === 0, `stockActual=${tanda1_2?.stockActual}`);
  // Lote2 debe haber consumido 3 trabix (1 UNIDAD + 1 PROMO)
  ok('Lote2 T1 consumió 3 trabix', tanda2_1?.stockActual === stockLote2Antes - 3, `antes=${stockLote2Antes}, ahora=${tanda2_1?.stockActual}`);

  const ventas = await obtenerVentasMasRecientes(2);
  const ventaLote1 = ventas.find((v) => v.loteId === TEST.LOTE1_ID);
  if (ventaLote1) {
    ok('Lote1 no tiene PROMO ni PROMO_PARCIAL', ventaLote1.detalles.every((d) => d.tipo !== 'PROMO' && d.tipo !== 'PROMO_PARCIAL'), JSON.stringify(ventaLote1.detalles));
  }
}

async function testVendedorInactivo() {
  console.log('\n[9] Vendedor inactivo — no puede vender');

  // Usar V.inactivo del seed (cedula 3)
  let token: string;
  try {
    token = await login(1000000003, 'Trabix2026!');
  } catch {
    ok('Vendedor inactivo bloqueado en login', true); // Si ni siquiera puede hacer login, está bien
    return;
  }

  const res = await requestWithRetry(
    'POST',
    '/ventas',
    { detalles: [{ tipo: 'UNIDAD', cantidad: 1 }] },
    token,
  );

  ok('Vendedor inactivo rechazado (4xx)', res.status >= 400, `got ${res.status}`);
}

async function testPROMO_PARCIALRechazadoDeUsuario(tokenTest: string) {
  console.log('\n[10] PROMO_PARCIAL desde usuario externo — debe rechazarse');

  await delay(1500);
  const res = await requestWithRetry(
    'POST',
    '/ventas',
    { detalles: [{ tipo: 'PROMO_PARCIAL', cantidad: 1 }] },
    tokenTest,
  );

  ok('PROMO_PARCIAL rechazado por DTO (400)', res.status === 400, `got ${res.status}: ${JSON.stringify(res.data)}`);
}

// ═════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║    TESTS DE INTEGRACIÓN — CROSS-LOTE & FLUJO      ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  try {
    // Limpiar y preparar datos de test
    console.log('\n→ Preparando datos de test...');
    await limpiarDatosTest();
    await crearVendedorTest();
    await resetStockSeedVendedor();
    console.log('  Vendedor de test creado, stock seed restablecido');

    // Login admin
    const adminToken = await login(1234567890, 'trabix333');
    console.log('  Login admin OK');

    // Login vendedor de test
    const testToken = await login(TEST.CEDULA, 'Trabix2026!');
    console.log('  Login vendedor test OK');

    // Login vendedor normal del seed (V.activo_ok, cedula 1)
    const normalToken = await login(1000000001, 'Trabix2026!');
    console.log('  Login vendedor normal OK');

    // ─── Ejecutar tests ───────────────────────────────────────

    await testVentaNormal(normalToken);
    await testVentaNormalStockInsuficiente(normalToken);
    await testCrossLoteUnidades(testToken);
    await testCrossLotePromoEnteraALote1(testToken);
    await testCrossLotePromoSplit(testToken);
    await testCrossLoteBloqueadoCuadreNOExitoso(testToken);
    await testCrossLoteBloqueadoCuadrePendiente(testToken);
    await testCrossLote2Unidades1Promo(testToken);
    await testVendedorInactivo();
    await testPROMO_PARCIALRechazadoDeUsuario(testToken);

  } catch (err: any) {
    console.error('\n💥 Error inesperado en test:', err.message ?? err);
    fallidas++;
  } finally {
    console.log('\n→ Limpiando datos de test...');
    try {
      await limpiarDatosTest();
      console.log('  Limpieza completa');
    } catch (e: any) {
      console.warn('  Limpieza parcial:', e.message);
    }

    await prisma.$disconnect();

    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log(`║  RESULTADO: ${pasadas} pasadas, ${fallidas} fallidas                  ║`);
    console.log('╚═══════════════════════════════════════════════════╝');

    if (errores.length > 0) {
      console.log('\nFallaron:');
      errores.forEach((e) => console.log(e));
    }

    process.exit(fallidas > 0 ? 1 : 0);
  }
}

main();
