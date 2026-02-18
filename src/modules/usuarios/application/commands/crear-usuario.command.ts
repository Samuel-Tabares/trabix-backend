import { CommandHandler, ICommandHandler, ICommand } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Usuario, ModeloNegocio } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { IUsuarioRepository, USUARIO_REPOSITORY } from '../../domain/usuario.repository.interface';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { CreateUsuarioDto } from '../dto/create-usuario.dto';

/**
 * Command para crear un nuevo usuario
 */
export class CrearUsuarioCommand implements ICommand {
  constructor(
    public readonly data: CreateUsuarioDto,
    public readonly creadorId: string,
  ) {}
}

/**
 * Resultado de crear usuario
 */
export interface CrearUsuarioResult {
  usuario: Usuario;
  passwordTemporal: string;
}

/**
 * Handler del comando CrearUsuario
 *
 * Según sección 1.2: Admin crea vendedor con contraseña temporal
 * Según sección 1.1: RECLUTADOR se genera automáticamente al registrar
 * un nuevo vendedor con el idReclutador respectivo
 *
 * IMPORTANTE: Usa transacción para garantizar atomicidad entre:
 * - Promoción del reclutador (si aplica)
 * - Creación del usuario
 */
@CommandHandler(CrearUsuarioCommand)
export class CrearUsuarioHandler implements ICommandHandler<
  CrearUsuarioCommand,
  CrearUsuarioResult
> {
  private readonly logger = new Logger(CrearUsuarioHandler.name);

  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: CrearUsuarioCommand): Promise<CrearUsuarioResult> {
    const { data, creadorId } = command;

    // ============================================================
    // VALIDACIONES PREVIAS (antes de la transacción)
    // ============================================================

    // Validar que no exista usuario con misma cédula
    const existeCedula = await this.usuarioRepository.existsByCedula(data.cedula);
    if (existeCedula) {
      throw new DomainException('USR_002', 'Ya existe un usuario con esta cédula', {
        cedula: data.cedula,
      });
    }

    // Validar que no exista usuario con mismo email
    const existeEmail = await this.usuarioRepository.existsByEmail(data.email);
    if (existeEmail) {
      throw new DomainException('USR_003', 'Ya existe un usuario con este correo electrónico', {
        email: data.email,
      });
    }

    // Validar que no exista usuario con mismo teléfono
    const existeTelefono = await this.usuarioRepository.existsByTelefono(data.telefono);
    if (existeTelefono) {
      throw new DomainException('USR_004', 'Ya existe un usuario con este número de teléfono', {
        telefono: data.telefono,
      });
    }

    // ============================================================
    // DETERMINAR MODELO DE NEGOCIO Y PROMOCIÓN
    // ============================================================

    let reclutadorId: string | null = null;
    let reclutadorIdAPromover: string | undefined;
    let modeloNegocio: ModeloNegocio = 'MODELO_60_40'; // Default

    if (data.reclutadorId) {
      const reclutador = await this.usuarioRepository.findById(data.reclutadorId);

      if (!reclutador) {
        throw new DomainException('USR_005', 'El reclutador especificado no existe', {
          reclutadorId: data.reclutadorId,
        });
      }

      if (reclutador.eliminado) {
        throw new DomainException('USR_005', 'El reclutador especificado está eliminado', {
          reclutadorId: data.reclutadorId,
        });
      }

      if (reclutador.estado !== 'ACTIVO') {
        throw new DomainException('USR_005', 'El reclutador especificado no está activo', {
          reclutadorId: data.reclutadorId,
        });
      }

      reclutadorId = data.reclutadorId;

      // Determinar modelo de negocio según el rol del reclutador
      // - ADMIN → 60/40
      // - VENDEDOR/RECLUTADOR → 50/50
      if (reclutador.rol === 'ADMIN') {
        modeloNegocio = 'MODELO_60_40';
      } else {
        modeloNegocio = 'MODELO_50_50';
      }

      // Marcar para promoción si es VENDEDOR
      // (se ejecutará dentro de la transacción)
      if (reclutador.rol === 'VENDEDOR') {
        reclutadorIdAPromover = reclutador.id;
        this.logger.log(
          `Reclutador ${reclutador.id} (${reclutador.email}) será promovido a RECLUTADOR`,
        );
      }
    }

    // ============================================================
    // GENERAR CONTRASEÑA TEMPORAL
    // ============================================================

    const passwordTemporal = this.generarPasswordTemporal();
    const bcryptRounds = this.configService.get<number>('security.bcryptRounds', 12);
    const passwordHash = await bcrypt.hash(passwordTemporal, bcryptRounds);

    // ============================================================
    // CREAR USUARIO CON TRANSACCIÓN ATÓMICA
    // ============================================================

    const usuario = await this.usuarioRepository.createWithPromocion(
      {
        cedula: data.cedula,
        nombre: data.nombre.trim(),
        apellidos: data.apellidos.trim(),
        email: data.email.toLowerCase().trim(),
        telefono: data.telefono.replaceAll(/\s/g, ''),
        passwordHash,
        reclutadorId,
        rol: 'VENDEDOR',
        modeloNegocio,
      },
      reclutadorIdAPromover,
    );

    this.logger.log(
      `Usuario creado: ${usuario.id} (${usuario.email}) por ${creadorId} | ` +
        `Modelo: ${modeloNegocio} | Reclutador: ${reclutadorId ?? 'ninguno'}`,
    );

    return {
      usuario,
      passwordTemporal,
    };
  }

  /**
   * Genera una contraseña temporal segura
   * Formato: 2 letras mayúsculas + 4 números + 2 caracteres especiales
   */
  private generarPasswordTemporal(): string {
    const mayusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numeros = '0123456789';
    const especiales = '!@#$%&*';

    let password = '';

    // 2 letras mayúsculas
    for (let i = 0; i < 2; i++) {
      password += mayusculas.charAt(Math.floor(Math.random() * mayusculas.length));
    }

    // 4 números
    for (let i = 0; i < 4; i++) {
      password += numeros.charAt(Math.floor(Math.random() * numeros.length));
    }

    // 2 caracteres especiales
    for (let i = 0; i < 2; i++) {
      password += especiales.charAt(Math.floor(Math.random() * especiales.length));
    }

    // Mezclar caracteres
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }
}
