import * as bcrypt from 'bcryptjs';

// ============================================================
// CONSTANTES DE NEGOCIO (mirrors .env)
// ============================================================
export const BCRYPT_ROUNDS = 12;

export const BIZ = {
  costoPercibido: 2400,
  aporteFondoPorTrabix: 200,
  precioUnidadLicor: 8000,
  precioPromoLicor: 12000,
  precioUnidadSinLicor: 7000,
  precioMayor20Licor: 4900,
  precioMayor50Licor: 4700,
  precioMayor100Licor: 4500,
  precioMayor20SinLicor: 4800,
  precioMayor50SinLicor: 4500,
  precioMayor100SinLicor: 4200,
  mensualidadConDeposito: 9990,
  mensualidadSinDeposito: 19990,
  depositoEquipamiento: 49990,
  costoDanoNevera: 30000,
  costoDanoPijama: 60000,
  porcentajeVendedor6040: 0.6,
  porcentajeAdmin6040: 0.4,
  porcentajeVendedor5050: 0.5,
  porcentajeInversionVendedor: 0.5,
  limiteRegalos: 8, // 8% del lote
  umbralTandasTres: 50,
};

// ============================================================
// IDS PREDEFINIDOS (para referencia cruzada entre seeds)
// ============================================================

// --- Usuarios ---
export const ADMIN_ID = '00000000-0000-4000-a000-000000000001';

// Vendedores directos del admin (modelo 60/40) — IDs 100-149
export const V = {
  activo_ok:            '00000000-0000-4000-a000-000000000100', // activo, pwd cambiada, lote activo
  activo_pwd_temp:      '00000000-0000-4000-a000-000000000101', // activo, requiere cambio pwd
  inactivo:             '00000000-0000-4000-a000-000000000102', // inactivo
  eliminado:            '00000000-0000-4000-a000-000000000103', // soft-deleted
  bloqueado_l1:         '00000000-0000-4000-a000-000000000104', // bloqueado nivel 1 (5 intentos)
  bloqueado_l2:         '00000000-0000-4000-a000-000000000105', // bloqueado nivel 2 (10 intentos)
  bloqueado_perm:       '00000000-0000-4000-a000-000000000106', // bloqueado permanente (20+)
  con_lote_creado:      '00000000-0000-4000-a000-000000000107', // lote en CREADO
  con_lote_finalizado:  '00000000-0000-4000-a000-000000000108', // lote FINALIZADO
  multi_lotes:          '00000000-0000-4000-a000-000000000109', // múltiples lotes
  eq_solicitado:        '00000000-0000-4000-a000-000000000110', // equipamiento SOLICITADO
  eq_activo_deposito:   '00000000-0000-4000-a000-000000000111', // equipamiento ACTIVO con depósito
  eq_activo_sin_dep:    '00000000-0000-4000-a000-000000000112', // equipamiento ACTIVO sin depósito
  eq_devuelto:          '00000000-0000-4000-a000-000000000113', // equipamiento DEVUELTO
  eq_danado:            '00000000-0000-4000-a000-000000000114', // equipamiento DANADO
  eq_perdido:           '00000000-0000-4000-a000-000000000115', // equipamiento PERDIDO
  sin_lotes:            '00000000-0000-4000-a000-000000000116', // vendedor sin lotes (nuevo)
  inactivo_con_lote:    '00000000-0000-4000-a000-000000000117', // inactivo pero con lote activo
  con_ventas_pend:      '00000000-0000-4000-a000-000000000118', // tiene ventas pendientes
  con_ventas_rech:      '00000000-0000-4000-a000-000000000119', // tiene ventas rechazadas
  cuadre_pendiente:     '00000000-0000-4000-a000-000000000120', // cuadre en PENDIENTE
  cuadre_exitoso:       '00000000-0000-4000-a000-000000000121', // cuadre EXITOSO
  mini_cuadre_pend:     '00000000-0000-4000-a000-000000000122', // mini-cuadre PENDIENTE
  venta_mayor_pend:     '00000000-0000-4000-a000-000000000123', // venta mayor PENDIENTE
  venta_mayor_comp:     '00000000-0000-4000-a000-000000000124', // venta mayor COMPLETADA
  login_reciente:       '00000000-0000-4000-a000-000000000125', // último login reciente
  sin_login:            '00000000-0000-4000-a000-000000000126', // nunca ha hecho login
  cambio_estado_rec:    '00000000-0000-4000-a000-000000000127', // cambió estado recientemente
  lote_forzado:         '00000000-0000-4000-a000-000000000128', // tiene lote forzado
  eq_mensualidad_mora:  '00000000-0000-4000-a000-000000000129', // equipamiento con mensualidad en mora
};

// Reclutadores (vendedores que reclutan — se convierten en RECLUTADOR)
export const R = {
  activo_con_recl:   '00000000-0000-4000-a000-000000000200', // reclutador activo con reclutados
  inactivo:          '00000000-0000-4000-a000-000000000201', // reclutador inactivo
  con_cadena:        '00000000-0000-4000-a000-000000000202', // reclutador que forma cadena multinivel
  eliminado:         '00000000-0000-4000-a000-000000000203', // reclutador eliminado
};

// Vendedores modelo 50/50 (reclutados por reclutadores)
export const V50 = {
  activo_1:          '00000000-0000-4000-a000-000000000300', // reclutado por R.activo_con_recl
  activo_2:          '00000000-0000-4000-a000-000000000301', // reclutado por R.activo_con_recl
  inactivo:          '00000000-0000-4000-a000-000000000302', // reclutado por R.activo_con_recl, inactivo
  con_lote:          '00000000-0000-4000-a000-000000000303', // reclutado por R.con_cadena, con lote
  cadena_nivel2:     '00000000-0000-4000-a000-000000000304', // reclutado por V50.con_lote (cadena N-2)
  pwd_temp:          '00000000-0000-4000-a000-000000000305', // reclutado, pwd temporal
  eliminado:         '00000000-0000-4000-a000-000000000306', // reclutado, eliminado
  bloqueado:         '00000000-0000-4000-a000-000000000307', // reclutado, bloqueado
  con_equip:         '00000000-0000-4000-a000-000000000308', // reclutado con equipamiento
  con_venta_mayor:   '00000000-0000-4000-a000-000000000309', // reclutado con venta al mayor
};

// Vendedores relleno para llegar a 50 (400-409)
export const VX = {
  x01: '00000000-0000-4000-a000-000000000400',
  x02: '00000000-0000-4000-a000-000000000401',
  x03: '00000000-0000-4000-a000-000000000402',
  x04: '00000000-0000-4000-a000-000000000403',
  x05: '00000000-0000-4000-a000-000000000404',
  x06: '00000000-0000-4000-a000-000000000405',
};

// --- Lotes ---
export const LOTE = {
  v_activo_lote1:           '00000000-0000-4000-b000-000000000001', // V.activo_ok - lote ACTIVO 30u (2 tandas)
  v_creado:                 '00000000-0000-4000-b000-000000000002', // V.con_lote_creado - lote CREADO
  v_finalizado:             '00000000-0000-4000-b000-000000000003', // V.con_lote_finalizado - FINALIZADO
  v_multi_1:                '00000000-0000-4000-b000-000000000004', // V.multi_lotes - lote 1 ACTIVO
  v_multi_2:                '00000000-0000-4000-b000-000000000005', // V.multi_lotes - lote 2 CREADO
  v_inactivo_lote:          '00000000-0000-4000-b000-000000000006', // V.inactivo_con_lote - ACTIVO
  v_cuadre_pend:            '00000000-0000-4000-b000-000000000007', // V.cuadre_pendiente - ACTIVO 60u (3 tandas)
  v_cuadre_exit:            '00000000-0000-4000-b000-000000000008', // V.cuadre_exitoso - ACTIVO
  v_mini_cuadre:            '00000000-0000-4000-b000-000000000009', // V.mini_cuadre_pend - ACTIVO
  v_vta_pend:               '00000000-0000-4000-b000-000000000010', // V.con_ventas_pend - ACTIVO
  v_vta_rech:               '00000000-0000-4000-b000-000000000011', // V.con_ventas_rech - ACTIVO
  v_vta_mayor_pend:         '00000000-0000-4000-b000-000000000012', // V.venta_mayor_pend - ACTIVO
  v_vta_mayor_comp:         '00000000-0000-4000-b000-000000000013', // V.venta_mayor_comp - ACTIVO
  v50_con_lote:             '00000000-0000-4000-b000-000000000014', // V50.con_lote - ACTIVO 50/50
  v_lote_forzado:           '00000000-0000-4000-b000-000000000015', // V.lote_forzado - lote FORZADO
  v50_vta_mayor:            '00000000-0000-4000-b000-000000000016', // V50.con_venta_mayor - ACTIVO
};

// --- Tandas (auto-generadas en el seed, pero IDs para referencia de cuadres/ventas) ---
export const TANDA = {
  // Lote V.activo_ok (30u, 2 tandas: 15+15)
  activo_t1: '00000000-0000-4000-c000-000000000001',
  activo_t2: '00000000-0000-4000-c000-000000000002',
  // Lote V.con_lote_finalizado (40u, 2 tandas)
  final_t1:  '00000000-0000-4000-c000-000000000003',
  final_t2:  '00000000-0000-4000-c000-000000000004',
  // Lote V.cuadre_pendiente (60u, 3 tandas)
  cuadre_t1: '00000000-0000-4000-c000-000000000005',
  cuadre_t2: '00000000-0000-4000-c000-000000000006',
  cuadre_t3: '00000000-0000-4000-c000-000000000007',
  // Lote V.cuadre_exitoso (40u, 2 tandas)
  exit_t1:   '00000000-0000-4000-c000-000000000008',
  exit_t2:   '00000000-0000-4000-c000-000000000009',
  // Lote V.mini_cuadre_pend (30u, 2 tandas)
  mini_t1:   '00000000-0000-4000-c000-000000000010',
  mini_t2:   '00000000-0000-4000-c000-000000000011',
  // Lote V.con_ventas_pend (30u, 2 tandas)
  vpend_t1:  '00000000-0000-4000-c000-000000000012',
  vpend_t2:  '00000000-0000-4000-c000-000000000013',
  // Lote V.con_ventas_rech (30u, 2 tandas)
  vrech_t1:  '00000000-0000-4000-c000-000000000014',
  vrech_t2:  '00000000-0000-4000-c000-000000000015',
  // Lote V.multi_lotes lote1 (50u, 2 tandas)
  multi1_t1: '00000000-0000-4000-c000-000000000016',
  multi1_t2: '00000000-0000-4000-c000-000000000017',
  // Lote V.inactivo_con_lote (30u, 2 tandas)
  inact_t1:  '00000000-0000-4000-c000-000000000018',
  inact_t2:  '00000000-0000-4000-c000-000000000019',
  // Lote V.venta_mayor_pend (50u, 2 tandas)
  vmayp_t1:  '00000000-0000-4000-c000-000000000020',
  vmayp_t2:  '00000000-0000-4000-c000-000000000021',
  // Lote V.venta_mayor_comp (40u, 2 tandas)
  vmayc_t1:  '00000000-0000-4000-c000-000000000022',
  vmayc_t2:  '00000000-0000-4000-c000-000000000023',
  // Lote V50.con_lote (40u, 2 tandas, modelo 50/50)
  v50_t1:    '00000000-0000-4000-c000-000000000024',
  v50_t2:    '00000000-0000-4000-c000-000000000025',
  // Lote forzado
  forz_t1:   '00000000-0000-4000-c000-000000000026',
  forz_t2:   '00000000-0000-4000-c000-000000000027',
  // Lote V50.con_venta_mayor (50u, 2 tandas)
  v50vm_t1:  '00000000-0000-4000-c000-000000000028',
  v50vm_t2:  '00000000-0000-4000-c000-000000000029',
};

// ============================================================
// HELPERS
// ============================================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Fecha relativa a hoy (días negativos = pasado) */
export function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, 0, 0, 0);
  return d;
}

/** Fecha relativa a hoy en horas */
export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}
/** Calcula inversiones de un lote */
export function calcularInversiones(cantidadTrabix: number) {
  const inversionTotal = cantidadTrabix * BIZ.costoPercibido;
  const inversionAdmin = inversionTotal * (1 - BIZ.porcentajeInversionVendedor);
  const inversionVendedor = inversionTotal * BIZ.porcentajeInversionVendedor;
  return { inversionTotal, inversionAdmin, inversionVendedor };
}
/** Genera cédula aleatoria colombiana */
export function cedula(index: number): number {
  return 1000000000 + index;
}
