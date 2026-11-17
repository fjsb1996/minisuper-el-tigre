// ============================================================================
// TIENDA TIGRE - ESQUEMAS DE VALIDACIÓN ZOD CON MENSAJES EN ESPAÑOL (MÉXICO)
// ============================================================================

import { z } from 'zod';

export const productFormSchema = z
  .object({
    name: z
      .string({ required_error: 'El nombre del producto es obligatorio' })
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(120, 'El nombre no puede exceder 120 caracteres'),
    brand: z.string().trim().optional().default('Genérico'),
    category_id: z.string().min(1, 'Selecciona una categoría'),
    subcategory_id: z.string().optional().nullable(),
    barcode: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine((val) => !val || /^[0-9A-Za-z\-]{4,32}$/.test(val), {
        message: 'El código de barras debe contener entre 4 y 32 caracteres alfanuméricos',
      }),
    sku: z
      .string()
      .trim()
      .min(2, 'El SKU interno es obligatorio (mín. 2 caracteres)')
      .max(32, 'El SKU no puede exceder 32 caracteres'),
    sale_unit: z.enum(['pieza', 'kg', 'gramo', 'litro', 'paquete'], {
      required_error: 'Selecciona una unidad de venta válida',
    }),
    is_weighable: z.boolean().default(false),
    is_favorite: z.boolean().default(false),
    cost_price: z.coerce
      .number({ invalid_type_error: 'Ingresa un costo numérico válido' })
      .min(0, 'El precio de compra no puede ser negativo'),
    sale_price: z.coerce
      .number({ invalid_type_error: 'Ingresa un precio de venta válido' })
      .min(0.1, 'El precio de venta debe ser mayor a $0.00 MXN'),
    wholesale_price: z.coerce.number().optional().nullable(),
    wholesale_min_qty: z.coerce.number().optional().nullable(),
    stock_current: z.coerce
      .number({ invalid_type_error: 'Ingresa una existencia válida' })
      .min(0, 'El stock no puede ser negativo'),
    stock_min: z.coerce
      .number({ invalid_type_error: 'Ingresa un stock mínimo válido' })
      .min(0, 'El stock mínimo no puede ser negativo'),
    location: z.string().trim().optional().default(''),
    is_perishable: z.boolean().default(false),
    expiry_date: z.string().optional().nullable(),
    batch_code: z.string().optional().nullable(),
    photo_url: z.string().optional().default(''),
    is_active: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.wholesale_price && data.wholesale_price > 0) {
        return data.wholesale_min_qty && data.wholesale_min_qty > 1;
      }
      return true;
    },
    {
      message: 'Si defines precio de mayoreo, indica a partir de cuántas piezas o kg aplica (> 1)',
      path: ['wholesale_min_qty'],
    }
  );

export const categoryFormSchema = z.object({
  name: z.string().trim().min(2, 'El nombre de la categoría debe tener al menos 2 caracteres'),
  parent_id: z.string().optional().nullable(),
  description: z.string().optional().default(''),
  icon: z.string().default('Package'),
  color: z.string().default('#ea580c'),
});

export const inventoryAdjustmentSchema = z.object({
  product_id: z.string().min(1, 'Selecciona un producto'),
  movement_type: z.enum([
    'entrada_compra',
    'ajuste_merma',
    'ajuste_caducado',
    'ajuste_robo',
    'ajuste_consumo_propio',
    'conteo_fisico',
  ]),
  quantity: z.coerce.number().refine((val) => val !== 0, {
    message: 'La cantidad debe ser distinta de cero',
  }),
  reason: z
    .string()
    .trim()
    .min(4, 'El motivo es obligatorio para trazabilidad (mínimo 4 caracteres)'),
});

export const customerFormSchema = z.object({
  name: z.string().trim().min(2, 'El nombre del cliente es obligatorio'),
  phone: z
    .string()
    .trim()
    .min(10, 'Ingresa un teléfono válido de al menos 10 dígitos para WhatsApp'),
  address: z.string().trim().optional().default(''),
  notes: z.string().trim().optional().default(''),
  credit_limit: z.coerce
    .number()
    .min(0, 'El límite de crédito no puede ser negativo')
    .default(1000),
});

export const supplierFormSchema = z.object({
  name: z.string().trim().min(2, 'El nombre del proveedor es obligatorio'),
  contact_name: z.string().trim().min(2, 'El nombre del contacto o preventista es obligatorio'),
  phone: z.string().trim().min(8, 'Ingresa un teléfono de contacto válido'),
  email: z.string().trim().optional().default(''),
  visit_days: z.array(z.string()).default([]),
  notes: z.string().trim().optional().default(''),
});

export const expenseFormSchema = z.object({
  category: z.enum([
    'luz',
    'renta',
    'sueldos',
    'transporte',
    'mantenimiento',
    'bolsas_insumos',
    'impuestos',
    'otros',
  ]),
  description: z.string().trim().min(3, 'Describe el gasto (ej. Recibo CFE bimestral)'),
  amount: z.coerce.number().min(0.5, 'El monto del gasto debe ser mayor a $0.50 MXN'),
  payment_method: z.enum(['efectivo_caja', 'efectivo_externo', 'transferencia', 'tarjeta']),
  expense_date: z.string().min(1, 'Selecciona la fecha del gasto'),
});
