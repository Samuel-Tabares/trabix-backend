/**
 * ============================================================
 * TRABIX Backend - E2E Test Suite Completo
 * ============================================================
 *
 * Cubre TODOS los endpoints de TODOS los módulos:
 *   Auth, Usuarios, Lotes, Tandas, Ventas, Cuadres,
 *   Mini-Cuadres, Ventas Mayor, Cuadres Mayor, Equipamiento,
 *   Fondo Recompensas, Notificaciones, Admin (Stock, Config, Dashboard)
 *
 * Precondición: seed ejecutado (npx prisma db seed)
 *
 * Ejecutar:
 * NODE_ENV=test npx dotenv-cli -e .env.test -- npm run test:e2e -- --testPathPattern=all-scenarios
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service';
import { LoginThrottleGuard } from '../../src/modules/auth/guards/login-throttle.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

// ============================================================
// IDs del seed (mirrors prisma/seeds/helpers.ts)
// ============================================================
const ADMIN_ID = '00000000-0000-4000-a000-000000000001';

const V = {
  activo_ok:           '00000000-0000-4000-a000-000000000100',
  activo_pwd_temp:     '00000000-0000-4000-a000-000000000101',
  inactivo:            '00000000-0000-4000-a000-000000000102',
  eliminado:           '00000000-0000-4000-a000-000000000103',
  bloqueado_l1:        '00000000-0000-4000-a000-000000000104',
  bloqueado_l2:        '00000000-0000-4000-a000-000000000105',
  bloqueado_perm:      '00000000-0000-4000-a000-000000000106',
  con_lote_creado:     '00000000-0000-4000-a000-000000000107',
  con_lote_finalizado: '00000000-0000-4000-a000-000000000108',
  multi_lotes:         '00000000-0000-4000-a000-000000000109',
  eq_solicitado:       '00000000-0000-4000-a000-000000000110',
  eq_activo_deposito:  '00000000-0000-4000-a000-000000000111',
  eq_activo_sin_dep:   '00000000-0000-4000-a000-000000000112',
  eq_devuelto:         '00000000-0000-4000-a000-000000000113',
  eq_danado:           '00000000-0000-4000-a000-000000000114',
  eq_perdido:          '00000000-0000-4000-a000-000000000115',
  sin_lotes:           '00000000-0000-4000-a000-000000000116',
  inactivo_con_lote:   '00000000-0000-4000-a000-000000000117',
  con_ventas_pend:     '00000000-0000-4000-a000-000000000118',
  con_ventas_rech:     '00000000-0000-4000-a000-000000000119',
  cuadre_pendiente:    '00000000-0000-4000-a000-000000000120',
  cuadre_exitoso:      '00000000-0000-4000-a000-000000000121',
  mini_cuadre_pend:    '00000000-0000-4000-a000-000000000122',
  venta_mayor_pend:    '00000000-0000-4000-a000-000000000123',
  venta_mayor_comp:    '00000000-0000-4000-a000-000000000124',
  login_reciente:      '00000000-0000-4000-a000-000000000125',
  sin_login:           '00000000-0000-4000-a000-000000000126',
  cambio_estado_rec:   '00000000-0000-4000-a000-000000000127',
  lote_forzado:        '00000000-0000-4000-a000-000000000128',
  eq_mensualidad_mora: '00000000-0000-4000-a000-000000000129',
};

const R = {
  activo_con_recl: '00000000-0000-4000-a000-000000000200',
  inactivo:        '00000000-0000-4000-a000-000000000201',
  con_cadena:      '00000000-0000-4000-a000-000000000202',
  eliminado:       '00000000-0000-4000-a000-000000000203',
};

const V50 = {
  activo_1:        '00000000-0000-4000-a000-000000000300',
  activo_2:        '00000000-0000-4000-a000-000000000301',
  inactivo:        '00000000-0000-4000-a000-000000000302',
  con_lote:        '00000000-0000-4000-a000-000000000303',
  cadena_nivel2:   '00000000-0000-4000-a000-000000000304',
  pwd_temp:        '00000000-0000-4000-a000-000000000305',
  eliminado:       '00000000-0000-4000-a000-000000000306',
  bloqueado:       '00000000-0000-4000-a000-000000000307',
  con_equip:       '00000000-0000-4000-a000-000000000308',
  con_venta_mayor: '00000000-0000-4000-a000-000000000309',
};

const LOTE = {
  v_activo_lote1:   '00000000-0000-4000-b000-000000000001',
  v_creado:         '00000000-0000-4000-b000-000000000002',
  v_finalizado:     '00000000-0000-4000-b000-000000000003',
  v_multi_1:        '00000000-0000-4000-b000-000000000004',
  v_multi_2:        '00000000-0000-4000-b000-000000000005',
  v_inactivo_lote:  '00000000-0000-4000-b000-000000000006',
  v_cuadre_pend:    '00000000-0000-4000-b000-000000000007',
  v_cuadre_exit:    '00000000-0000-4000-b000-000000000008',
  v_mini_cuadre:    '00000000-0000-4000-b000-000000000009',
  v_vta_pend:       '00000000-0000-4000-b000-000000000010',
  v_vta_rech:       '00000000-0000-4000-b000-000000000011',
  v_vta_mayor_pend: '00000000-0000-4000-b000-000000000012',
  v_vta_mayor_comp: '00000000-0000-4000-b000-000000000013',
  v50_con_lote:     '00000000-0000-4000-b000-000000000014',
  v_lote_forzado:   '00000000-0000-4000-b000-000000000015',
  v50_vta_mayor:    '00000000-0000-4000-b000-000000000016',
};

const TANDA = {
  activo_t1:  '00000000-0000-4000-c000-000000000001',
  activo_t2:  '00000000-0000-4000-c000-000000000002',
  final_t1:   '00000000-0000-4000-c000-000000000003',
  final_t2:   '00000000-0000-4000-c000-000000000004',
  cuadre_t1:  '00000000-0000-4000-c000-000000000005',
  cuadre_t2:  '00000000-0000-4000-c000-000000000006',
  cuadre_t3:  '00000000-0000-4000-c000-000000000007',
  exit_t1:    '00000000-0000-4000-c000-000000000008',
  exit_t2:    '00000000-0000-4000-c000-000000000009',
  mini_t1:    '00000000-0000-4000-c000-000000000010',
  mini_t2:    '00000000-0000-4000-c000-000000000011',
  vpend_t1:   '00000000-0000-4000-c000-000000000012',
  vrech_t1:   '00000000-0000-4000-c000-000000000014',
  multi1_t1:  '00000000-0000-4000-c000-000000000016',
  vmayp_t1:   '00000000-0000-4000-c000-000000000020',
  vmayc_t1:   '00000000-0000-4000-c000-000000000022',
  vmayc_t2:   '00000000-0000-4000-c000-000000000023',
  v50_t1:     '00000000-0000-4000-c000-000000000024',
  forz_t1:    '00000000-0000-4000-c000-000000000026',
  v50vm_t1:   '00000000-0000-4000-c000-000000000028',
};

// ============================================================
// CREDENCIALES
// ============================================================
const ADMIN_CEDULA = 1234567890;
const ADMIN_PASSWORD = 'AdminTrabix2026!';
const VENDEDOR_PASSWORD = 'Trabix2026!';
const TEMP_PASSWORD = 'TempPass123';

// ============================================================
// API PREFIX
// ============================================================
const PREFIX = '/api/v1';

// ============================================================
// TEST SUITE
// ============================================================
describe('TRABIX E2E - All Scenarios', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Tokens almacenados por rol
  let adminAccessToken: string;
  let adminRefreshToken: string;
  let vendedorAccessToken: string;
  //let vendedorRefreshToken: string; se declara mas no se usa
  let reclutadorAccessToken: string;

  // ============================================================
  // SETUP & TEARDOWN
  // ============================================================
  beforeAll(async () => {
    // Guard pass-through para desactivar rate limiting en tests
    const noopGuard = { canActivate: () => true };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Desactivar throttling en tests — no necesario para E2E
      // y LoginThrottleGuard tiene conflicto de DI con ConfigService
      .overrideGuard(ThrottlerGuard)
      .useValue(noopGuard)
      .overrideGuard(LoginThrottleGuard)
      .useValue(noopGuard)
      .compile();

    app = moduleFixture.createNestApplication();

    // Mismo pipe que en main.ts
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);

    // Verificar que hay datos del seed
    const userCount = await prisma.usuario.count();
    if (userCount === 0) {
      throw new Error(
        'No hay datos en la BD. Ejecute primero: npx prisma db seed',
      );
    }
    console.log(`✅ BD con ${userCount} usuarios (seed presente)`);
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  // ============================================================
  // HELPER: hacer request autenticado
  // ============================================================
  const authGet = (url: string, token: string) =>
    request(app.getHttpServer())
      .get(`${PREFIX}${url}`)
      .set('Authorization', `Bearer ${token}`);

  const authPost = (url: string, token: string) =>
    request(app.getHttpServer())
      .post(`${PREFIX}${url}`)
      .set('Authorization', `Bearer ${token}`);

  const authPatch = (url: string, token: string) =>
    request(app.getHttpServer())
      .patch(`${PREFIX}${url}`)
      .set('Authorization', `Bearer ${token}`);

  const authDelete = (url: string, token: string) =>
    request(app.getHttpServer())
      .delete(`${PREFIX}${url}`)
      .set('Authorization', `Bearer ${token}`);

  const publicPost = (url: string) =>
    request(app.getHttpServer()).post(`${PREFIX}${url}`);

  // Helper para obtener cédula por ID de usuario
  const getCedulaById = async (userId: string): Promise<number> => {
    const user = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { cedula: true },
    });
    return user!.cedula;
  };

  // ============================================================
  // 1. AUTH MODULE
  // ============================================================
  describe('Auth Module', () => {
    describe('POST /auth/login', () => {
      it('debería loguear al admin correctamente', async () => {
        const res = await publicPost('/auth/login')
          .send({ cedula: ADMIN_CEDULA, password: ADMIN_PASSWORD })
          .expect(200);

        expect(res.body).toHaveProperty('accessToken');
        expect(res.body).toHaveProperty('refreshToken');
        expect(res.body.tokenType).toBe('Bearer');
        expect(res.body.user.rol).toBe('ADMIN');
        expect(res.body.user.requiereCambioPassword).toBe(false);

        adminAccessToken = res.body.accessToken;
        adminRefreshToken = res.body.refreshToken;
      });

      it('debería loguear a un vendedor activo (V.activo_ok)', async () => {
        const cedula = await getCedulaById(V.activo_ok);
        const res = await publicPost('/auth/login')
          .send({ cedula, password: VENDEDOR_PASSWORD })
          .expect(200);

        expect(res.body.user.rol).toBe('VENDEDOR');
        expect(res.body.user.requiereCambioPassword).toBe(false);

        vendedorAccessToken = res.body.accessToken;
      });

      it('debería loguear a un reclutador activo (R.activo_con_recl)', async () => {
        const cedula = await getCedulaById(R.activo_con_recl);
        const res = await publicPost('/auth/login')
          .send({ cedula, password: VENDEDOR_PASSWORD })
          .expect(200);

        expect(res.body.user.rol).toBe('RECLUTADOR');
        reclutadorAccessToken = res.body.accessToken;
      });

      it('debería indicar requiereCambioPassword para vendedor con pwd temporal', async () => {
        const cedula = await getCedulaById(V.activo_pwd_temp);
        const res = await publicPost('/auth/login')
          .send({ cedula, password: TEMP_PASSWORD })
          .expect(200);

        expect(res.body.user.requiereCambioPassword).toBe(true);
      });

      it('debería rechazar credenciales inválidas', async () => {
        await publicPost('/auth/login')
          .send({ cedula: ADMIN_CEDULA, password: 'wrongpassword1!' })
          .expect(401);
      });

      it('debería rechazar usuario inactivo', async () => {
        const cedula = await getCedulaById(V.inactivo);
        await publicPost('/auth/login')
          .send({ cedula, password: VENDEDOR_PASSWORD })
          .expect(403);
      });

      it('debería rechazar login sin datos', async () => {
        await publicPost('/auth/login')
          .send({})
          .expect(400);
      });
    });

    describe('POST /auth/refresh', () => {
      it('debería renovar tokens con refresh token válido', async () => {
        const res = await publicPost('/auth/refresh')
          .send({ refreshToken: adminRefreshToken })
          .expect(200);

        expect(res.body).toHaveProperty('accessToken');
        expect(res.body).toHaveProperty('refreshToken');

        // Actualizar tokens
        adminAccessToken = res.body.accessToken;
        adminRefreshToken = res.body.refreshToken;
      });

      it('debería rechazar refresh token inválido', async () => {
        await publicPost('/auth/refresh')
          .send({ refreshToken: 'invalid-token' })
          .expect(401);
      });
    });

    describe('POST /auth/cambiar-password', () => {
      it('debería cambiar la contraseña del vendedor con pwd temporal', async () => {
        // Loguear con pwd temporal
        const cedula = await getCedulaById(V.sin_login);
        const loginRes = await publicPost('/auth/login')
          .send({ cedula, password: TEMP_PASSWORD })
          .expect(200);

        const token = loginRes.body.accessToken;

        await authPost('/auth/cambiar-password', token)
          .send({
            currentPassword: TEMP_PASSWORD,
            newPassword: 'NuevaPass123!',
          })
          .expect(200);
      });

      it('debería rechazar si contraseña actual es incorrecta', async () => {
        await authPost('/auth/cambiar-password', vendedorAccessToken)
          .send({
            currentPassword: 'incorrecta1!A',
            newPassword: 'NuevaPass123!',
          })
          .expect(400);
      });
    });

    describe('POST /auth/admin/reset-password/:usuarioId', () => {
      it('debería resetear la contraseña de un vendedor (admin)', async () => {
        const res = await authPost(
          `/auth/admin/reset-password/${V.activo_pwd_temp}`,
          adminAccessToken,
        ).expect(200);

        expect(res.body).toHaveProperty('passwordTemporal');
        expect(res.body.usuarioId).toBe(V.activo_pwd_temp);
      });

      it('debería rechazar si no es admin', async () => {
        await authPost(
          `/auth/admin/reset-password/${V.activo_ok}`,
          vendedorAccessToken,
        ).expect(403);
      });
    });

    describe('POST /auth/admin/desbloquear/:usuarioId', () => {
      it('debería desbloquear un usuario bloqueado (admin)', async () => {
        await authPost(
          `/auth/admin/desbloquear/${V.bloqueado_l1}`,
          adminAccessToken,
        ).expect(200);
      });
    });

    describe('POST /auth/logout', () => {
      it('debería cerrar sesión correctamente', async () => {
        // Crear una sesión desechable
        const cedula = await getCedulaById(V.login_reciente);
        const loginRes = await publicPost('/auth/login')
          .send({ cedula, password: VENDEDOR_PASSWORD })
          .expect(200);

        await publicPost('/auth/logout')
          .send({
            refreshToken: loginRes.body.refreshToken,
            accessToken: loginRes.body.accessToken,
          })
          .expect(200);
      });
    });
  });

  // ============================================================
  // 2. USUARIOS MODULE
  // ============================================================
  describe('Usuarios Module', () => {
    let nuevoUsuarioId: string;

    describe('POST /usuarios (crear vendedor)', () => {
      it('debería crear un vendedor nuevo (admin)', async () => {
        const res = await authPost('/usuarios', adminAccessToken)
          .send({
            cedula: 1445526602,
            nombre: 'Test',
            apellidos: 'E2E Usuario',
            email: 'test.e2e.user@mail.com',
            telefono: '+573009999001',
          })
          .expect(201);

        expect(res.body).toHaveProperty('usuario');
        expect(res.body).toHaveProperty('passwordTemporal');
        expect(res.body.usuario.rol).toBe('VENDEDOR');
        nuevoUsuarioId = res.body.usuario.id;
      });

      it('debería rechazar cédula duplicada', async () => {
        await authPost('/usuarios', adminAccessToken)
          .send({
            cedula: ADMIN_CEDULA,
            nombre: 'Dup',
            apellidos: 'Cedula',
            email: 'dup.cedula@mail.com',
            telefono: '+573009999002',
          })
          .expect(409);
      });

      it('debería crear vendedor con reclutador (promueve a RECLUTADOR)', async () => {
        const res = await authPost('/usuarios', adminAccessToken)
          .send({
            cedula: 1445526602,
            nombre: 'Reclutado',
            apellidos: 'PorActivo',
            email: 'reclutado.test@mail.com',
            telefono: '+573009999003',
            reclutadorId: V.activo_ok,
          })
          .expect(201);

        expect(res.body.usuario.reclutadorId).toBe(V.activo_ok);
      });

      it('debería rechazar si no es admin', async () => {
        await authPost('/usuarios', vendedorAccessToken)
          .send({
            cedula: 1445526699,
            nombre: 'No',
            apellidos: 'Permitido',
            email: 'no.permitido@mail.com',
            telefono: '+573009999099',
          })
          .expect(403);
      });
    });

    describe('GET /usuarios', () => {
      it('debería listar usuarios (admin)', async () => {
        const res = await authGet('/usuarios', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('total');
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.total).toBeGreaterThan(0);
      });

      it('debería filtrar por rol VENDEDOR', async () => {
        const res = await authGet('/usuarios?rol=VENDEDOR', adminAccessToken).expect(200);

        res.body.data.forEach((u: any) => {
          expect(u.rol).toBe('VENDEDOR');
        });
      });

      it('debería filtrar por estado ACTIVO', async () => {
        const res = await authGet('/usuarios?estado=ACTIVO', adminAccessToken).expect(200);

        res.body.data.forEach((u: any) => {
          expect(u.estado).toBe('ACTIVO');
        });
      });

      it('debería paginar correctamente', async () => {
        const res = await authGet('/usuarios?skip=0&take=5', adminAccessToken).expect(200);

        expect(res.body.data.length).toBeLessThanOrEqual(5);
      });

      it('debería rechazar si no es admin', async () => {
        await authGet('/usuarios', vendedorAccessToken).expect(403);
      });
    });

    describe('GET /usuarios/eliminados', () => {
      it('debería listar usuarios eliminados (admin)', async () => {
        const res = await authGet('/usuarios/eliminados', adminAccessToken).expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
      });
    });

    describe('GET /usuarios/me', () => {
      it('debería obtener perfil del admin', async () => {
        const res = await authGet('/usuarios/me', adminAccessToken).expect(200);

        expect(res.body.id).toBe(ADMIN_ID);
        expect(res.body.rol).toBe('ADMIN');
      });

      it('debería obtener perfil del vendedor', async () => {
        const res = await authGet('/usuarios/me', vendedorAccessToken).expect(200);

        expect(res.body.id).toBe(V.activo_ok);
        expect(res.body.rol).toBe('VENDEDOR');
      });
    });

    describe('GET /usuarios/me/jerarquia', () => {
      it('debería obtener jerarquía del reclutador', async () => {
        const res = await authGet('/usuarios/me/jerarquia', reclutadorAccessToken).expect(200);

        expect(res.body).toHaveProperty('usuario');
        expect(res.body).toHaveProperty('reclutados');
        expect(Array.isArray(res.body.reclutados)).toBe(true);
      });

      it('debería rechazar para vendedores (no reclutadores)', async () => {
        await authGet('/usuarios/me/jerarquia', vendedorAccessToken).expect(403);
      });
    });

    describe('GET /usuarios/:id', () => {
      it('debería obtener un vendedor por ID (admin)', async () => {
        const res = await authGet(`/usuarios/${V.activo_ok}`, adminAccessToken).expect(200);

        expect(res.body.id).toBe(V.activo_ok);
        expect(res.body).toHaveProperty('nombre');
        expect(res.body).toHaveProperty('apellidos');
        expect(res.body).toHaveProperty('email');
      });

      it('debería retornar 404 para ID inexistente', async () => {
        await authGet(
          '/usuarios/00000000-0000-4000-a000-000000000999',
          adminAccessToken,
        ).expect(404);
      });
    });

    describe('PATCH /usuarios/:id', () => {
      it('debería actualizar nombre de vendedor (admin)', async () => {
        const res = await authPatch(`/usuarios/${V.activo_ok}`, adminAccessToken)
          .send({ nombre: 'María Actualizada' })
          .expect(200);

        expect(res.body.nombre).toBe('María Actualizada');
      });
    });

    describe('PATCH /usuarios/:id/estado', () => {
      it('debería cambiar estado a INACTIVO (admin)', async () => {
        const res = await authPatch(
          `/usuarios/${V.cambio_estado_rec}/estado`,
          adminAccessToken,
        )
          .send({ estado: 'INACTIVO' })
          .expect(200);

        expect(res.body.estado).toBe('INACTIVO');
      });

      it('debería cambiar estado a ACTIVO (admin)', async () => {
        const res = await authPatch(
          `/usuarios/${V.cambio_estado_rec}/estado`,
          adminAccessToken,
        )
          .send({ estado: 'ACTIVO' })
          .expect(200);

        expect(res.body.estado).toBe('ACTIVO');
      });
    });

    describe('DELETE /usuarios/:id (soft delete)', () => {
      it('debería eliminar usuario creado en test (admin)', async () => {
        if (!nuevoUsuarioId) return;

        await authDelete(`/usuarios/${nuevoUsuarioId}`, adminAccessToken).expect(200);

        // Verificar que aparece en eliminados
        const user = await prisma.usuario.findUnique({
          where: { id: nuevoUsuarioId },
        });
        expect(user?.eliminado).toBe(true);
      });
    });

    describe('POST /usuarios/:id/restaurar', () => {
      it('debería restaurar usuario eliminado (admin)', async () => {
        if (!nuevoUsuarioId) return;

        const res = await authPost(
          `/usuarios/${nuevoUsuarioId}/restaurar`,
          adminAccessToken,
        ).expect(200);

        expect(res.body.estado).toBe('INACTIVO');
      });
    });

    describe('GET /usuarios/:id/jerarquia', () => {
      it('debería obtener jerarquía de un reclutador (admin)', async () => {
        const res = await authGet(
          `/usuarios/${R.con_cadena}/jerarquia`,
          adminAccessToken,
        ).expect(200);

        expect(res.body).toHaveProperty('reclutados');
        expect(res.body.totalReclutados).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================
  // 3. LOTES MODULE
  // ============================================================
  describe('Lotes Module', () => {
    let loteCreado: string;

    describe('POST /lotes (admin crea lote)', () => {
      it('debería crear un lote para un vendedor (admin)', async () => {
        const res = await authPost('/lotes', adminAccessToken)
          .send({
            vendedorId: V.sin_lotes,
            cantidadTrabix: 20,
          })
          .expect(201);

        expect(res.body.vendedorId).toBe(V.sin_lotes);
        expect(res.body.estado).toBe('CREADO');
        expect(res.body.cantidadTrabix).toBe(20);
        expect(res.body.tandas).toHaveLength(2); // ≤50 = 2 tandas
        loteCreado = res.body.id;
      });

      it('debería rechazar si no es admin', async () => {
        await authPost('/lotes', vendedorAccessToken)
          .send({ vendedorId: V.activo_ok, cantidadTrabix: 20 })
          .expect(403);
      });
    });

    describe('POST /lotes/solicitar', () => {
      it('debería solicitar lote como vendedor', async () => {
        // Loguear con vendedor que no tiene lotes
        const cedula = await getCedulaById(V.login_reciente);
        const loginRes = await publicPost('/auth/login')
          .send({ cedula, password: VENDEDOR_PASSWORD })
          .expect(200);

        const res = await authPost('/lotes/solicitar', loginRes.body.accessToken)
          .send({ cantidadTrabix: 20 })
          .expect(201);

        expect(res.body.estado).toBe('CREADO');
      });

      it('debería rechazar para admin', async () => {
        await authPost('/lotes/solicitar', adminAccessToken)
          .send({ cantidadTrabix: 20 })
          .expect(403);
      });
    });

    describe('GET /lotes/info-solicitud', () => {
      it('debería retornar info de solicitud para vendedor', async () => {
        const res = await authGet('/lotes/info-solicitud', vendedorAccessToken).expect(200);

        expect(res.body).toHaveProperty('cantidadMinima');
        expect(res.body).toHaveProperty('costoPorTrabix');
        expect(res.body).toHaveProperty('puedeSolicitar');
      });
    });

    describe('GET /lotes', () => {
      it('debería listar todos los lotes (admin)', async () => {
        const res = await authGet('/lotes', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body.total).toBeGreaterThan(0);
      });

      it('debería filtrar por estado ACTIVO', async () => {
        const res = await authGet('/lotes?estado=ACTIVO', adminAccessToken).expect(200);

        res.body.data.forEach((l: any) => {
          expect(l.estado).toBe('ACTIVO');
        });
      });
    });

    describe('GET /lotes/mis-lotes', () => {
      it('debería listar lotes del vendedor autenticado', async () => {
        const res = await authGet('/lotes/mis-lotes', vendedorAccessToken).expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
        res.body.data.forEach((l: any) => {
          expect(l.vendedorId).toBe(V.activo_ok);
        });
      });
    });

    describe('GET /lotes/:id', () => {
      it('debería obtener un lote activo (admin)', async () => {
        const res = await authGet(`/lotes/${LOTE.v_activo_lote1}`, adminAccessToken).expect(200);

        expect(res.body.id).toBe(LOTE.v_activo_lote1);
        expect(res.body.estado).toBe('ACTIVO');
        expect(res.body.tandas.length).toBeGreaterThan(0);
      });

      it('vendedor puede ver su propio lote', async () => {
        const res = await authGet(`/lotes/${LOTE.v_activo_lote1}`, vendedorAccessToken).expect(200);

        expect(res.body.vendedorId).toBe(V.activo_ok);
      });

      it('vendedor NO puede ver lote de otro', async () => {
        await authGet(`/lotes/${LOTE.v_finalizado}`, vendedorAccessToken).expect(403);
      });
    });

    describe('POST /lotes/:id/activar', () => {
      it('debería activar un lote en CREADO (admin)', async () => {
        if (!loteCreado) return;

        const res = await authPost(`/lotes/${loteCreado}/activar`, adminAccessToken).expect(200);

        expect(res.body.estado).toBe('ACTIVO');
        expect(res.body.fechaActivacion).not.toBeNull();
        // Primera tanda debería estar LIBERADA
        const primeraTanda = res.body.tandas.find((t: any) => t.numero === 1);
        expect(['LIBERADA', 'EN_TRANSITO']).toContain(primeraTanda.estado);
      });

      it('debería rechazar activar un lote ya activo', async () => {
        await authPost(`/lotes/${LOTE.v_activo_lote1}/activar`, adminAccessToken).expect(409);
      });
    });

    describe('POST /lotes/:id/cancelar', () => {
      it('debería cancelar un lote en CREADO', async () => {
        const res = await authPost(`/lotes/${LOTE.v_creado}/cancelar`, adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('message');
      });

      it('debería rechazar cancelar un lote ACTIVO', async () => {
        await authPost(`/lotes/${LOTE.v_activo_lote1}/cancelar`, adminAccessToken).expect(409);
      });
    });

    describe('GET /lotes/:id/resumen-financiero', () => {
      it('debería obtener resumen financiero de lote activo', async () => {
        const res = await authGet(
          `/lotes/${LOTE.v_activo_lote1}/resumen-financiero`,
          adminAccessToken,
        ).expect(200);

        expect(res.body).toHaveProperty('inversionTotal');
        expect(res.body).toHaveProperty('dineroRecaudado');
        expect(res.body).toHaveProperty('gananciaTotal');
        expect(res.body).toHaveProperty('porcentajeRecaudo');
      });

      it('debería obtener resumen de lote finalizado', async () => {
        const res = await authGet(
          `/lotes/${LOTE.v_finalizado}/resumen-financiero`,
          adminAccessToken,
        ).expect(200);

        expect(res.body.inversionRecuperada).toBe(true);
      });
    });
  });

  // ============================================================
  // 4. TANDAS MODULE
  // ============================================================
  describe('Tandas Module', () => {
    describe('GET /tandas/lote/:loteId', () => {
      it('debería listar tandas de un lote (admin)', async () => {
        const res = await authGet(
          `/tandas/lote/${LOTE.v_activo_lote1}`,
          adminAccessToken,
        ).expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(2);
        res.body.forEach((t: any) => {
          expect(t).toHaveProperty('stockInicial');
          expect(t).toHaveProperty('stockActual');
          expect(t).toHaveProperty('estado');
        });
      });
    });

    describe('GET /tandas/:id', () => {
      it('debería obtener una tanda por ID', async () => {
        const res = await authGet(`/tandas/${TANDA.activo_t1}`, adminAccessToken).expect(200);

        expect(res.body.id).toBe(TANDA.activo_t1);
        expect(res.body.estado).toBe('EN_CASA');
      });
    });

    describe('POST /tandas/:id/confirmar-entrega', () => {
      it('debería confirmar entrega de tanda EN_TRANSITO', async () => {
        const res = await authPost(
          `/tandas/${TANDA.vmayc_t2}/confirmar-entrega`,
          adminAccessToken,
        ).expect(200);

        expect(res.body.estado).toBe('EN_CASA');
        expect(res.body.fechaEnCasa).not.toBeNull();
      });

      it('debería rechazar si tanda no está EN_TRANSITO', async () => {
        await authPost(
          `/tandas/${TANDA.activo_t1}/confirmar-entrega`,
          adminAccessToken,
        ).expect(409);
      });
    });
  });

  // ============================================================
  // 5. VENTAS MODULE
  // ============================================================
  describe('Ventas Module', () => {
    let ventaCreada: string;

    describe('POST /ventas (registrar venta)', () => {
      it('debería registrar una venta como vendedor', async () => {
        const res = await authPost('/ventas', vendedorAccessToken)
          .send({
            detalles: [
              { tipo: 'UNIDAD', cantidad: 1 },
            ],
          })
          .expect(201);

        expect(res.body.estado).toBe('PENDIENTE');
        expect(res.body.vendedorId).toBe(V.activo_ok);
        expect(res.body.detalles.length).toBeGreaterThan(0);
        ventaCreada = res.body.id;
      });

      it('debería rechazar venta sin detalles', async () => {
        await authPost('/ventas', vendedorAccessToken)
          .send({ detalles: [] })
          .expect(400);
      });

      it('debería rechazar para admin', async () => {
        await authPost('/ventas', adminAccessToken)
          .send({ detalles: [{ tipo: 'UNIDAD', cantidad: 1 }] })
          .expect(403);
      });
    });

    describe('GET /ventas', () => {
      it('debería listar ventas del vendedor autenticado', async () => {
        const res = await authGet('/ventas', vendedorAccessToken).expect(200);

        expect(res.body).toHaveProperty('data');
        res.body.data.forEach((v: any) => {
          expect(v.vendedorId).toBe(V.activo_ok);
        });
      });

      it('admin debería ver todas las ventas', async () => {
        const res = await authGet('/ventas', adminAccessToken).expect(200);

        expect(res.body.total).toBeGreaterThan(0);
      });

      it('debería filtrar por estado PENDIENTE', async () => {
        const res = await authGet('/ventas?estado=PENDIENTE', adminAccessToken).expect(200);

        res.body.data.forEach((v: any) => {
          expect(v.estado).toBe('PENDIENTE');
        });
      });
    });

    describe('GET /ventas/:id', () => {
      it('debería obtener una venta por ID', async () => {
        if (!ventaCreada) return;

        const res = await authGet(`/ventas/${ventaCreada}`, vendedorAccessToken).expect(200);

        expect(res.body.id).toBe(ventaCreada);
        expect(res.body).toHaveProperty('detalles');
      });
    });

    describe('POST /ventas/:id/aprobar', () => {
      it('debería aprobar una venta pendiente (admin)', async () => {
        if (!ventaCreada) return;

        const res = await authPost(
          `/ventas/${ventaCreada}/aprobar`,
          adminAccessToken,
        ).expect(200);

        expect(res.body.estado).toBe('APROBADA');
        expect(res.body.fechaValidacion).not.toBeNull();
      });
    });

    describe('POST /ventas/:id/rechazar', () => {
      it('debería rechazar una venta pendiente (admin)', async () => {
        // Buscar venta pendiente del seed
        const ventaPendiente = await prisma.venta.findFirst({
          where: { estado: 'PENDIENTE' },
        });

        if (!ventaPendiente) return;

        const res = await authPost(
          `/ventas/${ventaPendiente.id}/rechazar`,
          adminAccessToken,
        ).expect(200);

        expect(res.body).toHaveProperty('message');
      });
    });
  });

  // ============================================================
  // 6. CUADRES MODULE
  // ============================================================
  describe('Cuadres Module', () => {
    describe('GET /cuadres', () => {
      it('admin debería ver todos los cuadres', async () => {
        const res = await authGet('/cuadres', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body.total).toBeGreaterThan(0);
      });

      it('debería filtrar por estado PENDIENTE', async () => {
        const res = await authGet('/cuadres?estado=PENDIENTE', adminAccessToken).expect(200);

        res.body.data.forEach((c: any) => {
          expect(c.estado).toBe('PENDIENTE');
        });
      });

      it('vendedor NO debería ver cuadres INACTIVO', async () => {
        const res = await authGet('/cuadres', vendedorAccessToken).expect(200);

        res.body.data.forEach((c: any) => {
          expect(c.estado).not.toBe('INACTIVO');
        });
      });
    });

    describe('GET /cuadres/:id', () => {
      it('debería obtener un cuadre por ID (admin)', async () => {
        const cuadre = await prisma.cuadre.findFirst({
          where: { estado: 'PENDIENTE' },
        });

        if (!cuadre) return;

        const res = await authGet(`/cuadres/${cuadre.id}`, adminAccessToken).expect(200);

        expect(res.body.id).toBe(cuadre.id);
        expect(res.body).toHaveProperty('montoEsperado');
        expect(res.body).toHaveProperty('tanda');
      });
    });

    describe('POST /cuadres/:id/confirmar', () => {
      it('debería confirmar un cuadre pendiente (admin)', async () => {
        const cuadre = await prisma.cuadre.findFirst({
          where: { estado: 'PENDIENTE' },
        });

        if (!cuadre) return;

        const montoEsperado = Number(cuadre.montoEsperado) - Number(cuadre.montoCubiertoPorMayor);

        const res = await authPost(`/cuadres/${cuadre.id}/confirmar`, adminAccessToken)
          .send({ montoRecibido: montoEsperado })
          .expect(200);

        expect(res.body.estado).toBe('EXITOSO');
      });

      it('debería rechazar si no es admin', async () => {
        const cuadre = await prisma.cuadre.findFirst({
          where: { estado: 'PENDIENTE' },
        });

        if (!cuadre) return;

        await authPost(`/cuadres/${cuadre.id}/confirmar`, vendedorAccessToken)
          .send({ montoRecibido: 10000 })
          .expect(403);
      });
    });
  });

  // ============================================================
  // 7. MINI-CUADRES MODULE
  // ============================================================
  describe('Mini-Cuadres Module', () => {
    describe('GET /mini-cuadres/lote/:loteId', () => {
      it('debería obtener mini-cuadre de un lote (admin)', async () => {
        const res = await authGet(
          `/mini-cuadres/lote/${LOTE.v_mini_cuadre}`,
          adminAccessToken,
        ).expect(200);

        expect(res.body.loteId).toBe(LOTE.v_mini_cuadre);
        expect(res.body.estado).toBe('PENDIENTE');
      });
    });

    describe('GET /mini-cuadres/:id', () => {
      it('debería obtener mini-cuadre por ID', async () => {
        const mc = await prisma.miniCuadre.findFirst({
          where: { estado: 'PENDIENTE' },
        });

        if (!mc) return;

        const res = await authGet(`/mini-cuadres/${mc.id}`, adminAccessToken).expect(200);

        expect(res.body.id).toBe(mc.id);
      });
    });

    describe('POST /mini-cuadres/:id/confirmar', () => {
      it('debería confirmar mini-cuadre pendiente (admin)', async () => {
        const mc = await prisma.miniCuadre.findFirst({
          where: { estado: 'PENDIENTE' },
        });

        if (!mc) return;

        const res = await authPost(
          `/mini-cuadres/${mc.id}/confirmar`,
          adminAccessToken,
        ).expect(200);

        expect(res.body.estado).toBe('EXITOSO');
      });
    });
  });

  // ============================================================
  // 8. VENTAS MAYOR MODULE
  // ============================================================
  describe('Ventas Mayor Module', () => {
    describe('GET /ventas-mayor', () => {
      it('debería listar ventas al mayor (admin)', async () => {
        const res = await authGet('/ventas-mayor', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body.total).toBeGreaterThan(0);
      });

      it('debería filtrar por estado PENDIENTE', async () => {
        const res = await authGet(
          '/ventas-mayor?estado=PENDIENTE',
          adminAccessToken,
        ).expect(200);

        res.body.data.forEach((v: any) => {
          expect(v.estado).toBe('PENDIENTE');
        });
      });
    });

    describe('GET /ventas-mayor/calcular-stock', () => {
      it('debería calcular stock disponible (admin)', async () => {
        const res = await authGet('/ventas-mayor/calcular-stock', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('stockReservado');
        expect(res.body).toHaveProperty('stockEnCasa');
        expect(res.body).toHaveProperty('stockTotal');
      });
    });

    describe('GET /ventas-mayor/:id', () => {
      it('debería obtener una venta al mayor por ID', async () => {
        const vm = await prisma.ventaMayor.findFirst();

        if (!vm) return;

        const res = await authGet(`/ventas-mayor/${vm.id}`, adminAccessToken).expect(200);

        expect(res.body.id).toBe(vm.id);
        expect(res.body).toHaveProperty('fuentesStock');
      });
    });

    describe('POST /ventas-mayor/:id/completar', () => {
      it('debería completar venta mayor pendiente (admin)', async () => {
        const vm = await prisma.ventaMayor.findFirst({
          where: { estado: 'PENDIENTE' },
        });

        if (!vm) return;

        const res = await authPost(
          `/ventas-mayor/${vm.id}/completar`,
          adminAccessToken,
        ).expect(200);

        expect(res.body.estado).toBe('COMPLETADA');
      });
    });
  });

  // ============================================================
  // 9. CUADRES MAYOR MODULE
  // ============================================================
  describe('Cuadres Mayor Module', () => {
    describe('GET /cuadres-mayor', () => {
      it('debería listar cuadres al mayor (admin)', async () => {
        const res = await authGet('/cuadres-mayor', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body.total).toBeGreaterThanOrEqual(0);
      });
    });

    describe('GET /cuadres-mayor/:id', () => {
      it('debería obtener un cuadre mayor por ID', async () => {
        const cm = await prisma.cuadreMayor.findFirst();

        if (!cm) return;

        const res = await authGet(`/cuadres-mayor/${cm.id}`, adminAccessToken).expect(200);

        expect(res.body.id).toBe(cm.id);
        expect(res.body).toHaveProperty('evaluacionFinanciera');
        expect(res.body).toHaveProperty('gananciasReclutadores');
      });
    });
  });

  // ============================================================
  // 10. EQUIPAMIENTO MODULE
  // ============================================================
  describe('Equipamiento Module', () => {
    describe('GET /equipamiento (admin listar)', () => {
      it('debería listar todos los equipamientos (admin)', async () => {
        const res = await authGet('/equipamiento', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body.total).toBeGreaterThan(0);
      });

      it('debería filtrar por estado ACTIVO', async () => {
        const res = await authGet('/equipamiento?estado=ACTIVO', adminAccessToken).expect(200);

        res.body.data.forEach((e: any) => {
          expect(e.estado).toBe('ACTIVO');
        });
      });
    });

    describe('GET /equipamiento/me', () => {
      it('debería obtener equipamiento del vendedor autenticado', async () => {
        // Loguear como vendedor con equipamiento
        const cedula = await getCedulaById(V.eq_activo_deposito);
        const loginRes = await publicPost('/auth/login')
          .send({ cedula, password: VENDEDOR_PASSWORD })
          .expect(200);

        const res = await authGet('/equipamiento/me', loginRes.body.accessToken).expect(200);

        expect(res.body.vendedorId).toBe(V.eq_activo_deposito);
        expect(res.body.estado).toBe('ACTIVO');
        expect(res.body).toHaveProperty('mensualidadAlDia');
        expect(res.body).toHaveProperty('deudaTotal');
      });

      it('debería retornar 404 si vendedor no tiene equipamiento', async () => {
        await authGet('/equipamiento/me', vendedorAccessToken).expect(404);
      });
    });

    describe('GET /equipamiento/:id', () => {
      it('debería obtener detalle de equipamiento (admin)', async () => {
        const eq = await prisma.equipamiento.findFirst({
          where: { estado: 'ACTIVO' },
        });

        if (!eq) return;

        const res = await authGet(`/equipamiento/${eq.id}`, adminAccessToken).expect(200);

        expect(res.body.id).toBe(eq.id);
        expect(res.body).toHaveProperty('mensualidadActual');
        expect(res.body).toHaveProperty('diasMoraMensualidad');
      });
    });

    describe('POST /equipamiento/solicitar', () => {
      it('debería solicitar equipamiento como vendedor', async () => {
        // Loguear como vendedor sin equipamiento (V50.activo_1)
        const cedula = await getCedulaById(V50.activo_1);
        const loginRes = await publicPost('/auth/login')
          .send({ cedula, password: VENDEDOR_PASSWORD })
          .expect(200);

        const res = await authPost('/equipamiento/solicitar', loginRes.body.accessToken)
          .send({ tieneDeposito: true })
          .expect(201);

        expect(res.body.estado).toBe('SOLICITADO');
        expect(res.body.tieneDeposito).toBe(true);
      });
    });

    describe('POST /equipamiento/:id/activar', () => {
      it('debería activar equipamiento SOLICITADO (admin)', async () => {
        const eq = await prisma.equipamiento.findFirst({
          where: { estado: 'SOLICITADO' },
        });

        if (!eq) return;

        const res = await authPost(
          `/equipamiento/${eq.id}/activar`,
          adminAccessToken,
        ).expect(200);

        expect(res.body.estado).toBe('ACTIVO');
        expect(res.body.fechaEntrega).not.toBeNull();
      });
    });

    describe('POST /equipamiento/:id/pagar-mensualidad', () => {
      it('debería registrar pago de mensualidad (admin)', async () => {
        const eq = await prisma.equipamiento.findFirst({
          where: { estado: 'ACTIVO', vendedorId: V.eq_mensualidad_mora },
        });

        if (!eq) return;

        const res = await authPost(
          `/equipamiento/${eq.id}/pagar-mensualidad`,
          adminAccessToken,
        ).expect(200);

        expect(res.body).toHaveProperty('mensualidadAlDia');
      });
    });
  });

  // ============================================================
  // 11. FONDO RECOMPENSAS MODULE
  // ============================================================
  describe('Fondo Recompensas Module', () => {
    describe('GET /fondo-recompensas/saldo', () => {
      it('debería obtener saldo del fondo', async () => {
        const res = await authGet('/fondo-recompensas/saldo', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('saldo');
        expect(typeof res.body.saldo).toBe('number');
      });

      it('vendedor puede ver saldo del fondo', async () => {
        const res = await authGet('/fondo-recompensas/saldo', vendedorAccessToken).expect(200);

        expect(res.body).toHaveProperty('saldo');
      });
    });

    describe('GET /fondo-recompensas/transacciones', () => {
      it('debería listar transacciones del fondo', async () => {
        const res = await authGet(
          '/fondo-recompensas/transacciones',
          adminAccessToken,
        ).expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body.total).toBeGreaterThan(0);
      });

      it('debería filtrar por tipo ENTRADA', async () => {
        const res = await authGet(
          '/fondo-recompensas/transacciones?tipo=ENTRADA',
          adminAccessToken,
        ).expect(200);

        res.body.data.forEach((t: any) => {
          expect(t.tipo).toBe('ENTRADA');
        });
      });
    });

    describe('POST /fondo-recompensas/salida', () => {
      it('debería registrar salida del fondo (admin)', async () => {
        const res = await authPost('/fondo-recompensas/salida', adminAccessToken)
          .send({
            monto: 1000,
            concepto: 'Premio test E2E',
            vendedorBeneficiarioId: V.activo_ok,
          })
          .expect(201);

        expect(res.body.tipo).toBe('SALIDA');
        expect(res.body.monto).toBe(1000);
        expect(res.body.vendedorBeneficiarioId).toBe(V.activo_ok);
      });

      it('debería rechazar si no es admin', async () => {
        await authPost('/fondo-recompensas/salida', vendedorAccessToken)
          .send({
            monto: 1000,
            concepto: 'Intento ilegal',
            vendedorBeneficiarioId: V.activo_ok,
          })
          .expect(403);
      });
    });
  });

  // ============================================================
  // 12. NOTIFICACIONES MODULE
  // ============================================================
  describe('Notificaciones Module', () => {
    describe('GET /notificaciones', () => {
      it('debería listar notificaciones del admin', async () => {
        const res = await authGet('/notificaciones', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('noLeidas');
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('debería filtrar solo no leídas', async () => {
        const res = await authGet(
          '/notificaciones?soloNoLeidas=true',
          adminAccessToken,
        ).expect(200);

        res.body.data.forEach((n: any) => {
          expect(n.leida).toBe(false);
        });
      });
    });

    describe('GET /notificaciones/contador', () => {
      it('debería obtener contador de no leídas', async () => {
        const res = await authGet('/notificaciones/contador', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('noLeidas');
        expect(typeof res.body.noLeidas).toBe('number');
      });
    });

    describe('POST /notificaciones/enviar', () => {
      it('debería enviar notificación manual (admin)', async () => {
        const res = await authPost('/notificaciones/enviar', adminAccessToken)
          .send({
            usuarioId: V.activo_ok,
            tipo: 'MANUAL',
            titulo: 'Notificación E2E',
            mensaje: 'Mensaje de prueba desde E2E',
            canal: 'WEBSOCKET',
          })
          .expect(201);

        expect(res.body.tipo).toBe('MANUAL');
        expect(res.body.usuarioId).toBe(V.activo_ok);
        expect(res.body.leida).toBe(false);
      });
    });

    describe('GET /notificaciones/:id', () => {
      it('debería obtener una notificación por ID', async () => {
        const notif = await prisma.notificacion.findFirst({
          where: { usuarioId: ADMIN_ID },
        });

        if (!notif) return;

        const res = await authGet(`/notificaciones/${notif.id}`, adminAccessToken).expect(200);

        expect(res.body.id).toBe(notif.id);
      });
    });

    describe('PATCH /notificaciones/:id/leer', () => {
      it('debería marcar notificación como leída', async () => {
        const notif = await prisma.notificacion.findFirst({
          where: { usuarioId: ADMIN_ID, leida: false },
        });

        if (!notif) return;

        const res = await authPatch(
          `/notificaciones/${notif.id}/leer`,
          adminAccessToken,
        ).expect(200);

        expect(res.body.leida).toBe(true);
        expect(res.body.fechaLeida).not.toBeNull();
      });
    });

    describe('PATCH /notificaciones/leer-todas', () => {
      it('debería marcar todas las notificaciones como leídas', async () => {
        const res = await authPatch('/notificaciones/leer-todas', adminAccessToken)
          .send({})
          .expect(200);

        expect(res.body).toHaveProperty('marcadas');
        expect(typeof res.body.marcadas).toBe('number');
      });
    });
  });

  // ============================================================
  // 13. ADMIN - CONFIGURACIONES MODULE
  // ============================================================
  describe('Admin - Configuraciones Module', () => {
    describe('GET /admin/configuraciones', () => {
      it('debería listar todas las configuraciones (admin)', async () => {
        const res = await authGet('/admin/configuraciones', adminAccessToken).expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);

        const primera = res.body[0];
        expect(primera).toHaveProperty('clave');
        expect(primera).toHaveProperty('valor');
        expect(primera).toHaveProperty('tipo');
        expect(primera).toHaveProperty('categoria');
      });

      it('debería rechazar para vendedor', async () => {
        await authGet('/admin/configuraciones', vendedorAccessToken).expect(403);
      });
    });

    describe('GET /admin/configuraciones/categoria/:categoria', () => {
      it('debería listar configuraciones de PRECIOS', async () => {
        const res = await authGet(
          '/admin/configuraciones/categoria/PRECIOS',
          adminAccessToken,
        ).expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        res.body.forEach((c: any) => {
          expect(c.categoria).toBe('PRECIOS');
        });
      });
    });

    describe('GET /admin/configuraciones/:clave', () => {
      it('debería obtener una configuración específica', async () => {
        const res = await authGet(
          '/admin/configuraciones/PRECIO_UNIDAD_LICOR',
          adminAccessToken,
        ).expect(200);

        expect(res.body.clave).toBe('PRECIO_UNIDAD_LICOR');
        expect(res.body.valor).toBe('8000');
      });
    });

    describe('PATCH /admin/configuraciones/:clave', () => {
      it('debería modificar una configuración (admin)', async () => {
        const res = await authPatch(
          '/admin/configuraciones/PRECIO_UNIDAD_LICOR',
          adminAccessToken,
        )
          .send({ valor: '8500', motivo: 'Ajuste de precio test E2E' })
          .expect(200);

        expect(res.body.valor).toBe('8500');
      });

      // Restaurar valor original
      afterAll(async () => {
        await authPatch(
          '/admin/configuraciones/PRECIO_UNIDAD_LICOR',
          adminAccessToken,
        ).send({ valor: '8000', motivo: 'Restaurar valor original' });
      });
    });

    describe('GET /admin/configuraciones/historial', () => {
      it('debería obtener historial de cambios', async () => {
        const res = await authGet(
          '/admin/configuraciones/historial',
          adminAccessToken,
        ).expect(200);

        expect(Array.isArray(res.body) || res.body.data !== undefined).toBeTruthy();
      });
    });
  });

  // ============================================================
  // 14. ADMIN - TIPOS DE INSUMO
  // ============================================================
  describe('Admin - Tipos de Insumo Module', () => {
    let tipoInsumoId: string;

    describe('POST /admin/tipos-insumo', () => {
      it('debería crear un tipo de insumo (admin)', async () => {
        const res = await authPost('/admin/tipos-insumo', adminAccessToken)
          .send({ nombre: 'Insumo Test E2E', esObligatorio: false })
          .expect(201);

        expect(res.body.nombre).toBe('Insumo Test E2E');
        expect(res.body.activo).toBe(true);
        tipoInsumoId = res.body.id;
      });
    });

    describe('GET /admin/tipos-insumo', () => {
      it('debería listar tipos de insumo', async () => {
        const res = await authGet('/admin/tipos-insumo', adminAccessToken).expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
      });

      it('debería filtrar por activos', async () => {
        const res = await authGet(
          '/admin/tipos-insumo?activo=true',
          adminAccessToken,
        ).expect(200);

        res.body.forEach((t: any) => {
          expect(t.activo).toBe(true);
        });
      });
    });

    describe('PATCH /admin/tipos-insumo/:id', () => {
      it('debería modificar tipo de insumo', async () => {
        if (!tipoInsumoId) return;

        const res = await authPatch(
          `/admin/tipos-insumo/${tipoInsumoId}`,
          adminAccessToken,
        )
          .send({ nombre: 'Insumo Renombrado E2E' })
          .expect(200);

        expect(res.body.nombre).toBe('Insumo Renombrado E2E');
      });
    });

    describe('DELETE /admin/tipos-insumo/:id', () => {
      it('debería desactivar tipo de insumo', async () => {
        if (!tipoInsumoId) return;

        const res = await authDelete(
          `/admin/tipos-insumo/${tipoInsumoId}`,
          adminAccessToken,
        ).expect(200);

        expect(res.body.activo).toBe(false);
      });
    });
  });

  // ============================================================
  // 15. ADMIN - STOCK MODULE
  // ============================================================
  describe('Admin - Stock Module', () => {
    describe('GET /admin/stock', () => {
      it('debería obtener estado del stock (admin)', async () => {
        const res = await authGet('/admin/stock', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('stockFisico');
        expect(typeof res.body.stockFisico).toBe('number');
      });
    });

    describe('GET /admin/stock/deficit', () => {
      it('debería calcular déficit', async () => {
        const res = await authGet('/admin/stock/deficit', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('stockFisico');
        expect(res.body).toHaveProperty('stockReservado');
        expect(res.body).toHaveProperty('deficit');
        expect(res.body).toHaveProperty('hayDeficit');
      });
    });

    describe('GET /admin/stock/reservado', () => {
      it('debería obtener desglose de stock reservado', async () => {
        const res = await authGet('/admin/stock/reservado', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('totalReservado');
        expect(res.body).toHaveProperty('porEstado');
        expect(res.body).toHaveProperty('porVendedor');
        expect(res.body).toHaveProperty('porLote');
      });
    });
  });

  // ============================================================
  // 16. ADMIN - PEDIDOS STOCK MODULE
  // ============================================================
  describe('Admin - Pedidos Stock Module', () => {
    let pedidoId: string;

    describe('POST /admin/pedidos-stock', () => {
      it('debería crear pedido en BORRADOR (admin)', async () => {
        const res = await authPost('/admin/pedidos-stock', adminAccessToken)
          .send({ cantidadTrabix: 50, notas: 'Pedido E2E test' })
          .expect(201);

        expect(res.body.estado).toBe('BORRADOR');
        expect(res.body.cantidadTrabix).toBe(50);
        pedidoId = res.body.id;
      });
    });

    describe('GET /admin/pedidos-stock', () => {
      it('debería listar pedidos', async () => {
        const res = await authGet('/admin/pedidos-stock', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('data');
      });

      it('debería filtrar por estado', async () => {
        const res = await authGet(
          '/admin/pedidos-stock?estado=BORRADOR',
          adminAccessToken,
        ).expect(200);

        if (res.body.data) {
          res.body.data.forEach((p: any) => {
            expect(p.estado).toBe('BORRADOR');
          });
        }
      });
    });

    describe('GET /admin/pedidos-stock/:id', () => {
      it('debería obtener pedido con detalles', async () => {
        if (!pedidoId) return;

        const res = await authGet(
          `/admin/pedidos-stock/${pedidoId}`,
          adminAccessToken,
        ).expect(200);

        expect(res.body.id).toBe(pedidoId);
        expect(res.body).toHaveProperty('detallesCosto');
      });
    });

    describe('PATCH /admin/pedidos-stock/:id', () => {
      it('debería modificar pedido en BORRADOR', async () => {
        if (!pedidoId) return;

        const res = await authPatch(
          `/admin/pedidos-stock/${pedidoId}`,
          adminAccessToken,
        )
          .send({ cantidadTrabix: 100, notas: 'Actualizado E2E' })
          .expect(200);

        expect(res.body.cantidadTrabix).toBe(100);
      });
    });

    describe('POST /admin/pedidos-stock/:id/costos', () => {
      it('debería agregar costo al pedido', async () => {
        if (!pedidoId) return;

        const res = await authPost(
          `/admin/pedidos-stock/${pedidoId}/costos`,
          adminAccessToken,
        )
          .send({
            concepto: 'Trabix (unidad de producto)',
            esObligatorio: true,
            cantidad: 100,
            costoTotal: 100000,
          })
          .expect(201);

        expect(res.body.detallesCosto.length).toBeGreaterThan(0);
      });
    });

    describe('POST /admin/pedidos-stock/:id/cancelar', () => {
      it('debería cancelar pedido en BORRADOR', async () => {
        if (!pedidoId) return;

        const res = await authPost(
          `/admin/pedidos-stock/${pedidoId}/cancelar`,
          adminAccessToken,
        )
          .send({ motivo: 'Cancelado por test E2E' })
          .expect(200);

        expect(res.body.estado).toBe('CANCELADO');
      });
    });
  });

  // ============================================================
  // 17. ADMIN - DASHBOARD MODULE
  // ============================================================
  describe('Admin - Dashboard Module', () => {
    describe('GET /admin/dashboard/resumen', () => {
      it('debería obtener resumen del dashboard', async () => {
        const res = await authGet('/admin/dashboard/resumen', adminAccessToken).expect(200);

        expect(res.body).toHaveProperty('ventasHoy');
        expect(res.body).toHaveProperty('ingresosHoy');
        expect(res.body).toHaveProperty('stockFisico');
        expect(res.body).toHaveProperty('cuadresPendientes');
        expect(res.body).toHaveProperty('vendedoresActivos');
        expect(res.body).toHaveProperty('saldoFondo');
      });
    });

    describe('GET /admin/dashboard/ventas-periodo', () => {
      it('debería obtener ventas del día', async () => {
        const res = await authGet(
          '/admin/dashboard/ventas-periodo?periodo=dia',
          adminAccessToken,
        ).expect(200);

        expect(res.body).toHaveProperty('periodo');
        expect(res.body).toHaveProperty('totalVentas');
        expect(res.body).toHaveProperty('totalIngresos');
      });

      it('debería obtener ventas de la semana', async () => {
        await authGet(
          '/admin/dashboard/ventas-periodo?periodo=semana',
          adminAccessToken,
        ).expect(200);
      });

      it('debería obtener ventas del mes', async () => {
        await authGet(
          '/admin/dashboard/ventas-periodo?periodo=mes',
          adminAccessToken,
        ).expect(200);
      });
    });

    describe('GET /admin/dashboard/vendedores-activos', () => {
      it('debería obtener cantidad de vendedores activos', async () => {
        const res = await authGet(
          '/admin/dashboard/vendedores-activos',
          adminAccessToken,
        ).expect(200);

        expect(res.body).toHaveProperty('total');
        expect(res.body).toHaveProperty('vendedores');
        expect(res.body).toHaveProperty('reclutadores');
        expect(res.body.total).toBe(res.body.vendedores + res.body.reclutadores);
      });
    });

    describe('GET /admin/dashboard/cuadres-pendientes', () => {
      it('debería listar cuadres pendientes', async () => {
        const res = await authGet(
          '/admin/dashboard/cuadres-pendientes',
          adminAccessToken,
        ).expect(200);

        expect(Array.isArray(res.body)).toBe(true);
      });
    });
  });

  // ============================================================
  // 18. SEGURIDAD Y ACCESO
  // ============================================================
  describe('Seguridad y Control de Acceso', () => {
    it('debería rechazar request sin token', async () => {
      await request(app.getHttpServer())
        .get(`${PREFIX}/usuarios/me`)
        .expect(401);
    });

    it('debería rechazar token inválido', async () => {
      await request(app.getHttpServer())
        .get(`${PREFIX}/usuarios/me`)
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });

    it('vendedor NO puede acceder a endpoints de admin', async () => {
      await authGet('/admin/dashboard/resumen', vendedorAccessToken).expect(403);
      await authGet('/admin/stock', vendedorAccessToken).expect(403);
      await authGet('/admin/configuraciones', vendedorAccessToken).expect(403);
    });

    it('vendedor NO puede aprobar ventas', async () => {
      const venta = await prisma.venta.findFirst({ where: { estado: 'PENDIENTE' } });
      if (venta) {
        await authPost(`/ventas/${venta.id}/aprobar`, vendedorAccessToken).expect(403);
      }
    });

    it('vendedor NO puede activar lotes', async () => {
      await authPost(
        `/lotes/${LOTE.v_multi_2}/activar`,
        vendedorAccessToken,
      ).expect(403);
    });
  });

  // ============================================================
  // 19. VALIDACIÓN DE DATOS
  // ============================================================
  describe('Validación de Datos (DTO)', () => {
    it('debería rechazar crear usuario con email inválido', async () => {
      await authPost('/usuarios', adminAccessToken)
        .send({
          cedula: 7777770001,
          nombre: 'Test',
          apellidos: 'Invalid Email',
          email: 'not-an-email',
          telefono: '+573008888001',
        })
        .expect(400);
    });

    it('debería rechazar cédula con menos de 6 dígitos', async () => {
      await authPost('/usuarios', adminAccessToken)
        .send({
          cedula: 12345,
          nombre: 'Test',
          apellidos: 'Short Cedula',
          email: 'short.cedula@mail.com',
          telefono: '+573008888002',
        })
        .expect(400);
    });

    it('debería rechazar venta con tipo inválido', async () => {
      await authPost('/ventas', vendedorAccessToken)
        .send({
          detalles: [{ tipo: 'INVALIDO', cantidad: 1 }],
        })
        .expect(400);
    });

    it('debería rechazar cantidad negativa en venta', async () => {
      await authPost('/ventas', vendedorAccessToken)
        .send({
          detalles: [{ tipo: 'UNIDAD', cantidad: -1 }],
        })
        .expect(400);
    });

    it('debería rechazar lote con cantidadTrabix 0', async () => {
      await authPost('/lotes', adminAccessToken)
        .send({ vendedorId: V.sin_lotes, cantidadTrabix: 0 })
        .expect(400);
    });

    it('debería rechazar contraseña débil en cambio de password', async () => {
      await authPost('/auth/cambiar-password', vendedorAccessToken)
        .send({
          currentPassword: VENDEDOR_PASSWORD,
          newPassword: '123',
        })
        .expect(400);
    });
  });
});