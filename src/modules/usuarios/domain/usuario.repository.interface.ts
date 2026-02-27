import { Usuario, Rol, EstadoUsuario, ModeloNegocio } from '@prisma/client';

/**
 * Interface del repositorio de usuarios
 * Según Clean Architecture: la capa de dominio define la interface,
 * la capa de infraestructura la implementa
 */
export interface IUsuarioRepository {
  /**
   * Busca un usuario por ID
   */
  findById(id: string): Promise<Usuario | null>;

  /**
   * Busca un usuario por email
   */
  findByEmail(email: string): Promise<Usuario | null>;

  /**
   * Busca un usuario por cédula (número)
   */
  findByCedula(cedula: number): Promise<Usuario | null>;

  /**
   * Busca un usuario por teléfono
   */
  findByTelefono(telefono: string): Promise<Usuario | null>;

  /**
   * Lista usuarios con filtros y paginación
   */
  findAll(options: FindAllUsuariosOptions): Promise<PaginatedUsuarios>;

  /**
   * Lista los reclutados directos de un usuario
   */
  findReclutados(reclutadorId: string): Promise<Usuario[]>;

  /**
   * Obtiene la jerarquía completa de un usuario (árbol de reclutados)
   */
  findJerarquia(usuarioId: string): Promise<UsuarioJerarquia>;

  /**
   * Obtiene la jerarquía con ganancias de cada vendedor
   * Para transparencia con reclutadores
   */
  findJerarquiaConGanancias(usuarioId: string): Promise<UsuarioJerarquiaConGanancias>;

  /**
   * Obtiene la cadena de reclutadores hacia arriba
   */
  findCadenaReclutadores(usuarioId: string): Promise<Usuario[]>;

  /**
   * Verifica si un usuario pertenece a la rama de otro (es reclutado directo o indirecto)
   */
  perteneceARama(usuarioId: string, posibleReclutadorId: string): Promise<boolean>;

  /**
   * Crea un nuevo usuario
   * @deprecated Usar createWithPromocion para garantizar transaccionalidad
   */
  create(data: CreateUsuarioData): Promise<Usuario>;

  /**
   * Crea un nuevo usuario con promoción de reclutador en una transacción atómica
   *
   * Operaciones atómicas:
   * 1. Si reclutadorIdAPromover está definido, promueve ese usuario a RECLUTADOR
   * 2. Crea el nuevo usuario con el modeloNegocio calculado
   *
   * Si cualquier operación falla, se hace rollback de todoo.
   *
   * @param data Datos del usuario a crear (incluyendo modeloNegocio)
   * @param reclutadorIdAPromover ID del reclutador a promover (si es VENDEDOR)
   * @returns Usuario creado
   */
  createWithPromocion(data: CreateUsuarioData, reclutadorIdAPromover?: string): Promise<Usuario>;

  /**
   * Actualiza un usuario
   */
  update(id: string, data: UpdateUsuarioData): Promise<Usuario>;

  /**
   * Cambia el estado de un usuario
   */
  cambiarEstado(id: string, estado: EstadoUsuario): Promise<Usuario>;

  /**
   * Promueve un vendedor a reclutador
   * Según sección 1.1: RECLUTADOR se genera automáticamente al registrar
   * un nuevo vendedor con el idReclutador respectivo
   */
  promoverAReclutador(id: string): Promise<Usuario>;

  /**
   * Elimina un usuario (soft delete)
   */
  softDelete(id: string): Promise<Usuario>;

  /**
   * Restaura un usuario eliminado
   * El usuario se restaura en estado INACTIVO, el admin decide si activarlo
   */
  restaurar(id: string): Promise<Usuario>;

  /**
   * Cuenta usuarios por criterio
   */
  count(options?: CountUsuariosOptions): Promise<number>;

  /**
   * Verifica si existe un usuario con el email
   */
  existsByEmail(email: string, excludeId?: string): Promise<boolean>;

  /**
   * Verifica si existe un usuario con la cédula (número)
   */
  existsByCedula(cedula: number, excludeId?: string): Promise<boolean>;

  /**
   * Verifica si existe un usuario con el teléfono
   */
  existsByTelefono(telefono: string, excludeId?: string): Promise<boolean>;
}

/**
 * Opciones para listar usuarios
 */
export interface FindAllUsuariosOptions {
  skip?: number;
  take?: number;
  cursor?: string;
  where?: {
    rol?: Rol;
    estado?: EstadoUsuario;
    eliminado?: boolean;
    reclutadorId?: string | null;
    search?: string;
    cedula?: number;
    modeloNegocio?: ModeloNegocio;
    bloqueado?: boolean;
  };
  orderBy?: {
    field: 'fechaCreacion' | 'nombre' | 'apellidos' | 'email';
    direction: 'asc' | 'desc';
  };
  includeReclutador?: boolean;
}

/**
 * Respuesta paginada de usuarios
 */
export interface PaginatedUsuarios {
  data: Usuario[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Datos para crear usuario
 */
export interface CreateUsuarioData {
  cedula: number;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  passwordHash: string;
  reclutadorId?: string | null;
  rol?: Rol;
  modeloNegocio: ModeloNegocio;
}

/**
 * Datos para actualizar usuario
 */
export interface UpdateUsuarioData {
  nombre?: string;
  apellidos?: string;
  email?: string;
  telefono?: string;
  passwordHash?: string;
  requiereCambioPassword?: boolean;
  refreshTokenHash?: string | null;
  intentosFallidos?: number;
  bloqueadoHasta?: Date | null;
  ultimoLogin?: Date;
}

/**
 * Opciones para contar usuarios
 */
export interface CountUsuariosOptions {
  rol?: Rol;
  estado?: EstadoUsuario;
  eliminado?: boolean;
  reclutadorId?: string;
}

/**
 * Estructura de jerarquía de usuario (básica)
 */
export interface UsuarioJerarquia {
  usuario: Usuario;
  reclutados: UsuarioJerarquia[];
  totalReclutados: number;
  nivel: number;
}

/**
 * Resumen de ganancias de un vendedor
 */
export interface ResumenGanancias {
  totalVentas: number;
  trabixVendidos: number;
  ingresosBrutos: number;
  gananciasVendedor: number;
  lotesActivos: number;
  lotesFinalizados: number;
}

/**
 * Estructura de jerarquía con ganancias
 * Para transparencia con reclutadores
 */
export interface UsuarioJerarquiaConGanancias {
  usuario: Usuario;
  ganancias: ResumenGanancias;
  reclutados: UsuarioJerarquiaConGanancias[];
  totalReclutados: number;
  nivel: number;
}

/**
 * Token de inyección para el repositorio
 */
export const USUARIO_REPOSITORY = Symbol('USUARIO_REPOSITORY');
