import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from 'decimal.js';

/**
 * Servicio de dominio para configuración de Equipamiento
 * Centraliza el acceso a valores de configuración desde .env
 *
 * Según sección 10 del documento:
 * - Mensualidad con depósito: $9,990 (MENSUALIDAD_CON_DEPOSITO)
 * - Mensualidad sin depósito: $19,990 (MENSUALIDAD_SIN_DEPOSITO)
 * - Depósito inicial: $49,990 (DEPOSITO_EQUIPAMIENTO)
 * - Costo daño nevera: $30,000 (COSTO_DANO_NEVERA)
 * - Costo daño pijama: $60,000 (COSTO_DANO_PIJAMA)
 */
@Injectable()
export class EquipamientoConfigService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Mensualidad cuando el vendedor pagó depósito
   */
  get mensualidadConDeposito(): Decimal {
    const valor = this.configService.get<number>('equipamiento.mensualidadConDeposito');
    return new Decimal(valor ?? 9990);
  }

  /**
   * Mensualidad cuando el vendedor NO pagó depósito
   */
  get mensualidadSinDeposito(): Decimal {
    const valor = this.configService.get<number>('equipamiento.mensualidadSinDeposito');
    return new Decimal(valor ?? 19990);
  }

  /**
   * Valor del depósito inicial
   */
  get deposito(): Decimal {
    const valor = this.configService.get<number>('equipamiento.deposito');
    return new Decimal(valor ?? 49990);
  }

  /**
   * Costo por daño de nevera
   */
  get costoDanoNevera(): Decimal {
    const valor = this.configService.get<number>('equipamiento.costoDanoNevera');
    return new Decimal(valor ?? 30000);
  }

  /**
   * Costo por daño de pijama
   */
  get costoDanoPijama(): Decimal {
    const valor = this.configService.get<number>('equipamiento.costoDanoPijama');
    return new Decimal(valor ?? 60000);
  }

  /**
   * Costo total por pérdida (nevera + pijama)
   * Se calcula como la suma de ambos costos
   */
  get costoPerdidaTotal(): Decimal {
    return this.costoDanoNevera.plus(this.costoDanoPijama);
  }

  /**
   * Calcula la mensualidad según si tiene depósito
   */
  calcularMensualidad(tieneDeposito: boolean): Decimal {
    return tieneDeposito ? this.mensualidadConDeposito : this.mensualidadSinDeposito;
  }

  /**
   * Obtiene el costo de daño según el tipo
   */
  getCostoDano(tipoDano: 'NEVERA' | 'PIJAMA'): Decimal {
    return tipoDano === 'NEVERA' ? this.costoDanoNevera : this.costoDanoPijama;
  }
}
