import { PrismaClient } from '@prisma/client';
import { V, V50, R, LOTE, TANDA, calcularInversiones, daysAgo } from './helpers';


/**
 * Seed 06: Ventas al Mayor y Cuadres al Mayor
 *
 * Replica el flujo completo de VentaMayor → CuadreMayor:
 * 1. VentaMayorRegistrada event auto-crea CuadreMayor PENDIENTE
 * 2. Admin llama completar() → VentaMayor pasa a COMPLETADA
 * 3. Admin llama confirmarCuadreMayor() → CuadreMayor pasa a EXITOSO
 *
 * Escenarios cubiertos:
 *   A (f001/cf001): VentaMayor PENDIENTE + CuadreMayor PENDIENTE
 *                   Lote 12, V.venta_mayor_pend, ANTICIPADO
 *                   → probar POST /ventas-mayor/:id/completar
 *                   Al confirmar: T1 vmayp_t1 (stock=15) - 15 = 0 → T1 FINALIZADA
 *                                 cuadre vmayp_t1 INACTIVO → EXITOSO (stock-exhaustion path)
 *
 *   B (f002/cf002): VentaMayor COMPLETADA + CuadreMayor PENDIENTE (deuda saldada)
 *                   Lote 13, V.venta_mayor_comp, CONTRAENTREGA
 *                   → probar POST /cuadres-mayor/:id/confirmar (deudasSaldadas path)
 *                   Al confirmar: T1 vmayc_t1 (stock=5) - 5 = 0 → cerrado por stock
 *                                 cuadre vmayc_t1 PENDIENTE cerrado via stock exhaustion
 *
 *   C (f003/cf003): VentaMayor COMPLETADA + CuadreMayor PENDIENTE (lote forzado)
 *                   V.lote_forzado sin lotes regulares → lote 15 forzado
 *                   → probar POST /cuadres-mayor/:id/confirmar (loteForzado path)
 *                   Al confirmar: lote 15 ACTIVO → FINALIZADO, tandas forz_t1/t2 → FINALIZADA
 *
 *   D (f004/cf004): VentaMayor COMPLETADA + CuadreMayor EXITOSO (50/50 + reclutador)
 *                   Lote 16, V50.con_venta_mayor, CONTRAENTREGA
 *                   → flujo completado con gananciaReclutador
 *
 * ============================================================
 * CÁLCULOS FINANCIEROS
 * (evaluador-financiero-mayor.service.ts → calcularDistribucion)
 * ============================================================
 *
 * Escenario A — MODELO_60_40, sin deudas, T1 se agota al confirmar:
 *   lotesExistentes=[lote12], loteForzado=null
 *   dineroRecaudadoDetal = lote12.dineroRecaudado - 0 - 0 = 80000
 *   dineroDisponible = 73500 + 80000 = 153500
 *   deudasSaldadas = 0
 *   invAdminEx = min(153500, 60000) = 60000 → remaining = 93500
 *   invVendEx  = min(93500,  60000) = 60000 → remaining = 33500
 *   gananciaNeta = 33500  → gananciaAdmin = 13400, gananciaVend = 20100
 *   montoTotalAdmin = 0 + 60000 + 0 + 13400 = 73400
 *   montoTotalVendedor = 60000 + 0 + 20100 = 80100
 *
 * Escenario B — MODELO_60_40, cuadre vmayc_t1 PENDIENTE $48000 (deuda):
 *   lotesExistentes=[lote13], loteForzado=null
 *   dineroRecaudadoDetal = lote13.dineroRecaudado - 0 - 0 = 100000
 *   dineroDisponible = 24500 + 100000 = 124500
 *   deudasSaldadas = min(124500, 48000) = 48000 → remaining = 76500
 *   invPendAdmin = invAdmin(48000) - dineroTransferido(0) = 48000
 *   invAdminEx  = min(76500, 48000) = 48000 → remaining = 28500
 *   invPendVend = invVend(48000) - dineroVendDist(0) = 48000
 *   invVendEx   = min(28500, 48000) = 28500 → remaining = 0
 *   gananciaNeta = 0
 *   montoTotalAdmin = 48000 + 48000 + 0 + 0 = 96000
 *   montoTotalVendedor = 28500 + 0 + 0 = 28500
 *
 * Escenario C — MODELO_60_40, lote forzado (25u), sin lotes existentes:
 *   lotesExistentes=[], loteForzado={inv25}
 *   dineroRecaudadoDetal = 0 (sin lotes existentes)
 *   dineroDisponible = 122500 + 0 = 122500
 *   deudasSaldadas = 0
 *   invAdminForzado  = min(122500, 30000) = 30000 → remaining = 92500
 *   invVendForzado   = min(92500,  30000) = 30000 → remaining = 62500
 *   gananciaNeta = 62500 → gananciaAdmin = 25000, gananciaVend = 37500
 *   montoTotalAdmin = 0 + 0 + 30000 + 25000 = 55000
 *   montoTotalVendedor = 0 + 30000 + 37500 = 67500
 *
 * Escenario D — MODELO_50_50 con R.con_cadena (nivel 1):
 *   lotesExistentes=[lote16], loteForzado=null
 *   dineroRecaudadoDetal = lote16.dineroRecaudado(antes confirmar=90000) - 0 - 0 = 90000
 *   dineroDisponible = 49000 + 90000 = 139000
 *   deudasSaldadas = 0
 *   invAdminEx = min(139000, 60000) = 60000 → remaining = 79000
 *   invVendEx  = min(79000,  60000) = 60000 → remaining = 19000
 *   gananciaNeta = 19000
 *   MODELO_50_50 cascade: vendedor=9500, R.con_cadena=4750, admin=4750
 *   montoTotalAdmin = 0 + 60000 + 0 + 4750 = 64750
 *   montoTotalVendedor = 60000 + 0 + 9500 = 69500
 */

// ============================================================
// IDS PREDEFINIDOS
// ============================================================

/** VentaMayor IDs: 00000000-0000-4000-f000-NNNNNNNNNNNN */
export const VENTA_MAYOR = {
  pend: '00000000-0000-4000-f000-000000000001', // Escenario A: PENDIENTE
  comp: '00000000-0000-4000-f000-000000000002', // Escenario B: COMPLETADA
  forz: '00000000-0000-4000-f000-000000000003', // Escenario C: COMPLETADA + lote forzado
  exit: '00000000-0000-4000-f000-000000000004', // Escenario D: COMPLETADA + CuadreMayor EXITOSO
};

/** CuadreMayor IDs: 00000000-0000-4000-cf00-NNNNNNNNNNNN */
export const CUADRE_MAYOR = {
  pend:      '00000000-0000-4000-cf00-000000000001', // Escenario A
  comp_pend: '00000000-0000-4000-cf00-000000000002', // Escenario B
  forz_pend: '00000000-0000-4000-cf00-000000000003', // Escenario C (lote forzado)
  exit:      '00000000-0000-4000-cf00-000000000004', // Escenario D (EXITOSO)
};

export async function seedVentasMayorCuadresMayor(prisma: PrismaClient) {
  console.log('  → Creando ventas al mayor y cuadres al mayor...');

  const inv40 = calcularInversiones(40); // invAdmin=48000, invVendedor=48000
  const inv50 = calcularInversiones(50); // invAdmin=60000, invVendedor=60000
  const inv25 = calcularInversiones(25); // invAdmin=30000, invVendedor=30000

  // =========================================================
  // ESCENARIO A: VentaMayor PENDIENTE → CuadreMayor PENDIENTE
  // Lote 12 (50u, MODELO_60_40) · V.venta_mayor_pend
  // 15u de TANDA.vmayp_t1 (EN_CASA) a $4900/u = $73500
  // stockActual T1 = 15 → al confirmar: 15 - 15 = 0 (T1 FINALIZADA, cuadre vmayp_t1 EXITOSO)
  // =========================================================

  await prisma.ventaMayor.create({
    data: {
      id: VENTA_MAYOR.pend,
      vendedorId: V.venta_mayor_pend,
      cantidadUnidades: 15,
      precioUnidad: 4900,
      ingresoBruto: 73500,
      conLicor: true,
      modalidad: 'ANTICIPADO',
      estado: 'PENDIENTE',
      fechaRegistro: daysAgo(5),
    },
  });

  // Fuente de stock: 15u de T1 del lote 12 (EN_CASA)
  await prisma.fuenteStockMayor.create({
    data: {
      ventaMayorId: VENTA_MAYOR.pend,
      tandaId: TANDA.vmayp_t1,
      cantidadConsumida: 15,
      tipoStock: 'EN_CASA',
    },
  });

  // Lote involucrado: lote 12
  await prisma.loteVentaMayor.create({
    data: {
      ventaMayorId: VENTA_MAYOR.pend,
      loteId: LOTE.v_vta_mayor_pend,
    },
  });

  // CuadreMayor A: PENDIENTE (auto-creado por VentaMayorRegistradaHandler)
  // dineroRecaudadoDetal=80000 (lote12.dineroRecaudado=80000, 10 detal × $8000)
  // dineroDisponible=153500, gananciaNeta=33500, gananciaAdmin=13400, gananciaVend=20100
  await prisma.cuadreMayor.create({
    data: {
      id: CUADRE_MAYOR.pend,
      ventaMayorId: VENTA_MAYOR.pend,
      vendedorId: V.venta_mayor_pend,
      modalidad: 'ANTICIPADO',
      estado: 'PENDIENTE',
      cantidadUnidades: 15,
      precioUnidad: 4900,
      ingresoBruto: 73500,
      deudasSaldadas: 0,
      inversionAdminLotesExistentes: inv50.inversionAdmin,       // 60000
      inversionAdminLoteForzado: 0,
      inversionVendedorLotesExistentes: inv50.inversionVendedor, // 60000
      inversionVendedorLoteForzado: 0,
      gananciasAdmin: 13400,     // 33500 × 0.4
      gananciasVendedor: 20100,  // 33500 × 0.6
      evaluacionFinanciera: {
        dineroRecaudadoDetal: 80000,
        dineroVentaMayor: 73500,
        dineroTotalDisponible: 153500,
        inversionAdminTotal: 60000,
        inversionVendedorTotal: 60000,
        inversionAdminCubierta: 60000,
        inversionVendedorCubierta: 60000,
        gananciaNeta: 33500,
        gananciaAdmin: 13400,
        gananciaVendedor: 20100,
        deudasSaldadas: 0,
        gananciasReclutadores: [],
      },
      montoTotalAdmin: 73400,    // 0 + 60000 + 0 + 13400
      montoTotalVendedor: 80100, // 60000 + 0 + 20100
      lotesInvolucradosIds: [LOTE.v_vta_mayor_pend],
      tandasAfectadas: [
        {
          tandaId: TANDA.vmayp_t1,
          cantidadStockConsumido: 15,
          numeroTanda: 1,
          loteId: LOTE.v_vta_mayor_pend,
        },
      ],
      cuadresCerradosIds: [],
      loteForzadoId: null,
      fechaRegistro: daysAgo(5),
    },
  });

  // =========================================================
  // ESCENARIO B: VentaMayor COMPLETADA → CuadreMayor PENDIENTE (listo para confirmar)
  // Lote 13 (40u, MODELO_60_40) · V.venta_mayor_comp
  // 5u de TANDA.vmayc_t1 (EN_CASA) a $4900/u = $24500
  // Cuadre vmayc_t1 (PENDIENTE, $48000) se saldará al confirmar via stock exhaustion
  // stockActual T1 = 5 → al confirmar: 5 - 5 = 0 → T1 FINALIZADA, cuadre vmayc_t1 → EXITOSO
  // =========================================================

  await prisma.ventaMayor.create({
    data: {
      id: VENTA_MAYOR.comp,
      vendedorId: V.venta_mayor_comp,
      cantidadUnidades: 5,
      precioUnidad: 4900,
      ingresoBruto: 24500,
      conLicor: true,
      modalidad: 'CONTRAENTREGA',
      estado: 'COMPLETADA',
      fechaRegistro: daysAgo(18),
      fechaCompletada: daysAgo(8),
    },
  });

  await prisma.fuenteStockMayor.create({
    data: {
      ventaMayorId: VENTA_MAYOR.comp,
      tandaId: TANDA.vmayc_t1,
      cantidadConsumida: 5,
      tipoStock: 'EN_CASA',
    },
  });

  await prisma.loteVentaMayor.create({
    data: {
      ventaMayorId: VENTA_MAYOR.comp,
      loteId: LOTE.v_vta_mayor_comp,
    },
  });

  // CuadreMayor B: PENDIENTE (listo para confirmar)
  // deudasSaldadas=48000 → cuadre vmayc_t1 PENDIENTE se cierra via stock exhaustion
  // Al confirmar: T1 se agota → closedByStock=[vmayc_t1], deudaFromStockClosures=48000
  // remaining=max(0, 48000-48000)=0 → no cuadresDeudaSaldada adicionales
  await prisma.cuadreMayor.create({
    data: {
      id: CUADRE_MAYOR.comp_pend,
      ventaMayorId: VENTA_MAYOR.comp,
      vendedorId: V.venta_mayor_comp,
      modalidad: 'CONTRAENTREGA',
      estado: 'PENDIENTE',
      cantidadUnidades: 5,
      precioUnidad: 4900,
      ingresoBruto: 24500,
      deudasSaldadas: 48000,    // cuadre vmayc_t1 montoEsperado=48000 (full closure)
      inversionAdminLotesExistentes: inv40.inversionAdmin,       // 48000
      inversionAdminLoteForzado: 0,
      inversionVendedorLotesExistentes: 28500, // min(28500 remaining, 48000 invVend)
      inversionVendedorLoteForzado: 0,
      gananciasAdmin: 0,
      gananciasVendedor: 0,
      evaluacionFinanciera: {
        dineroRecaudadoDetal: 100000,
        dineroVentaMayor: 24500,
        dineroTotalDisponible: 124500,
        inversionAdminTotal: inv40.inversionAdmin,      // 48000
        inversionVendedorTotal: inv40.inversionVendedor, // 48000
        inversionAdminCubierta: inv40.inversionAdmin,
        inversionVendedorCubierta: inv40.inversionVendedor,
        gananciaNeta: 0,
        gananciaAdmin: 0,
        gananciaVendedor: 0,
        deudasSaldadas: 48000,
        gananciasReclutadores: [],
      },
      montoTotalAdmin: 96000,   // 48000 (deudasSaldadas) + 48000 (invAdmin)
      montoTotalVendedor: 28500,
      lotesInvolucradosIds: [LOTE.v_vta_mayor_comp],
      tandasAfectadas: [
        {
          tandaId: TANDA.vmayc_t1,
          cantidadStockConsumido: 5,
          numeroTanda: 1,
          loteId: LOTE.v_vta_mayor_comp,
        },
      ],
      cuadresCerradosIds: [],    // se llenará al confirmar (cerrará cuadre vmayc_t1)
      loteForzadoId: null,
      fechaRegistro: daysAgo(18),
    },
  });

  // =========================================================
  // ESCENARIO C: VentaMayor COMPLETADA → CuadreMayor PENDIENTE (LOTE FORZADO)
  // V.lote_forzado no tenía lotes regulares al momento de registro
  // 25u a $4900/u = $122500, TODAS del lote forzado (lote 15)
  // fuentesStock=[] (sin fuentes regulares), tandasAfectadas=[]
  // Al confirmar: lote 15 ACTIVO→FINALIZADO, forz_t1/t2 → FINALIZADA
  //              aporteFondo = 25 × $200 = $5000 (fondo de recompensas)
  // =========================================================

  await prisma.ventaMayor.create({
    data: {
      id: VENTA_MAYOR.forz,
      vendedorId: V.lote_forzado,
      cantidadUnidades: 25,
      precioUnidad: 4900,
      ingresoBruto: 122500,
      conLicor: true,
      modalidad: 'ANTICIPADO',
      estado: 'COMPLETADA',
      fechaRegistro: daysAgo(12),
      fechaCompletada: daysAgo(3),
    },
  });
  // Sin FuenteStockMayor (toda la venta viene del lote forzado, creado después del registro)
  // Sin LoteVentaMayor (sin lotes regulares involucrados)

  // Actualizar lote 15 para apuntar a esta VentaMayor (ventaMayorOrigenId FK)
  await prisma.lote.update({
    where: { id: LOTE.v_lote_forzado },
    data: { ventaMayorOrigenId: VENTA_MAYOR.forz },
  });

  // CuadreMayor C: PENDIENTE con lote forzado (listo para confirmar)
  // lotesExistentes=[], loteForzado=inv25 → invAdminForzado=30000, invVendForzado=30000
  // gananciaNeta=62500, gananciaAdmin=25000, gananciaVend=37500
  await prisma.cuadreMayor.create({
    data: {
      id: CUADRE_MAYOR.forz_pend,
      ventaMayorId: VENTA_MAYOR.forz,
      vendedorId: V.lote_forzado,
      modalidad: 'ANTICIPADO',
      estado: 'PENDIENTE',
      cantidadUnidades: 25,
      precioUnidad: 4900,
      ingresoBruto: 122500,
      deudasSaldadas: 0,
      inversionAdminLotesExistentes: 0,       // sin lotes existentes
      inversionAdminLoteForzado: inv25.inversionAdmin,       // 30000
      inversionVendedorLotesExistentes: 0,    // sin lotes existentes
      inversionVendedorLoteForzado: inv25.inversionVendedor, // 30000
      gananciasAdmin: 25000,     // 62500 × 0.4
      gananciasVendedor: 37500,  // 62500 × 0.6
      evaluacionFinanciera: {
        dineroRecaudadoDetal: 0,
        dineroVentaMayor: 122500,
        dineroTotalDisponible: 122500,
        inversionAdminTotal: 30000,     // solo lote forzado
        inversionVendedorTotal: 30000,
        inversionAdminCubierta: 30000,
        inversionVendedorCubierta: 30000,
        gananciaNeta: 62500,            // 122500 - 0 - 60000
        gananciaAdmin: 25000,
        gananciaVendedor: 37500,
        deudasSaldadas: 0,
        gananciasReclutadores: [],
      },
      montoTotalAdmin: 55000,    // 0 + 0 + 30000 + 25000
      montoTotalVendedor: 67500, // 0 + 30000 + 37500
      lotesInvolucradosIds: [],  // sin lotes regulares (solo lote forzado via loteForzadoId)
      tandasAfectadas: [],       // sin tandas regulares (fuentesStock fue vacío al registrar)
      cuadresCerradosIds: [],
      loteForzadoId: LOTE.v_lote_forzado,
      fechaRegistro: daysAgo(12),
    },
  });

  // =========================================================
  // ESCENARIO D: VentaMayor COMPLETADA → CuadreMayor EXITOSO (50/50 + reclutador)
  // Lote 16 (50u, MODELO_50_50) · V50.con_venta_mayor → reclutado por R.con_cadena
  // 10u de TANDA.v50vm_t1 (EN_CASA) a $4900/u = $49000
  // Lote 16 ya actualizado: dineroTransferido=64750, dineroVendedorDistribuido=69500
  // =========================================================

  await prisma.ventaMayor.create({
    data: {
      id: VENTA_MAYOR.exit,
      vendedorId: V50.con_venta_mayor,
      cantidadUnidades: 10,
      precioUnidad: 4900,
      ingresoBruto: 49000,
      conLicor: true,
      modalidad: 'CONTRAENTREGA',
      estado: 'COMPLETADA',
      fechaRegistro: daysAgo(20),
      fechaCompletada: daysAgo(10),
    },
  });

  await prisma.fuenteStockMayor.create({
    data: {
      ventaMayorId: VENTA_MAYOR.exit,
      tandaId: TANDA.v50vm_t1,
      cantidadConsumida: 10,
      tipoStock: 'EN_CASA',
    },
  });

  await prisma.loteVentaMayor.create({
    data: {
      ventaMayorId: VENTA_MAYOR.exit,
      loteId: LOTE.v50_vta_mayor,
    },
  });

  // CuadreMayor D: EXITOSO (ya confirmado por admin hace 5 días)
  // dineroDisponible=139000, invAdminEx=60000, invVendEx=60000, gananciaNeta=19000
  // MODELO_50_50: vendedor=9500, R.con_cadena=4750, admin=4750
  await prisma.cuadreMayor.create({
    data: {
      id: CUADRE_MAYOR.exit,
      ventaMayorId: VENTA_MAYOR.exit,
      vendedorId: V50.con_venta_mayor,
      modalidad: 'CONTRAENTREGA',
      estado: 'EXITOSO',
      cantidadUnidades: 10,
      precioUnidad: 4900,
      ingresoBruto: 49000,
      deudasSaldadas: 0,
      inversionAdminLotesExistentes: inv50.inversionAdmin,       // 60000
      inversionAdminLoteForzado: 0,
      inversionVendedorLotesExistentes: inv50.inversionVendedor, // 60000
      inversionVendedorLoteForzado: 0,
      gananciasAdmin: 4750,      // 19000 × 0.25 (admin recibe igual que último reclutador)
      gananciasVendedor: 9500,   // 19000 × 0.5
      evaluacionFinanciera: {
        dineroRecaudadoDetal: 90000,  // lote16.dineroRecaudado antes de confirmar
        dineroVentaMayor: 49000,
        dineroTotalDisponible: 139000,
        inversionAdminTotal: 60000,
        inversionVendedorTotal: 60000,
        inversionAdminCubierta: 60000,
        inversionVendedorCubierta: 60000,
        gananciaNeta: 19000, // 139000 - 0 - 120000
        gananciaAdmin: 4750,
        gananciaVendedor: 9500,
        deudasSaldadas: 0,
        gananciasReclutadores: [
          { reclutadorId: R.con_cadena, nivel: 1, monto: 4750 },
        ],
      },
      montoTotalAdmin: 64750,    // 0 + 60000 + 0 + 4750
      montoTotalVendedor: 69500, // 60000 + 0 + 9500
      lotesInvolucradosIds: [LOTE.v50_vta_mayor],
      tandasAfectadas: [
        {
          tandaId: TANDA.v50vm_t1,
          cantidadStockConsumido: 10,
          numeroTanda: 1,
          loteId: LOTE.v50_vta_mayor,
        },
      ],
      cuadresCerradosIds: [], // cuadre v50vm_t1 era INACTIVO, no generó deuda
      loteForzadoId: null,
      fechaRegistro: daysAgo(20),
      fechaExitoso: daysAgo(5),
    },
  });

  // Ganancia de reclutador: R.con_cadena nivel 1 → $4750 (transferida)
  await prisma.gananciaReclutador.create({
    data: {
      cuadreMayorId: CUADRE_MAYOR.exit,
      reclutadorId: R.con_cadena,
      nivel: 1,
      monto: 4750,
      transferido: true,
      fechaTransferencia: daysAgo(5),
    },
  });

  console.log('    ✓ 4 ventas al mayor creadas (1 PENDIENTE, 3 COMPLETADAS)');
  console.log('    ✓ 4 cuadres al mayor creados (3 PENDIENTE, 1 EXITOSO)');
  console.log('    ✓ 3 fuentes de stock (tipoStock EN_CASA), 3 lotes involucrados');
  console.log('    ✓ Escenario C: lote forzado (sin fuentes stock regulares, sin lotes involucrados)');
  console.log('    ✓ 1 ganancia de reclutador (R.con_cadena, nivel 1, $4750)');
}
