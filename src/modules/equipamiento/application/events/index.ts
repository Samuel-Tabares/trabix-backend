// Eventos de equipamiento (para Fase 9 - Notificaciones)
// Los eventos se publicarán cuando se implemente el sistema de notificaciones

import { IEvent } from '@nestjs/cqrs';

/**
 * Evento emitido cuando un vendedor solicita equipamiento
 */
export class EquipamientoSolicitadoEvent implements IEvent {
    constructor(
        public readonly equipamientoId: string,
        public readonly vendedorId: string,
        public readonly tieneDeposito: boolean,
    ) {}
}

/**
 * Evento emitido cuando el admin activa/entrega un equipamiento
 */
export class EquipamientoActivadoEvent implements IEvent {
    constructor(
        public readonly equipamientoId: string,
        public readonly vendedorId: string,
        public readonly adminId: string,
    ) {}
}

/**
 * Evento emitido cuando se reporta daño
 */
export class DanoReportadoEvent implements IEvent {
    constructor(
        public readonly equipamientoId: string,
        public readonly vendedorId: string,
        public readonly tipoDano: 'NEVERA' | 'PIJAMA',
        public readonly monto: number,
    ) {}
}

/**
 * Evento emitido cuando se reporta pérdida total
 */
export class PerdidaReportadaEvent implements IEvent {
    constructor(
        public readonly equipamientoId: string,
        public readonly vendedorId: string,
        public readonly monto: number,
    ) {}
}

/**
 * Evento emitido cuando se devuelve el equipamiento
 */
export class EquipamientoDevueltoEvent implements IEvent {
    constructor(
        public readonly equipamientoId: string,
        public readonly vendedorId: string,
        public readonly depositoDevuelto: boolean,
    ) {}
}

export const EquipamientoEventHandlers = [];