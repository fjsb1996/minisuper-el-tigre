// ============================================================================
// TIENDA TIGRE - SUITE DE PRUEBAS UNITARIAS DE LÓGICA DE PRECIOS E INVENTARIO
// Ejecutada con Vitest: npm test
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  calculateProfitMargin,
  calculateUnitCostFromBox,
  calculateWeighableSale,
  formatMXN,
  generateInternalBarcode,
  resolveEffectiveUnitPrice,
} from '@/lib/utils/formatters';

describe('Lógica de Precios, Márgenes, Equivalencias, Granel y Códigos (Tienda Tigre)', () => {
  it('calcula correctamente el margen de ganancia en pesos ($) y porcentaje (%)', () => {
    // Coca-Cola 600ml: costo $14.50, venta $20.00 -> ganancia $5.50 (37.93% sobre costo)
    const res = calculateProfitMargin(14.5, 20.0);
    expect(res.profitAmount).toBe(5.5);
    expect(res.profitMarginPct).toBeCloseTo(37.93, 2);
    expect(res.marginOnSalePct).toBeCloseTo(27.5, 2);
  });

  it('calcula el costo unitario a partir de una presentación por caja/reja', () => {
    // Caja de 24 piezas a $348.00 -> $14.50 por pieza
    expect(calculateUnitCostFromBox(348.0, 24)).toBe(14.5);
    // Caja de 12 leches a $273.60 -> $22.80 por litro
    expect(calculateUnitCostFromBox(273.6, 12)).toBe(22.8);
  });

  it('calcula ventas a granel tanto por peso (kg) como pidiendo por importe en pesos MXN', () => {
    // 1. Cliente pide 250g (0.250 kg) de Jamón de $180/kg -> $45.00 MXN
    const byWeight = calculateWeighableSale({
      pricePerKg: 180,
      weightKg: 0.25,
    });
    expect(byWeight.weightKg).toBe(0.25);
    expect(byWeight.weightGrams).toBe(250);
    expect(byWeight.subtotalMXN).toBe(45.0);

    // 2. Cliente pide "$36 pesos de Jamón" a $180/kg -> 0.200 kg (200 gramos)
    const byAmount = calculateWeighableSale({
      pricePerKg: 180,
      requestedAmountMXN: 36,
    });
    expect(byAmount.subtotalMXN).toBe(36.0);
    expect(byAmount.weightKg).toBe(0.2);
    expect(byAmount.weightGrams).toBe(200);
  });

  it('aplica precio de mayoreo automáticamente a partir de X piezas', () => {
    // Menudeo (< 12 piezas) -> $20.00
    const retail = resolveEffectiveUnitPrice({
      regularPrice: 20.0,
      wholesalePrice: 18.5,
      wholesaleMinQty: 12,
      quantity: 6,
    });
    expect(retail.isWholesale).toBe(false);
    expect(retail.unitPrice).toBe(20.0);

    // Mayoreo (>= 12 piezas) -> $18.50
    const wholesale = resolveEffectiveUnitPrice({
      regularPrice: 20.0,
      wholesalePrice: 18.5,
      wholesaleMinQty: 12,
      quantity: 12,
    });
    expect(wholesale.isWholesale).toBe(true);
    expect(wholesale.unitPrice).toBe(18.5);
  });

  it('genera códigos de barras internos EAN-13 válidos de 13 dígitos con prefijo 200', () => {
    const code = generateInternalBarcode(42);
    expect(code).toHaveLength(13);
    expect(code.startsWith('200')).toBe(true);
    expect(/^\d{13}$/.test(code)).toBe(true);
  });

  it('formatea importes en moneda mexicana MXN', () => {
    const formatted = formatMXN(1234.5);
    expect(formatted).toContain('1,234.50');
  });
});
