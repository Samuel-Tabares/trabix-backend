import { PrismaClient } from '@prisma/client';
import { ADMIN_ID, V, R, V50, VX, hashPassword, daysAgo, hoursAgo, cedula } from './helpers';

/**
 * Seed 02: Usuarios
 * 50 usuarios cubriendo TODOS los escenarios posibles:
 * - Admin (1)
 * - Vendedores 60/40 directos del admin (30)
 * - Reclutadores (4)
 * - Vendedores 50/50 reclutados (10)
 * - Vendedores relleno (6) → total 51 (admin + 50)
 *
 * Escenarios cubiertos:
 * - Activo con password cambiada
 * - Activo con password temporal
 * - Inactivo
 * - Eliminado (soft delete)
 * - Bloqueado nivel 1, 2 y permanente
 * - Con/sin login reciente
 * - Con cambio de estado reciente
 * - Reclutador activo/inactivo/eliminado
 * - Modelo 60/40 y 50/50
 * - Cadena de reclutamiento multinivel
 */
export async function seedUsuarios(prisma: PrismaClient) {
  console.log('  → Creando usuarios...');

  const pwdNormal = await hashPassword('Trabix2026!');
  const pwdTemp = await hashPassword('TempPass123');
  const pwdAdmin = await hashPassword('AdminTrabix2026!');

  // Contador para cédulas únicas
  let ci = 0;
  const nextCedula = () => cedula(++ci);

  // ========================================
  // 1. ADMIN
  // ========================================
  await prisma.usuario.upsert({
    where: { id: ADMIN_ID },
    update: {},
    create: {
      id: ADMIN_ID,
      cedula: 999999999,
      nombre: 'Carlos',
      apellidos: 'Administrador Trabix',
      email: 'admin@trabix.co',
      telefono: '+573001000000',
      passwordHash: pwdAdmin,
      requiereCambioPassword: false,
      rol: 'ADMIN',
      estado: 'ACTIVO',
      modeloNegocio: 'MODELO_60_40',
      reclutadorId: null,
      intentosFallidos: 0,
      ultimoLogin: hoursAgo(1),
    },
  });

  // ========================================
  // 2. VENDEDORES DIRECTOS DEL ADMIN (60/40)
  // ========================================
  const vendedores6040 = [
    {
      id: V.activo_ok,
      nombre: 'María', apellidos: 'López García',
      email: 'maria.lopez@mail.com', telefono: '+573001000001',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(1), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(60),
    },
    {
      id: V.activo_pwd_temp,
      nombre: 'Juan', apellidos: 'Rodríguez Mejía',
      email: 'juan.rodriguez@mail.com', telefono: '+573001000002',
      requiereCambioPassword: true, estado: 'ACTIVO' as const,
      ultimoLogin: null, intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(2),
    },
    {
      id: V.inactivo,
      nombre: 'Pedro', apellidos: 'Martínez Ríos',
      email: 'pedro.martinez@mail.com', telefono: '+573001000003',
      requiereCambioPassword: false, estado: 'INACTIVO' as const,
      ultimoLogin: daysAgo(30), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: daysAgo(5), fechaCreacion: daysAgo(90),
    },
    {
      id: V.eliminado,
      nombre: 'Ana', apellidos: 'Gómez Pérez',
      email: 'ana.gomez@mail.com', telefono: '+573001000004',
      requiereCambioPassword: false, estado: 'INACTIVO' as const,
      ultimoLogin: daysAgo(45), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: true, fechaEliminacion: daysAgo(10),
      fechaCambioEstado: daysAgo(10), fechaCreacion: daysAgo(120),
    },
    {
      id: V.bloqueado_l1,
      nombre: 'Diego', apellidos: 'Herrera Sánchez',
      email: 'diego.herrera@mail.com', telefono: '+573001000005',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(1), intentosFallidos: 5,
      bloqueadoHasta: new Date(Date.now() + 15 * 60 * 1000), // +15min
      eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(45),
    },
    {
      id: V.bloqueado_l2,
      nombre: 'Sofía', apellidos: 'Vargas Castro',
      email: 'sofia.vargas@mail.com', telefono: '+573001000006',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(2), intentosFallidos: 10,
      bloqueadoHasta: new Date(Date.now() + 60 * 60 * 1000), // +1h
      eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(50),
    },
    {
      id: V.bloqueado_perm,
      nombre: 'Andrés', apellidos: 'Ruiz Ospina',
      email: 'andres.ruiz@mail.com', telefono: '+573001000007',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(3), intentosFallidos: 22,
      bloqueadoHasta: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // bloqueado ~permanente
      eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(55),
    },
    {
      id: V.con_lote_creado,
      nombre: 'Camila', apellidos: 'Torres Muñoz',
      email: 'camila.torres@mail.com', telefono: '+573001000008',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(1), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(30),
    },
    {
      id: V.con_lote_finalizado,
      nombre: 'Luis', apellidos: 'Moreno Castaño',
      email: 'luis.moreno@mail.com', telefono: '+573001000009',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(3), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(180),
    },
    {
      id: V.multi_lotes,
      nombre: 'Valentina', apellidos: 'Díaz Cardona',
      email: 'valentina.diaz@mail.com', telefono: '+573001000010',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(0), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(90),
    },
    {
      id: V.eq_solicitado,
      nombre: 'Santiago', apellidos: 'Restrepo Gil',
      email: 'santiago.restrepo@mail.com', telefono: '+573001000011',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(1), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(20),
    },
    {
      id: V.eq_activo_deposito,
      nombre: 'Isabella', apellidos: 'Gutiérrez Ramos',
      email: 'isabella.gutierrez@mail.com', telefono: '+573001000012',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(2), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(60),
    },
    {
      id: V.eq_activo_sin_dep,
      nombre: 'Sebastián', apellidos: 'Londoño Arias',
      email: 'sebastian.londono@mail.com', telefono: '+573001000013',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(1), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(45),
    },
    {
      id: V.eq_devuelto,
      nombre: 'Daniela', apellidos: 'Ospina Salazar',
      email: 'daniela.ospina@mail.com', telefono: '+573001000014',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(5), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(150),
    },
    {
      id: V.eq_danado,
      nombre: 'Mateo', apellidos: 'Cárdenas Vélez',
      email: 'mateo.cardenas@mail.com', telefono: '+573001000015',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(1), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(80),
    },
    {
      id: V.eq_perdido,
      nombre: 'Luciana', apellidos: 'Ríos Quintero',
      email: 'luciana.rios@mail.com', telefono: '+573001000016',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(2), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(70),
    },
    {
      id: V.sin_lotes,
      nombre: 'Alejandro', apellidos: 'Parra Montoya',
      email: 'alejandro.parra@mail.com', telefono: '+573001000017',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(1), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(5),
    },
    {
      id: V.inactivo_con_lote,
      nombre: 'Gabriela', apellidos: 'Henao Zapata',
      email: 'gabriela.henao@mail.com', telefono: '+573001000018',
      requiereCambioPassword: false, estado: 'INACTIVO' as const,
      ultimoLogin: daysAgo(15), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: daysAgo(3), fechaCreacion: daysAgo(60),
    },
    {
      id: V.con_ventas_pend,
      nombre: 'Nicolás', apellidos: 'Aristizábal Correa',
      email: 'nicolas.aristizabal@mail.com', telefono: '+573001000019',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(0), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(40),
    },
    {
      id: V.con_ventas_rech,
      nombre: 'Mariana', apellidos: 'Bedoya Toro',
      email: 'mariana.bedoya@mail.com', telefono: '+573001000020',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(1), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(35),
    },
    {
      id: V.cuadre_pendiente,
      nombre: 'Emilio', apellidos: 'Castaño Franco',
      email: 'emilio.castano@mail.com', telefono: '+573001000021',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(0), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(75),
    },
    {
      id: V.cuadre_exitoso,
      nombre: 'Catalina', apellidos: 'Agudelo Ramírez',
      email: 'catalina.agudelo@mail.com', telefono: '+573001000022',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(1), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(100),
    },
    {
      id: V.mini_cuadre_pend,
      nombre: 'Felipe', apellidos: 'Duque Mejía',
      email: 'felipe.duque@mail.com', telefono: '+573001000023',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(0), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(50),
    },
    {
      id: V.venta_mayor_pend,
      nombre: 'Juliana', apellidos: 'Ochoa Giraldo',
      email: 'juliana.ochoa@mail.com', telefono: '+573001000024',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(0), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(65),
    },
    {
      id: V.venta_mayor_comp,
      nombre: 'Tomás', apellidos: 'Gaviria Ossa',
      email: 'tomas.gaviria@mail.com', telefono: '+573001000025',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(1), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(80),
    },
    {
      id: V.login_reciente,
      nombre: 'Sara', apellidos: 'Zuluaga Botero',
      email: 'sara.zuluaga@mail.com', telefono: '+573001000026',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: hoursAgo(1), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(15),
    },
    {
      id: V.sin_login,
      nombre: 'Miguel', apellidos: 'Echavarría Uribe',
      email: 'miguel.echavarria@mail.com', telefono: '+573001000027',
      requiereCambioPassword: true, estado: 'ACTIVO' as const,
      ultimoLogin: null, intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(1),
    },
    {
      id: V.cambio_estado_rec,
      nombre: 'Paula', apellidos: 'Arango Soto',
      email: 'paula.arango@mail.com', telefono: '+573001000028',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(2), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: hoursAgo(6), fechaCreacion: daysAgo(40),
    },
    {
      id: V.lote_forzado,
      nombre: 'Ricardo', apellidos: 'Jaramillo Gómez',
      email: 'ricardo.jaramillo@mail.com', telefono: '+573001000029',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(1), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(55),
    },
    {
      id: V.eq_mensualidad_mora,
      nombre: 'Laura', apellidos: 'Salazar Peña',
      email: 'laura.salazar@mail.com', telefono: '+573001000030',
      requiereCambioPassword: false, estado: 'ACTIVO' as const,
      ultimoLogin: daysAgo(1), intentosFallidos: 0,
      bloqueadoHasta: null, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(90),
    },
  ];

  for (const v of vendedores6040) {
    const usePwd = v.requiereCambioPassword ? pwdTemp : pwdNormal;
    await prisma.usuario.upsert({
      where: { id: v.id },
      update: {},
      create: {
        id: v.id,
        cedula: nextCedula(),
        nombre: v.nombre,
        apellidos: v.apellidos,
        email: v.email,
        telefono: v.telefono,
        passwordHash: usePwd,
        requiereCambioPassword: v.requiereCambioPassword,
        rol: 'VENDEDOR',
        estado: v.estado,
        modeloNegocio: 'MODELO_60_40',
        reclutadorId: ADMIN_ID,
        intentosFallidos: v.intentosFallidos,
        bloqueadoHasta: v.bloqueadoHasta,
        ultimoLogin: v.ultimoLogin,
        fechaCambioEstado: v.fechaCambioEstado,
        eliminado: v.eliminado,
        fechaEliminacion: v.fechaEliminacion,
        fechaCreacion: v.fechaCreacion,
      },
    });
  }

  console.log(`    ✓ ${vendedores6040.length} vendedores 60/40 creados`);

  // ========================================
  // 3. RECLUTADORES (vendedores que reclutan)
  // ========================================
  const reclutadores = [
    {
      id: R.activo_con_recl,
      nombre: 'Fernando', apellidos: 'Valencia Mesa',
      email: 'fernando.valencia@mail.com', telefono: '+573002000001',
      estado: 'ACTIVO' as const, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(120),
    },
    {
      id: R.inactivo,
      nombre: 'Claudia', apellidos: 'Posada Rendón',
      email: 'claudia.posada@mail.com', telefono: '+573002000002',
      estado: 'INACTIVO' as const, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: daysAgo(20), fechaCreacion: daysAgo(100),
    },
    {
      id: R.con_cadena,
      nombre: 'Roberto', apellidos: 'Monsalve Álvarez',
      email: 'roberto.monsalve@mail.com', telefono: '+573002000003',
      estado: 'ACTIVO' as const, eliminado: false, fechaEliminacion: null,
      fechaCambioEstado: null, fechaCreacion: daysAgo(150),
    },
    {
      id: R.eliminado,
      nombre: 'Patricia', apellidos: 'Buriticá Lemus',
      email: 'patricia.buritica@mail.com', telefono: '+573002000004',
      estado: 'INACTIVO' as const, eliminado: true, fechaEliminacion: daysAgo(5),
      fechaCambioEstado: daysAgo(5), fechaCreacion: daysAgo(80),
    },
  ];

  for (const r of reclutadores) {
    await prisma.usuario.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        cedula: nextCedula(),
        nombre: r.nombre,
        apellidos: r.apellidos,
        email: r.email,
        telefono: r.telefono,
        passwordHash: pwdNormal,
        requiereCambioPassword: false,
        rol: 'RECLUTADOR',
        estado: r.estado,
        modeloNegocio: 'MODELO_60_40', // reclutadores directos del admin
        reclutadorId: ADMIN_ID,
        intentosFallidos: 0,
        ultimoLogin: daysAgo(2),
        fechaCambioEstado: r.fechaCambioEstado,
        eliminado: r.eliminado,
        fechaEliminacion: r.fechaEliminacion,
        fechaCreacion: r.fechaCreacion,
      },
    });
  }

  console.log(`    ✓ ${reclutadores.length} reclutadores creados`);

  // ========================================
  // 4. VENDEDORES 50/50 (reclutados por reclutadores)
  // ========================================
  const vendedores5050 = [
    {
      id: V50.activo_1, reclutadorId: R.activo_con_recl,
      nombre: 'Esteban', apellidos: 'Ceballos Reyes',
      email: 'esteban.ceballos@mail.com', telefono: '+573003000001',
      estado: 'ACTIVO' as const, eliminado: false, fechaEliminacion: null,
      requiereCambioPassword: false, fechaCreacion: daysAgo(50),
    },
    {
      id: V50.activo_2, reclutadorId: R.activo_con_recl,
      nombre: 'Natalia', apellidos: 'Cano Herrera',
      email: 'natalia.cano@mail.com', telefono: '+573003000002',
      estado: 'ACTIVO' as const, eliminado: false, fechaEliminacion: null,
      requiereCambioPassword: false, fechaCreacion: daysAgo(45),
    },
    {
      id: V50.inactivo, reclutadorId: R.activo_con_recl,
      nombre: 'Óscar', apellidos: 'Bermúdez Largo',
      email: 'oscar.bermudez@mail.com', telefono: '+573003000003',
      estado: 'INACTIVO' as const, eliminado: false, fechaEliminacion: null,
      requiereCambioPassword: false, fechaCreacion: daysAgo(60),
    },
    {
      id: V50.con_lote, reclutadorId: R.con_cadena,
      nombre: 'Adriana', apellidos: 'Correa Luna',
      email: 'adriana.correa@mail.com', telefono: '+573003000004',
      estado: 'ACTIVO' as const, eliminado: false, fechaEliminacion: null,
      requiereCambioPassword: false, fechaCreacion: daysAgo(70),
    },
    {
      // Cadena: Admin → R.con_cadena → V50.con_lote → V50.cadena_nivel2
      id: V50.cadena_nivel2, reclutadorId: V50.con_lote,
      nombre: 'Germán', apellidos: 'Palacio Muñoz',
      email: 'german.palacio@mail.com', telefono: '+573003000005',
      estado: 'ACTIVO' as const, eliminado: false, fechaEliminacion: null,
      requiereCambioPassword: false, fechaCreacion: daysAgo(40),
    },
    {
      id: V50.pwd_temp, reclutadorId: R.activo_con_recl,
      nombre: 'Verónica', apellidos: 'Hincapié Duarte',
      email: 'veronica.hincapie@mail.com', telefono: '+573003000006',
      estado: 'ACTIVO' as const, eliminado: false, fechaEliminacion: null,
      requiereCambioPassword: true, fechaCreacion: daysAgo(3),
    },
    {
      id: V50.eliminado, reclutadorId: R.activo_con_recl,
      nombre: 'Héctor', apellidos: 'Zapata Medina',
      email: 'hector.zapata@mail.com', telefono: '+573003000007',
      estado: 'INACTIVO' as const, eliminado: true, fechaEliminacion: daysAgo(7),
      requiereCambioPassword: false, fechaCreacion: daysAgo(90),
    },
    {
      id: V50.bloqueado, reclutadorId: R.activo_con_recl,
      nombre: 'Clara', apellidos: 'Pedraza Rojas',
      email: 'clara.pedraza@mail.com', telefono: '+573003000008',
      estado: 'ACTIVO' as const, eliminado: false, fechaEliminacion: null,
      requiereCambioPassword: false, fechaCreacion: daysAgo(55),
    },
    {
      id: V50.con_equip, reclutadorId: R.con_cadena,
      nombre: 'Ignacio', apellidos: 'Taborda Caicedo',
      email: 'ignacio.taborda@mail.com', telefono: '+573003000009',
      estado: 'ACTIVO' as const, eliminado: false, fechaEliminacion: null,
      requiereCambioPassword: false, fechaCreacion: daysAgo(50),
    },
    {
      id: V50.con_venta_mayor, reclutadorId: R.con_cadena,
      nombre: 'Lorena', apellidos: 'Marín Gallego',
      email: 'lorena.marin@mail.com', telefono: '+573003000010',
      estado: 'ACTIVO' as const, eliminado: false, fechaEliminacion: null,
      requiereCambioPassword: false, fechaCreacion: daysAgo(65),
    },
  ];

  for (const v of vendedores5050) {
    const usePwd = v.requiereCambioPassword ? pwdTemp : pwdNormal;
    await prisma.usuario.upsert({
      where: { id: v.id },
      update: {},
      create: {
        id: v.id,
        cedula: nextCedula(),
        nombre: v.nombre,
        apellidos: v.apellidos,
        email: v.email,
        telefono: v.telefono,
        passwordHash: usePwd,
        requiereCambioPassword: v.requiereCambioPassword,
        rol: 'VENDEDOR',
        estado: v.estado,
        modeloNegocio: 'MODELO_50_50',
        reclutadorId: v.reclutadorId,
        intentosFallidos: v.id === V50.bloqueado ? 8 : 0,
        bloqueadoHasta: v.id === V50.bloqueado ? new Date(Date.now() + 30 * 60 * 1000) : null,
        ultimoLogin: v.requiereCambioPassword ? null : daysAgo(2),
        eliminado: v.eliminado,
        fechaEliminacion: v.fechaEliminacion,
        fechaCreacion: v.fechaCreacion,
      },
    });
  }

  // V50.con_lote también recluta a V50.cadena_nivel2, así que se convierte en RECLUTADOR
  await prisma.usuario.update({
    where: { id: V50.con_lote },
    data: { rol: 'RECLUTADOR' },
  });

  console.log(`    ✓ ${vendedores5050.length} vendedores 50/50 creados`);

  // ========================================
  // 5. VENDEDORES RELLENO (para llegar a 50+admin)
  // ========================================
  const nombresRelleno = [
    { nombre: 'Carlos', apellidos: 'Montoya Piedrahita', email: 'carlos.montoya2@mail.com', telefono: '+573004000001' },
    { nombre: 'Diana', apellidos: 'Quiroz Acevedo', email: 'diana.quiroz@mail.com', telefono: '+573004000002' },
    { nombre: 'Jorge', apellidos: 'Betancur Hoyos', email: 'jorge.betancur@mail.com', telefono: '+573004000003' },
    { nombre: 'Mónica', apellidos: 'Sepúlveda Chica', email: 'monica.sepulveda@mail.com', telefono: '+573004000004' },
    { nombre: 'Fabián', apellidos: 'Gallego Naranjo', email: 'fabian.gallego@mail.com', telefono: '+573004000005' },
    { nombre: 'Pilar', apellidos: 'Acosta Vélez', email: 'pilar.acosta@mail.com', telefono: '+573004000006' },
  ];

  const vxIds = Object.values(VX);
  for (let i = 0; i < vxIds.length; i++) {
    const datos = nombresRelleno[i];
    await prisma.usuario.upsert({
      where: { id: vxIds[i] },
      update: {},
      create: {
        id: vxIds[i],
        cedula: nextCedula(),
        nombre: datos.nombre,
        apellidos: datos.apellidos,
        email: datos.email,
        telefono: datos.telefono,
        passwordHash: pwdNormal,
        requiereCambioPassword: false,
        rol: 'VENDEDOR',
        estado: 'ACTIVO',
        modeloNegocio: 'MODELO_60_40',
        reclutadorId: ADMIN_ID,
        intentosFallidos: 0,
        ultimoLogin: daysAgo(i + 1),
        fechaCreacion: daysAgo(30 + i * 5),
      },
    });
  }

  console.log(`    ✓ ${vxIds.length} vendedores relleno creados`);

  const total = 1 + vendedores6040.length + reclutadores.length + vendedores5050.length + vxIds.length;
  console.log(`    ✓ TOTAL: ${total} usuarios creados`);
}
