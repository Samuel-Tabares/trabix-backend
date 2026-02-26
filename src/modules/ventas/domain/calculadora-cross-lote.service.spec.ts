import { CalculadoraCrossLoteService } from './calculadora-cross-lote.service';
import { DetalleVentaParaCalculo } from './calculadora-precios-venta.service';

describe('CalculadoraCrossLoteService', () => {
  let service: CalculadoraCrossLoteService;

  beforeEach(() => {
    service = new CalculadoraCrossLoteService();
  });

  // ─────────────────────────────────────────────────
  // CASO 1: No-promos suficientes → sin split de promos
  // ─────────────────────────────────────────────────

  describe('Caso 1 — no-promos solos llenan stock lote1', () => {
    it('S=1, sale=[2 UNIDAD, 1 PROMO] → 1 UNIDAD a lote1, [1 UNIDAD + 1 PROMO] a lote2', () => {
      const detalles: DetalleVentaParaCalculo[] = [
        { tipo: 'UNIDAD', cantidad: 2 },
        { tipo: 'PROMO', cantidad: 1 },
      ];
      const resultado = service.calcular(detalles, 1);

      expect(resultado.trabixLote1).toBe(1);
      expect(resultado.trabixLote2).toBe(3); // 1 UNIDAD + 1 PROMO (2 trabix)

      const tiposLote1 = resultado.itemsLote1.map((i) => i.tipo);
      expect(tiposLote1).not.toContain('PROMO_PARCIAL');
      expect(tiposLote1).not.toContain('PROMO');

      // Lote2 debe tener la promo intacta
      const promoLote2 = resultado.itemsLote2.find((i) => i.tipo === 'PROMO');
      expect(promoLote2).toBeDefined();
      expect(promoLote2!.cantidad).toBe(1);

      // No debe haber PROMO_PARCIAL en ningún lado
      expect(resultado.itemsLote1.some((i) => i.tipo === 'PROMO_PARCIAL')).toBe(false);
      expect(resultado.itemsLote2.some((i) => i.tipo === 'PROMO_PARCIAL')).toBe(false);
    });

    it('S=2, sale=[3 UNIDAD, 2 PROMO] → 2 UNIDAD a lote1, [1 UNIDAD + 2 PROMO] a lote2', () => {
      const detalles: DetalleVentaParaCalculo[] = [
        { tipo: 'UNIDAD', cantidad: 3 },
        { tipo: 'PROMO', cantidad: 2 },
      ];
      const resultado = service.calcular(detalles, 2);

      expect(resultado.trabixLote1).toBe(2);
      expect(resultado.trabixLote2).toBe(5); // 1 UNIDAD + 2 PROMO (4 trabix)

      expect(resultado.itemsLote1.some((i) => i.tipo === 'PROMO_PARCIAL')).toBe(false);
      expect(resultado.itemsLote2.some((i) => i.tipo === 'PROMO_PARCIAL')).toBe(false);

      const promosTotalesLote2 = resultado.itemsLote2
        .filter((i) => i.tipo === 'PROMO')
        .reduce((s, i) => s + i.cantidad, 0);
      expect(promosTotalesLote2).toBe(2);
    });

    it('S=3, sale=[5 UNIDAD] → 3 UNIDAD a lote1, 2 UNIDAD a lote2 (sin promos)', () => {
      const detalles: DetalleVentaParaCalculo[] = [{ tipo: 'UNIDAD', cantidad: 5 }];
      const resultado = service.calcular(detalles, 3);

      expect(resultado.trabixLote1).toBe(3);
      expect(resultado.trabixLote2).toBe(2);
      expect(resultado.itemsLote1).toEqual([{ tipo: 'UNIDAD', cantidad: 3 }]);
      expect(resultado.itemsLote2).toEqual([{ tipo: 'UNIDAD', cantidad: 2 }]);
    });

    it('S=1, sale=[1 SIN_LICOR, 1 REGALO, 1 PROMO] → SIN_LICOR a lote1, resto a lote2', () => {
      const detalles: DetalleVentaParaCalculo[] = [
        { tipo: 'SIN_LICOR', cantidad: 1 },
        { tipo: 'REGALO', cantidad: 1 },
        { tipo: 'PROMO', cantidad: 1 },
      ];
      const resultado = service.calcular(detalles, 1);

      expect(resultado.trabixLote1).toBe(1);
      expect(resultado.trabixLote2).toBe(3); // REGALO + PROMO (2 trabix)
      expect(resultado.itemsLote1).toEqual([{ tipo: 'SIN_LICOR', cantidad: 1 }]);
      expect(resultado.itemsLote2.some((i) => i.tipo === 'PROMO_PARCIAL')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────
  // CASO 2: Remaining par → promos enteras, sin split
  // ─────────────────────────────────────────────────

  describe('Caso 2 — remaining par, promos enteras bastan', () => {
    it('S=2, sale=[1 PROMO, 1 UNIDAD] → 1 PROMO a lote1, 1 UNIDAD a lote2', () => {
      const detalles: DetalleVentaParaCalculo[] = [
        { tipo: 'PROMO', cantidad: 1 },
        { tipo: 'UNIDAD', cantidad: 1 },
      ];
      const resultado = service.calcular(detalles, 2);

      expect(resultado.trabixLote1).toBe(2);
      expect(resultado.trabixLote2).toBe(1);

      expect(resultado.itemsLote1).toEqual([{ tipo: 'PROMO', cantidad: 1 }]);
      expect(resultado.itemsLote2).toEqual([{ tipo: 'UNIDAD', cantidad: 1 }]);

      // Sin split
      expect(resultado.itemsLote1.some((i) => i.tipo === 'PROMO_PARCIAL')).toBe(false);
      expect(resultado.itemsLote2.some((i) => i.tipo === 'PROMO_PARCIAL')).toBe(false);
    });

    it('S=4, sale=[2 PROMO, 1 UNIDAD] → 2 PROMO a lote1, 1 UNIDAD a lote2', () => {
      const detalles: DetalleVentaParaCalculo[] = [
        { tipo: 'PROMO', cantidad: 2 },
        { tipo: 'UNIDAD', cantidad: 1 },
      ];
      const resultado = service.calcular(detalles, 4);

      expect(resultado.trabixLote1).toBe(4);
      expect(resultado.trabixLote2).toBe(1);
      expect(resultado.itemsLote1.find((i) => i.tipo === 'PROMO')?.cantidad).toBe(2);
      expect(resultado.itemsLote1.some((i) => i.tipo === 'PROMO_PARCIAL')).toBe(false);
    });

    it('S=4, sale=[1 UNIDAD, 1 PROMO, 1 PROMO] → 1U+1P a lote1, 1P a lote2', () => {
      // nonPromo = 1 (UNIDAD), remaining = 3 (impar)... espera, esto va al caso 3
      // Cambiemos: S=4, sale=[2 PROMO, 3 UNIDAD]
      // nonPromo = 3, remaining = 4-3 = 1 (impar) → caso 3
      // Cambiemos: S=4, sale=[3 PROMO] → nonPromo=0, remaining=4 (par, 2 promos) → caso 2
      const detalles: DetalleVentaParaCalculo[] = [{ tipo: 'PROMO', cantidad: 3 }];
      const resultado = service.calcular(detalles, 4);

      expect(resultado.trabixLote1).toBe(4);
      expect(resultado.trabixLote2).toBe(2);
      expect(resultado.itemsLote1.find((i) => i.tipo === 'PROMO')?.cantidad).toBe(2);
      expect(resultado.itemsLote2.find((i) => i.tipo === 'PROMO')?.cantidad).toBe(1);
      expect(resultado.itemsLote1.some((i) => i.tipo === 'PROMO_PARCIAL')).toBe(false);
      expect(resultado.itemsLote2.some((i) => i.tipo === 'PROMO_PARCIAL')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────
  // CASO 3: Remaining impar → split de 1 promo
  // ─────────────────────────────────────────────────

  describe('Caso 3 — split inevitable (PROMO_PARCIAL)', () => {
    it('S=1, sale=[1 PROMO] → PROMO_PARCIAL en cada lote', () => {
      const detalles: DetalleVentaParaCalculo[] = [{ tipo: 'PROMO', cantidad: 1 }];
      const resultado = service.calcular(detalles, 1);

      expect(resultado.trabixLote1).toBe(1);
      expect(resultado.trabixLote2).toBe(1);

      expect(resultado.itemsLote1).toEqual([{ tipo: 'PROMO_PARCIAL', cantidad: 1 }]);
      expect(resultado.itemsLote2).toEqual([{ tipo: 'PROMO_PARCIAL', cantidad: 1 }]);
    });

    it('S=1, sale=[2 PROMO] → PROMO_PARCIAL en lote1, PROMO_PARCIAL+PROMO en lote2', () => {
      const detalles: DetalleVentaParaCalculo[] = [{ tipo: 'PROMO', cantidad: 2 }];
      const resultado = service.calcular(detalles, 1);

      expect(resultado.trabixLote1).toBe(1);
      expect(resultado.trabixLote2).toBe(3); // 1 PROMO_PARCIAL + 1 PROMO

      const parcialLote1 = resultado.itemsLote1.find((i) => i.tipo === 'PROMO_PARCIAL');
      expect(parcialLote1?.cantidad).toBe(1);

      const parcialLote2 = resultado.itemsLote2.find((i) => i.tipo === 'PROMO_PARCIAL');
      expect(parcialLote2?.cantidad).toBe(1);

      const promoLote2 = resultado.itemsLote2.find((i) => i.tipo === 'PROMO');
      expect(promoLote2?.cantidad).toBe(1);
    });

    it('S=3, sale=[2 PROMO] → 1P+PARCIAL en lote1, PARCIAL en lote2', () => {
      // nonPromo=0, remaining=3 (impar), floor(3/2)=1 promo entera + split
      const detalles: DetalleVentaParaCalculo[] = [{ tipo: 'PROMO', cantidad: 2 }];
      const resultado = service.calcular(detalles, 3);

      expect(resultado.trabixLote1).toBe(3);
      expect(resultado.trabixLote2).toBe(1); // solo la PROMO_PARCIAL restante

      const promoLote1 = resultado.itemsLote1.find((i) => i.tipo === 'PROMO');
      expect(promoLote1?.cantidad).toBe(1); // 1 promo entera

      const parcialLote1 = resultado.itemsLote1.find((i) => i.tipo === 'PROMO_PARCIAL');
      expect(parcialLote1?.cantidad).toBe(1); // más 1 parcial

      const parcialLote2 = resultado.itemsLote2.find((i) => i.tipo === 'PROMO_PARCIAL');
      expect(parcialLote2?.cantidad).toBe(1);
    });

    it('S=1, sale=[1 UNIDAD, 1 SIN_LICOR, 1 PROMO] — no hay split porque nonPromo≥S', () => {
      // nonPromo=2 >= S=1 → caso 1, sin split
      const detalles: DetalleVentaParaCalculo[] = [
        { tipo: 'UNIDAD', cantidad: 1 },
        { tipo: 'SIN_LICOR', cantidad: 1 },
        { tipo: 'PROMO', cantidad: 1 },
      ];
      const resultado = service.calcular(detalles, 1);
      expect(resultado.itemsLote1.some((i) => i.tipo === 'PROMO_PARCIAL')).toBe(false);
      expect(resultado.itemsLote2.some((i) => i.tipo === 'PROMO_PARCIAL')).toBe(false);
      expect(resultado.trabixLote1).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────
  // VALIDACIONES DE TOTALES
  // ─────────────────────────────────────────────────

  describe('Integridad de totales', () => {
    const escenarios: { detalles: DetalleVentaParaCalculo[]; S: number }[] = [
      { detalles: [{ tipo: 'UNIDAD', cantidad: 5 }], S: 2 },
      { detalles: [{ tipo: 'PROMO', cantidad: 3 }], S: 1 },
      { detalles: [{ tipo: 'PROMO', cantidad: 2 }, { tipo: 'UNIDAD', cantidad: 3 }], S: 2 },
      {
        detalles: [
          { tipo: 'PROMO', cantidad: 1 },
          { tipo: 'UNIDAD', cantidad: 2 },
          { tipo: 'SIN_LICOR', cantidad: 1 },
          { tipo: 'REGALO', cantidad: 1 },
        ],
        S: 3,
      },
    ];

    it.each(escenarios)(
      'trabixLote1 + trabixLote2 = trabix total ($S)',
      ({ detalles, S }) => {
        const totalTrabix = detalles.reduce(
          (s, d) => s + d.cantidad * (d.tipo === 'PROMO' ? 2 : 1),
          0,
        );
        const resultado = service.calcular(detalles, S);

        expect(resultado.trabixLote1).toBe(S);
        expect(resultado.trabixLote1 + resultado.trabixLote2).toBe(totalTrabix);
      },
    );

    it('lote1 items suman exactamente trabixLote1 trabix', () => {
      const detalles: DetalleVentaParaCalculo[] = [
        { tipo: 'PROMO', cantidad: 2 },
        { tipo: 'UNIDAD', cantidad: 3 },
      ];
      const resultado = service.calcular(detalles, 3);

      const trabixEnLote1 = resultado.itemsLote1.reduce(
        (s, i) => s + i.cantidad * (i.tipo === 'PROMO' ? 2 : 1),
        0,
      );
      expect(trabixEnLote1).toBe(resultado.trabixLote1);
    });
  });

  // ─────────────────────────────────────────────────
  // PROMO_PARCIAL es máximo 1 por lote
  // ─────────────────────────────────────────────────

  describe('Máximo 1 split por operación', () => {
    it('solo hay 1 PROMO_PARCIAL en lote1 y 1 en lote2 sin importar cuántas promos hay', () => {
      const detalles: DetalleVentaParaCalculo[] = [{ tipo: 'PROMO', cantidad: 5 }];
      const resultado = service.calcular(detalles, 1);

      const parcialesLote1 = resultado.itemsLote1
        .filter((i) => i.tipo === 'PROMO_PARCIAL')
        .reduce((s, i) => s + i.cantidad, 0);
      const parcialesLote2 = resultado.itemsLote2
        .filter((i) => i.tipo === 'PROMO_PARCIAL')
        .reduce((s, i) => s + i.cantidad, 0);

      expect(parcialesLote1).toBe(1);
      expect(parcialesLote2).toBe(1);
    });
  });
});
