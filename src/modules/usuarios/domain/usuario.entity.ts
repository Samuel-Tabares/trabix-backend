import { Rol, EstadoUsuario, ModeloNegocio } from '@prisma/client';
import { DomainException } from '../../../domain/exceptions/domain.exception';

/**
 * Entidad de dominio Usuario
 * Según secciones 1.1, 1.2 del documento
 *
 * Reglas de negocio:
 * - Admin crea vendedor con contraseña temporal
 * - Contraseña debe cambiarse antes de operar
 * - Estados: ACTIVO/INACTIVO
 * - Soft delete (eliminado = true)
 * - Jerarquía: reclutador → reclutados
 * - Roles: ADMIN, VENDEDOR, RECLUTADOR (vendedor con reclutados)
 * - Modelo de negocio: 60/40 (reclutado por ADMIN) o 50/50 (reclutado por vendedor/reclutador)
 */
export class UsuarioEntity {
  readonly id: string;
  readonly cedula: number;
  readonly nombre: string;
  readonly apellidos: string;
  readonly email: string;
  readonly telefono: string;
  readonly passwordHash: string;
  readonly requiereCambioPassword: boolean;
  readonly rol: Rol;
  readonly estado: EstadoUsuario;
  readonly modeloNegocio: ModeloNegocio;
  readonly reclutadorId: string | null;
  readonly refreshTokenHash: string | null;
  readonly intentosFallidos: number;
  readonly bloqueadoHasta: Date | null;
  readonly fechaCreacion: Date;
  readonly ultimoLogin: Date | null;
  readonly fechaCambioEstado: Date | null;
  readonly eliminado: boolean;
  readonly fechaEliminacion: Date | null;

  constructor(props: UsuarioEntityProps) {
    this.id = props.id;
    this.cedula = props.cedula;
    this.nombre = props.nombre;
    this.apellidos = props.apellidos;
    this.email = props.email;
    this.telefono = props.telefono;
    this.passwordHash = props.passwordHash;
    this.requiereCambioPassword = props.requiereCambioPassword;
    this.rol = props.rol;
    this.estado = props.estado;
    this.modeloNegocio = props.modeloNegocio;
    this.reclutadorId = props.reclutadorId;
    this.refreshTokenHash = props.refreshTokenHash;
    this.intentosFallidos = props.intentosFallidos;
    this.bloqueadoHasta = props.bloqueadoHasta;
    this.fechaCreacion = props.fechaCreacion;
    this.ultimoLogin = props.ultimoLogin;
    this.fechaCambioEstado = props.fechaCambioEstado;
    this.eliminado = props.eliminado;
    this.fechaEliminacion = props.fechaEliminacion;
  }

  /**
   * Valida si puede cambiar a un nuevo estado
   */
  validarCambioEstado(nuevoEstado: EstadoUsuario): void {
    if (this.eliminado) {
      throw new DomainException('USR_001', 'No se puede cambiar el estado de un usuario eliminado');
    }

    if (this.estado === nuevoEstado) {
      throw new DomainException('USR_006', `El usuario ya está en estado ${nuevoEstado}`);
    }
  }

  /**
   * Valida si el usuario puede ser eliminado
   * Según sección 1.2: Un usuario puede ser eliminado por admin
   */
  validarEliminacion(): void {
    if (this.eliminado) {
      throw new DomainException('USR_001', 'El usuario ya está eliminado');
    }

    if (this.rol === 'ADMIN') {
      throw new DomainException('USR_006', 'No se puede eliminar al usuario administrador');
    }
  }
}

/**
 * Props para crear una entidad Usuario
 */
export interface UsuarioEntityProps {
  id: string;
  cedula: number;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  passwordHash: string;
  requiereCambioPassword: boolean;
  rol: Rol;
  estado: EstadoUsuario;
  modeloNegocio: ModeloNegocio;
  reclutadorId: string | null;
  refreshTokenHash: string | null;
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
  fechaCreacion: Date;
  ultimoLogin: Date | null;
  fechaCambioEstado: Date | null;
  eliminado: boolean;
  fechaEliminacion: Date | null;
}
