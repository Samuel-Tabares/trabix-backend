import { PrismaClient } from '@prisma/client';
import {
  V, V50, R, LOTE, TANDA, BIZ,
  calcularInversiones, daysAgo,
} from './helpers';

/**
 * Seed 07: Ventas al Mayor y Cuadres al Mayor
 * Cubre: PENDIENTE, COMPLETADA, modalidades ANTICIPADO/CONTRAENTREGA
 * Incluye fuentes de stock y cuadres mayor con evaluación financiera
 */
export async function seedVentasMayor(prisma: PrismaClient) {
  console.log('  → Creando ventas al mayor...');

  // ========================================
  // 1. Venta mayor PENDIENTE - V.venta_mayor_pend (25u con licor, contraentrega)
  // ========================================
  const vmPend = await prisma.ventaMayor.create({
    data: {
      vendedorId: V.venta_mayor_pend,
      cantidadUnidades: 25,
      precioUnidad: BIZ.precioMayor20Licor, // 4900 (rango 20-49)
      ingresoBruto: 25 * BIZ.precioMayor20Licor, // 122,500
      conLicor: true,
      modalidad: 'CONTRAENTREGA',
      estado: 'PENDIENTE',
      fechaRegistro: daysAgo(3),
      fuentesStock: {
        create: [
          { tandaId: TANDA.vmayp_t1, cantidadConsumida: 10, tipoStock: 'EN_CASA' },
          { tandaId: TANDA.vmayp_t2, cantidadConsumida: 15, tipoStock: 'RESERVADO' },
        ],
      },
      lotesInvolucrados: {
        create: [
          { loteId: LOTE.v_vta_mayor_pend },
        ],
      },
    },
  });
  console.log('venta mayor pendiente con ingreso bruto de: ' + vmPend.ingresoBruto);

  // ========================================
  // 2. Venta mayor COMPLETADA - V.venta_mayor_comp (20u con licor, anticipado)
  //    Con cuadre mayor EXITOSO
  // ========================================
  const inv40 = calcularInversiones(40);
  const vmComp = await prisma.ventaMayor.create({
    data: {
      vendedorId: V.venta_mayor_comp,
      cantidadUnidades: 20,
      precioUnidad: BIZ.precioMayor20Licor,
      ingresoBruto: 20 * BIZ.precioMayor20Licor, // 98,000
      conLicor: true,
      modalidad: 'ANTICIPADO',
      estado: 'COMPLETADA',
      fechaRegistro: daysAgo(15),
      fechaCompletada: daysAgo(12),
      fuentesStock: {
        create: [
          { tandaId: TANDA.vmayc_t1, cantidadConsumida: 5, tipoStock: 'EN_CASA' },
        ],
      },
      lotesInvolucrados: {
        create: [
          { loteId: LOTE.v_vta_mayor_comp },
        ],
      },
    },
  });

  // Cuadre mayor EXITOSO para la venta completada
  const ingresoBrutoComp = 20 * BIZ.precioMayor20Licor;
  const gananciaNeta = ingresoBrutoComp - inv40.inversionAdmin * 0.5; // simplificado
  await prisma.cuadreMayor.create({
    data: {
      ventaMayorId: vmComp.id,
      vendedorId: V.venta_mayor_comp,
      modalidad: 'ANTICIPADO',
      estado: 'EXITOSO',
      cantidadUnidades: 20,
      precioUnidad: BIZ.precioMayor20Licor,
      ingresoBruto: ingresoBrutoComp,
      deudasSaldadas: 0,
      inversionAdminLotesExistentes: inv40.inversionAdmin,
      inversionAdminLoteForzado: 0,
      inversionVendedorLotesExistentes: inv40.inversionVendedor,
      inversionVendedorLoteForzado: 0,
      gananciasAdmin: gananciaNeta * BIZ.porcentajeAdmin6040,
      gananciasVendedor: gananciaNeta * BIZ.porcentajeVendedor6040,
      evaluacionFinanciera: {
        dineroRecaudadoDetal: '100000',
        dineroVentaMayor: String(ingresoBrutoComp),
        dineroTotalDisponible: String(100000 + ingresoBrutoComp),
        inversionAdminTotal: String(inv40.inversionAdmin),
        inversionVendedorTotal: String(inv40.inversionVendedor),
        inversionAdminCubierta: String(inv40.inversionAdmin),
        inversionVendedorCubierta: String(inv40.inversionVendedor),
        gananciaNeta: String(gananciaNeta),
        gananciaAdmin: String(gananciaNeta * BIZ.porcentajeAdmin6040),
        gananciaVendedor: String(gananciaNeta * BIZ.porcentajeVendedor6040),
        deudasSaldadas: '0',
        gananciasReclutadores: [],
      },
      montoTotalAdmin: inv40.inversionAdmin + gananciaNeta * BIZ.porcentajeAdmin6040,
      montoTotalVendedor: inv40.inversionVendedor + gananciaNeta * BIZ.porcentajeVendedor6040,
      lotesInvolucradosIds: [LOTE.v_vta_mayor_comp],
      tandasAfectadas: [
        { tandaId: TANDA.vmayc_t1, cantidadStockConsumido: 5, numeroTanda: 1, loteId: LOTE.v_vta_mayor_comp },
      ],
      cuadresCerradosIds: [],
      loteForzadoId: null,
      fechaRegistro: daysAgo(15),
      fechaExitoso: daysAgo(12),
    },
  });

  // ========================================
  // 3. Venta mayor COMPLETADA modelo 50/50 - V50.con_venta_mayor (30u sin licor)
  //    Con cascada de ganancias a reclutadores
  // ========================================
  const inv50 = calcularInversiones(50);
  const vm5050 = await prisma.ventaMayor.create({
    data: {
      vendedorId: V50.con_venta_mayor,
      cantidadUnidades: 30,
      precioUnidad: BIZ.precioMayor20SinLicor, // 4800
      ingresoBruto: 30 * BIZ.precioMayor20SinLicor, // 144,000
      conLicor: false,
      modalidad: 'CONTRAENTREGA',
      estado: 'COMPLETADA',
      fechaRegistro: daysAgo(20),
      fechaCompletada: daysAgo(18),
      fuentesStock: {
        create: [
          { tandaId: TANDA.v50vm_t1, cantidadConsumida: 17, tipoStock: 'EN_CASA' },
        ],
      },
      lotesInvolucrados: {
        create: [
          { loteId: LOTE.v50_vta_mayor },
        ],
      },
    },
  });

  // Cuadre mayor con ganancias de reclutadores (modelo 50/50 cascada)
  const ingresoBruto5050 = 30 * BIZ.precioMayor20SinLicor;
  const gananciaTotal5050 = ingresoBruto5050 - inv50.inversionTotal * 0.6;
  const gananciaVendedor5050 = gananciaTotal5050 * 0.5;
  const gananciaRecl1 = gananciaVendedor5050 * 0.5; // R.con_cadena (N-1)
  const gananciaAdmin5050 = gananciaRecl1; // Admin = último nivel

  const cuadreMayor5050 = await prisma.cuadreMayor.create({
    data: {
      ventaMayorId: vm5050.id,
      vendedorId: V50.con_venta_mayor,
      modalidad: 'CONTRAENTREGA',
      estado: 'EXITOSO',
      cantidadUnidades: 30,
      precioUnidad: BIZ.precioMayor20SinLicor,
      ingresoBruto: ingresoBruto5050,
      deudasSaldadas: 0,
      inversionAdminLotesExistentes: inv50.inversionAdmin,
      inversionAdminLoteForzado: 0,
      inversionVendedorLotesExistentes: inv50.inversionVendedor,
      inversionVendedorLoteForzado: 0,
      gananciasAdmin: gananciaAdmin5050,
      gananciasVendedor: gananciaVendedor5050,
      evaluacionFinanciera: {
        dineroRecaudadoDetal: '90000',
        dineroVentaMayor: String(ingresoBruto5050),
        dineroTotalDisponible: String(90000 + ingresoBruto5050),
        inversionAdminTotal: String(inv50.inversionAdmin),
        inversionVendedorTotal: String(inv50.inversionVendedor),
        gananciaNeta: String(gananciaTotal5050),
        gananciaAdmin: String(gananciaAdmin5050),
        gananciaVendedor: String(gananciaVendedor5050),
        deudasSaldadas: '0',
        gananciasReclutadores: [
          { reclutadorId: R.con_cadena, nivel: 1, monto: String(gananciaRecl1) },
        ],
      },
      montoTotalAdmin: inv50.inversionAdmin + gananciaAdmin5050,
      montoTotalVendedor: inv50.inversionVendedor + gananciaVendedor5050,
      lotesInvolucradosIds: [LOTE.v50_vta_mayor],
      tandasAfectadas: [
        { tandaId: TANDA.v50vm_t1, cantidadStockConsumido: 17, numeroTanda: 1, loteId: LOTE.v50_vta_mayor },
      ],
      cuadresCerradosIds: [],
      loteForzadoId: null,
      fechaRegistro: daysAgo(20),
      fechaExitoso: daysAgo(18),
    },
  });

  // Ganancias de reclutadores para el cuadre 50/50
  await prisma.gananciaReclutador.create({
    data: {
      cuadreMayorId: cuadreMayor5050.id,
      reclutadorId: R.con_cadena,
      nivel: 1,
      monto: gananciaRecl1,
      transferido: true,
      fechaTransferencia: daysAgo(17),
    },
  });

  console.log('    ✓ 3 ventas al mayor creadas (PENDIENTE×1, COMPLETADA×2)');
  console.log('    ✓ 2 cuadres al mayor creados (EXITOSO×2)');
  console.log('    ✓ 1 ganancia de reclutador registrada (cascada 50/50)');
}
