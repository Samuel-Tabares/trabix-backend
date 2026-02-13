import { CommandHandler, ICommandHandler, ICommand } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import {ModeloNegocio } from '@prisma/client';
import {
    ILoteRepository,
    LOTE_REPOSITORY,
    LoteConTandas,
} from '../../../lotes/domain/lote.repository.interface';
import {
    IUsuarioRepository,
    USUARIO_REPOSITORY,
} from '../../../usuarios/domain/usuario.repository.interface';
import { CalculadoraInversionService } from '../../domain/calculadora-inversion.service';
import { CalculadoraTandasService } from '../../domain/calculadora-tandas.service';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { CreateLoteDto } from '../../../lotes/application/dto';

/**
 * Command para crear un nuevo lote
 */
export class CrearLoteCommand implements ICommand {
  constructor(
    public readonly data: CreateLoteDto,
    public readonly adminId: string,
  ) {}
}

/**
 * Handler del comando CrearLote
 * 1. Admin crea lote manualmente o vendedor solicita → Estado: CREADO
 * 2. Sistema genera mensaje de WhatsApp para el vendedor
 * 3. Vendedor transfiere inversión
 * 4. Admin valida transferencia → Tanda 1 se libera → Estado: ACTIVO
 */
@CommandHandler(CrearLoteCommand)
export class CrearLoteHandler
  implements ICommandHandler<CrearLoteCommand, LoteConTandas>
{
  private readonly logger = new Logger(CrearLoteHandler.name);

  constructor(
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly calculadoraInversion: CalculadoraInversionService,
    private readonly calculadoraTandas: CalculadoraTandasService,
  ) {}

  async execute(command: CrearLoteCommand): Promise<LoteConTandas> {
    const { data} = command;

    // Validar que el vendedor existe y está activo
    const vendedor = await this.usuarioRepository.findById(data.vendedorId);
    if (!vendedor) {
      throw new DomainException(
        'USR_001',
        'Vendedor no encontrado',
        { vendedorId: data.vendedorId },
      );
    }

    if (vendedor.eliminado) {
      throw new DomainException(
        'USR_001',
        'Vendedor no encontrado',
        { vendedorId: data.vendedorId },
      );
    }

    if (vendedor.estado !== 'ACTIVO') {
      throw new DomainException(
        'LOTE_002',
        'El vendedor debe estar activo para crear lotes',
        { estadoVendedor: vendedor.estado },
      );
    }

    // Validar que el vendedor ya cambió su contraseña temporal
    if (vendedor.requiereCambioPassword) {
      throw new DomainException(
        'LOTE_002',
        'El vendedor debe cambiar su contraseña temporal antes de crear lotes',
      );
    }

    // Determinar modelo de negocio según el reclutador
    let modeloNegocio: ModeloNegocio = 'MODELO_60_40';
    if (vendedor.reclutadorId) {
      const reclutador = await this.usuarioRepository.findById(vendedor.reclutadorId);
      if (reclutador && reclutador.rol !== 'ADMIN') {
        modeloNegocio = 'MODELO_50_50';
      }
    }

    // Calcular inversiones
    const inversiones = this.calculadoraInversion.calcularInversiones(data.cantidadTrabix);

    // Calcular distribución de tandas
    const distribucionTandas = this.calculadoraTandas.calcularDistribucionTandas(
      data.cantidadTrabix,
    );

    // Crear lote con tandas
    const lote = await this.loteRepository.create({
      vendedorId: data.vendedorId,
      cantidadTrabix: data.cantidadTrabix,
      modeloNegocio,
      inversionTotal: inversiones.inversionTotal,
      inversionAdmin: inversiones.inversionAdmin,
      inversionVendedor: inversiones.inversionVendedor,
      tandas: distribucionTandas,
    });

    this.logger.log(
      `Lote creado: ${lote.id} - ${data.cantidadTrabix} TRABIX para vendedor ${data.vendedorId} (${modeloNegocio})`,
    );

    // TODO: Enviar notificación/WhatsApp al vendedor con instrucciones de pago

    return lote;
  }
}
