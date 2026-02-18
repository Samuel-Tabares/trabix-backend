import { Injectable, Logger } from '@nestjs/common';
import { Usuario, EstadoUsuario, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import {
  IUsuarioRepository,
  FindAllUsuariosOptions,
  PaginatedUsuarios,
  CreateUsuarioData,
  UpdateUsuarioData,
  CountUsuariosOptions,
  UsuarioJerarquia,
  UsuarioJerarquiaConGanancias,
  ResumenGanancias,
} from '../domain/usuario.repository.interface';

/**
 * Implementación del repositorio de usuarios con Prisma
 * Según Clean Architecture: infraestructura implementa interfaces de dominio
 */
@Injectable()
export class PrismaUsuarioRepository implements IUsuarioRepository {
  private readonly logger = new Logger(PrismaUsuarioRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findByCedula(cedula: number): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({
      where: { cedula },
    });
  }

  async findByTelefono(telefono: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({
      where: { telefono },
    });
  }

  async findAll(options: FindAllUsuariosOptions): Promise<PaginatedUsuarios> {
    const { skip = 0, take = 20, cursor, where = {}, orderBy, includeReclutador = false } = options;

    // Construir condiciones de búsqueda
    const whereCondition: Prisma.UsuarioWhereInput = {
      // Por defecto filtra no eliminados, pero permite override
      eliminado: where.eliminado ?? false,
    };

    if (where.rol) {
      whereCondition.rol = where.rol;
    }

    if (where.estado) {
      whereCondition.estado = where.estado;
    }

    if (where.reclutadorId !== undefined) {
      whereCondition.reclutadorId = where.reclutadorId;
    }

    if (where.modeloNegocio) {
      whereCondition.modeloNegocio = where.modeloNegocio;
    }

    // Búsqueda exacta por cédula (número)
    if (where.cedula !== undefined) {
      whereCondition.cedula = where.cedula;
    }

    // Búsqueda por texto (nombre, apellidos, email)
    if (where.search) {
      whereCondition.OR = [
        { nombre: { contains: where.search, mode: 'insensitive' } },
        { apellidos: { contains: where.search, mode: 'insensitive' } },
        { email: { contains: where.search, mode: 'insensitive' } },
      ];

      // Si el search es un número válido, también buscar por cédula exacta
      const searchAsNumber = Number.parseInt(where.search, 10);
      if (!Number.isNaN(searchAsNumber) && where.search === searchAsNumber.toString()) {
        whereCondition.OR.push({ cedula: searchAsNumber });
      }
    }

    // Ordenamiento
    const orderByCondition: Prisma.UsuarioOrderByWithRelationInput = orderBy
      ? { [orderBy.field]: orderBy.direction }
      : { fechaCreacion: 'desc' };

    // Configuración de cursor pagination
    const queryOptions: Prisma.UsuarioFindManyArgs = {
      where: whereCondition,
      orderBy: orderByCondition,
      take: take + 1, // +1 para saber si hay más
      include: includeReclutador ? { reclutador: true } : undefined,
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1; // Skip the cursor
    } else {
      queryOptions.skip = skip;
    }

    // Ejecutar queries en paralelo
    const [usuarios, total] = await Promise.all([
      this.prisma.usuario.findMany(queryOptions),
      this.prisma.usuario.count({ where: whereCondition }),
    ]);

    // Determinar si hay más resultados
    const hasMore = usuarios.length > take;
    if (hasMore) {
      usuarios.pop(); // Remover el elemento extra
    }

    return {
      data: usuarios,
      total,
      hasMore,
      nextCursor: hasMore ? usuarios.at(-1)?.id : undefined,
    };
  }

  async findReclutados(reclutadorId: string): Promise<Usuario[]> {
    return this.prisma.usuario.findMany({
      where: {
        reclutadorId,
        eliminado: false,
      },
      orderBy: { fechaCreacion: 'desc' },
    });
  }

  async findJerarquia(usuarioId: string): Promise<UsuarioJerarquia> {
    const buildJerarquia = async (id: string, nivel: number = 0): Promise<UsuarioJerarquia> => {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id },
      });

      if (!usuario) {
        throw new Error(`Usuario ${id} no encontrado`);
      }

      const reclutadosDirectos = await this.prisma.usuario.findMany({
        where: {
          reclutadorId: id,
          eliminado: false,
        },
        orderBy: { fechaCreacion: 'desc' },
      });

      const reclutadosJerarquia = await Promise.all(
        reclutadosDirectos.map((r) => buildJerarquia(r.id, nivel + 1)),
      );

      const totalReclutados =
        reclutadosDirectos.length +
        reclutadosJerarquia.reduce((sum, r) => sum + r.totalReclutados, 0);

      return {
        usuario,
        reclutados: reclutadosJerarquia,
        totalReclutados,
        nivel,
      };
    };

    return buildJerarquia(usuarioId);
  }

  /**
   * Obtiene la jerarquía con ganancias de cada vendedor
   * Para transparencia con reclutadores
   */
  async findJerarquiaConGanancias(usuarioId: string): Promise<UsuarioJerarquiaConGanancias> {
    const buildJerarquiaConGanancias = async (
      id: string,
      nivel: number = 0,
    ): Promise<UsuarioJerarquiaConGanancias> => {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id },
      });

      if (!usuario) {
        throw new Error(`Usuario ${id} no encontrado`);
      }

      // Obtener ganancias del usuario
      const ganancias = await this.calcularGananciasUsuario(id);

      // Obtener reclutados directos
      const reclutadosDirectos = await this.prisma.usuario.findMany({
        where: {
          reclutadorId: id,
          eliminado: false,
        },
        orderBy: { fechaCreacion: 'desc' },
      });

      // Construir jerarquía recursivamente
      const reclutadosJerarquia = await Promise.all(
        reclutadosDirectos.map((r) => buildJerarquiaConGanancias(r.id, nivel + 1)),
      );

      const totalReclutados =
        reclutadosDirectos.length +
        reclutadosJerarquia.reduce((sum, r) => sum + r.totalReclutados, 0);

      return {
        usuario,
        ganancias,
        reclutados: reclutadosJerarquia,
        totalReclutados,
        nivel,
      };
    };

    return buildJerarquiaConGanancias(usuarioId);
  }

  /**
   * Calcula el resumen de ganancias de un usuario
   */
  private async calcularGananciasUsuario(usuarioId: string): Promise<ResumenGanancias> {
    // Obtener ventas aprobadas
    const ventasAgregadas = await this.prisma.venta.aggregate({
      _count: { _all: true },
      _sum: {
        montoTotal: true,
        cantidadTrabix: true,
      },
      where: {
        vendedorId: usuarioId,
        estado: 'APROBADA',
      },
    });

    // Obtener lotes del vendedor
    const lotesActivos = await this.prisma.lote.count({
      where: {
        vendedorId: usuarioId,
        estado: 'ACTIVO',
      },
    });

    const lotesFinalizados = await this.prisma.lote.count({
      where: {
        vendedorId: usuarioId,
        estado: 'FINALIZADO',
      },
    });

    // Calcular ganancias del vendedor a partir de lotes finalizados
    // dineroRecaudado - dineroTransferido = lo que queda para el vendedor aproximadamente
    const lotesConGanancias = await this.prisma.lote.aggregate({
      _sum: {
        dineroRecaudado: true,
        dineroTransferido: true,
      },
      where: {
        vendedorId: usuarioId,
        estado: { in: ['ACTIVO', 'FINALIZADO'] },
      },
    });

    const ingresosBrutos = new Decimal(ventasAgregadas._sum.montoTotal || 0);
    const dineroRecaudado = new Decimal(lotesConGanancias._sum.dineroRecaudado || 0);
    const dineroTransferido = new Decimal(lotesConGanancias._sum.dineroTransferido || 0);

    // Ganancias aproximadas = dinero recaudado - transferido al admin
    const gananciasVendedor = dineroRecaudado.minus(dineroTransferido);

    return {
      totalVentas: ventasAgregadas._count._all,
      trabixVendidos: ventasAgregadas._sum.cantidadTrabix || 0,
      ingresosBrutos: Number.parseFloat(ingresosBrutos.toFixed(2)),
      gananciasVendedor: Number.parseFloat(gananciasVendedor.toFixed(2)),
      lotesActivos,
      lotesFinalizados,
    };
  }

  /**
   * Verifica si un usuario pertenece a la rama de otro
   * (es reclutado directo o indirecto)
   */
  async perteneceARama(usuarioId: string, posibleReclutadorId: string): Promise<boolean> {
    // Si son el mismo, pertenece a su propia rama
    if (usuarioId === posibleReclutadorId) {
      return true;
    }

    // Obtener la cadena de reclutadores del usuario
    const cadena = await this.findCadenaReclutadores(usuarioId);

    // Verificar si el posible reclutador está en la cadena
    return cadena.some((r) => r.id === posibleReclutadorId);
  }

  async findCadenaReclutadores(usuarioId: string): Promise<Usuario[]> {
    const cadena: Usuario[] = [];
    let currentId: string | null = usuarioId;

    while (currentId) {
      const usuario: any = await this.prisma.usuario.findUnique({
        where: { id: currentId },
      });

      if (!usuario) break;

      // No incluir el usuario inicial en la cadena
      if (usuario.id !== usuarioId) {
        cadena.push(usuario);
      }

      currentId = usuario.reclutadorId;
    }

    return cadena;
  }

  /**
   * Crea un nuevo usuario (métodoo legacy)
   * @deprecated Usar createWithPromocion para garantizar transaccionalidad
   */
  async create(data: CreateUsuarioData): Promise<Usuario> {
    return this.prisma.usuario.create({
      data: {
        cedula: data.cedula,
        nombre: data.nombre,
        apellidos: data.apellidos,
        email: data.email.toLowerCase(),
        telefono: data.telefono,
        passwordHash: data.passwordHash,
        requiereCambioPassword: true,
        rol: data.rol ?? 'VENDEDOR',
        estado: 'ACTIVO',
        reclutadorId: data.reclutadorId ?? null,
        modeloNegocio: data.modeloNegocio,
      },
    });
  }

  /**
   * Crea un nuevo usuario con promoción de reclutador en una transacción atómica
   *
   * Garantiza que:
   * 1. Si el reclutador debe ser promovido a RECLUTADOR, se hace primero
   * 2. Luego se crea el usuario
   * 3. Si cualquier paso falla, se hace rollback completo
   *
   * @param data Datos del usuario a crear (incluyendo modeloNegocio)
   * @param reclutadorIdAPromover ID del reclutador a promover (solo si era VENDEDOR)
   * @returns Usuario creado
   */
  async createWithPromocion(
    data: CreateUsuarioData,
    reclutadorIdAPromover?: string,
  ): Promise<Usuario> {
    return this.prisma.$transaction(async (tx) => {
      // Paso 1: Promover reclutador si es necesario
      if (reclutadorIdAPromover) {
        await tx.usuario.update({
          where: { id: reclutadorIdAPromover },
          data: { rol: 'RECLUTADOR' },
        });

        this.logger.log(`[TX] Reclutador ${reclutadorIdAPromover} promovido a RECLUTADOR`);
      }

      // Paso 2: Crear el nuevo usuario
      const usuario = await tx.usuario.create({
        data: {
          cedula: data.cedula,
          nombre: data.nombre,
          apellidos: data.apellidos,
          email: data.email.toLowerCase(),
          telefono: data.telefono,
          passwordHash: data.passwordHash,
          requiereCambioPassword: true,
          rol: data.rol ?? 'VENDEDOR',
          estado: 'ACTIVO',
          reclutadorId: data.reclutadorId ?? null,
          modeloNegocio: data.modeloNegocio,
        },
      });

      this.logger.log(
        `[TX] Usuario ${usuario.id} (${usuario.email}) creado con modelo ${data.modeloNegocio}`,
      );

      return usuario;
    });
  }

  async update(id: string, data: UpdateUsuarioData): Promise<Usuario> {
    const updateData: Prisma.UsuarioUpdateInput = {};

    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.apellidos !== undefined) updateData.apellidos = data.apellidos;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.telefono !== undefined) updateData.telefono = data.telefono;
    if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;
    if (data.requiereCambioPassword !== undefined) {
      updateData.requiereCambioPassword = data.requiereCambioPassword;
    }
    if (data.refreshTokenHash !== undefined) {
      updateData.refreshTokenHash = data.refreshTokenHash;
    }
    if (data.intentosFallidos !== undefined) {
      updateData.intentosFallidos = data.intentosFallidos;
    }
    if (data.bloqueadoHasta !== undefined) {
      updateData.bloqueadoHasta = data.bloqueadoHasta;
    }
    if (data.ultimoLogin !== undefined) {
      updateData.ultimoLogin = data.ultimoLogin;
    }

    return this.prisma.usuario.update({
      where: { id },
      data: updateData,
    });
  }

  async cambiarEstado(id: string, estado: EstadoUsuario): Promise<Usuario> {
    return this.prisma.usuario.update({
      where: { id },
      data: {
        estado,
        fechaCambioEstado: new Date(),
      },
    });
  }

  /**
   * Promueve un vendedor a reclutador
   * Según sección 1.1: RECLUTADOR se genera automáticamente
   */
  async promoverAReclutador(id: string): Promise<Usuario> {
    return this.prisma.usuario.update({
      where: { id },
      data: { rol: 'RECLUTADOR' },
    });
  }

  async softDelete(id: string): Promise<Usuario> {
    return this.prisma.usuario.update({
      where: { id },
      data: {
        eliminado: true,
        fechaEliminacion: new Date(),
        estado: 'INACTIVO',
        fechaCambioEstado: new Date(),
      },
    });
  }

  /**
   * Restaura un usuario eliminado
   * Se restaura en estado INACTIVO, el admin decide si activarlo
   */
  async restaurar(id: string): Promise<Usuario> {
    return this.prisma.usuario.update({
      where: { id },
      data: {
        eliminado: false,
        fechaEliminacion: null,
        estado: 'INACTIVO', // Restaura como INACTIVO por seguridad
        fechaCambioEstado: new Date(),
      },
    });
  }

  async count(options?: CountUsuariosOptions): Promise<number> {
    const where: Prisma.UsuarioWhereInput = {
      eliminado: options?.eliminado ?? false,
    };

    if (options?.rol) where.rol = options.rol;
    if (options?.estado) where.estado = options.estado;
    if (options?.reclutadorId) where.reclutadorId = options.reclutadorId;

    return this.prisma.usuario.count({ where });
  }

  async existsByEmail(email: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.UsuarioWhereInput = {
      email: email.toLowerCase(),
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.prisma.usuario.count({ where });
    return count > 0;
  }

  async existsByCedula(cedula: number, excludeId?: string): Promise<boolean> {
    const where: Prisma.UsuarioWhereInput = { cedula };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.prisma.usuario.count({ where });
    return count > 0;
  }

  async existsByTelefono(telefono: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.UsuarioWhereInput = { telefono };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.prisma.usuario.count({ where });
    return count > 0;
  }
}
