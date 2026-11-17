// ============================================================================
// TIENDA TIGRE - UTILIDADES DE FORMATO Y LÓGICA FINANCIERA (MXN / es-MX)
// ============================================================================

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SaleUnitType } from '@/types/database';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un monto numérico a Pesos Mexicanos (MXN: $1,234.50)
 */
export function formatMXN(amount: number | null | undefined): string {
  const num = Number(amount ?? 0);
  if (Number.isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Redondea a 2 decimales para montos monetarios
 */
export function roundCurrency(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Redondea a 3 decimales para cantidades a granel (kg, litros)
 */
export function roundQuantity(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

/**
 * Calcula el margen de ganancia en pesos ($) y en porcentaje (%)
 * Margen $ = Precio Venta - Costo Compra
 * Margen % sobre costo = ((Precio Venta - Costo Compra) / Costo Compra) * 100
 */
export function calculateProfitMargin(costPrice: number, salePrice: number): {
  profitAmount: number;
  profitMarginPct: number;
  marginOnSalePct: number;
} {
  const cost = Math.max(0, Number(costPrice) || 0);
  const sale = Math.max(0, Number(salePrice) || 0);
  const profitAmount = roundCurrency(sale - cost);
  const profitMarginPct = cost > 0 ? roundCurrency(((sale - cost) / cost) * 100) : sale > 0 ? 100 : 0;
  const marginOnSalePct = sale > 0 ? roundCurrency(((sale - cost) / sale) * 100) : 0;

  return {
    profitAmount,
    profitMarginPct,
    marginOnSalePct,
  };
}

/**
 * Calcula el costo unitario a partir de una presentación por caja/paquete
 * Ej: Caja de 24 piezas a $348.00 -> $14.50 por pieza
 */
export function calculateUnitCostFromBox(boxCostPrice: number, conversionFactor: number): number {
  const factor = Number(conversionFactor);
  if (!factor || factor <= 0) return roundCurrency(boxCostPrice);
  return roundCurrency(Number(boxCostPrice) / factor);
}

/**
 * Calcula venta a granel bidireccional:
 * - Si el cliente pide por peso (ej. 0.350 kg a $180/kg) -> calcula total en pesos ($63.00)
 * - Si el cliente pide por importe en pesos (ej. "$25 pesos de jamón" a $180/kg) -> calcula peso en kg (0.139 kg)
 */
export function calculateWeighableSale(params: {
  pricePerKg: number;
  weightKg?: number;
  requestedAmountMXN?: number;
}): {
  weightKg: number;
  weightGrams: number;
  subtotalMXN: number;
} {
  const price = Math.max(0.01, Number(params.pricePerKg) || 0);

  if (params.requestedAmountMXN !== undefined && params.requestedAmountMXN > 0) {
    const subtotalMXN = roundCurrency(params.requestedAmountMXN);
    const weightKg = roundQuantity(subtotalMXN / price);
    const weightGrams = Math.round(weightKg * 1000);
    return { weightKg, weightGrams, subtotalMXN };
  }

  const weightKg = roundQuantity(Math.max(0, Number(params.weightKg) || 0));
  const weightGrams = Math.round(weightKg * 1000);
  const subtotalMXN = roundCurrency(weightKg * price);
  return { weightKg, weightGrams, subtotalMXN };
}

/**
 * Determina el precio unitario efectivo considerando precio de mayoreo a partir de X cantidad
 */
export function resolveEffectiveUnitPrice(params: {
  regularPrice: number;
  wholesalePrice?: number | null;
  wholesaleMinQty?: number | null;
  quantity: number;
}): {
  unitPrice: number;
  isWholesale: boolean;
} {
  const { regularPrice, wholesalePrice, wholesaleMinQty, quantity } = params;
  if (
    wholesalePrice &&
    wholesalePrice > 0 &&
    wholesaleMinQty &&
    wholesaleMinQty > 0 &&
    quantity >= wholesaleMinQty
  ) {
    return {
      unitPrice: roundCurrency(wholesalePrice),
      isWholesale: true,
    };
  }
  return {
    unitPrice: roundCurrency(regularPrice),
    isWholesale: false,
  };
}

/**
 * Formatea una cantidad con su unidad de medida en español
 */
export function formatQuantityWithUnit(quantity: number, unit: SaleUnitType): string {
  const qty = roundQuantity(quantity);
  if (unit === 'kg') {
    if (qty < 1 && qty > 0) {
      return `${Math.round(qty * 1000)} g`;
    }
    return `${qty} kg`;
  }
  const labels: Record<SaleUnitType, string> = {
    pieza: qty === 1 ? 'pza' : 'pzas',
    kg: 'kg',
    gramo: 'g',
    litro: qty === 1 ? 'L' : 'L',
    paquete: qty === 1 ? 'paq' : 'paqs',
  };
  return `${qty} ${labels[unit] || unit}`;
}

/**
 * Formatea fecha y hora en español de México
 */
export function formatDateTimeMX(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatDateShortMX(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString.includes('T') ? isoString : `${isoString}T12:00:00`);
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Calcula los días restantes para caducar (negativo si ya caducó)
 */
export function getDaysUntilExpiry(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(expiryDate.includes('T') ? expiryDate : `${expiryDate}T00:00:00`);
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Genera un código de barras interno válido EAN-13 con prefijo 200 (uso interno en tienda)
 */
export function generateInternalBarcode(sequenceNum?: number): string {
  const randomNine = sequenceNum
    ? String(sequenceNum).padStart(9, '0').slice(0, 9)
    : String(Math.floor(100000000 + Math.random() * 900000000));
  const base12 = `200${randomNine}`;
  // Dígito verificador EAN-13
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(base12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${base12}${checkDigit}`;
}

/**
 * Genera un enlace de WhatsApp listo para enviar ticket o recordatorio de cobro
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalizedPhone = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
