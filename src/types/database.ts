// ============================================================================
// TIENDA TIGRE - DEFINICIÓN DE TIPOS Y MODELOS DE DATOS (TypeScript Strict)
// Moneda: MXN | Idioma: es-MX | Soporte Multi-Sucursal Nativo
// ============================================================================

export type UserRole = 'admin' | 'encargado' | 'cajero';

export type SaleUnitType = 'pieza' | 'kg' | 'gramo' | 'litro' | 'paquete';

export type InventoryMovementType =
  | 'inventario_inicial'
  | 'entrada_compra'
  | 'salida_venta'
  | 'devolucion_venta'
  | 'ajuste_merma'
  | 'ajuste_caducado'
  | 'ajuste_robo'
  | 'ajuste_consumo_propio'
  | 'conteo_fisico';

export type PaymentMethodType = 'efectivo' | 'tarjeta' | 'transferencia' | 'fiado' | 'mixto';

export type SaleStatusType = 'completada' | 'cancelada' | 'devuelta_parcial';

export type ShiftStatusType = 'abierta' | 'cerrada';

export type ExpenseCategoryType =
  | 'luz'
  | 'renta'
  | 'sueldos'
  | 'transporte'
  | 'mantenimiento'
  | 'bolsas_insumos'
  | 'impuestos'
  | 'otros';

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  rfc?: string;
  currency: string;
  tax_rate: number;
  ticket_header: string;
  ticket_footer: string;
  printer_width_mm: 58 | 80;
  is_active: boolean;
  created_at: string;
}

export interface UserProfile {
  id: string;
  branch_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  pin_code?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  branch_id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  reason?: string;
  created_at: string;
}

export interface Category {
  id: string;
  branch_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ProductPresentation {
  id: string;
  product_id: string;
  name: string; // Ej: "Caja c/24 pzas"
  barcode?: string;
  conversion_factor: number; // Ej: 24
  box_cost_price: number; // Ej: 348.00 -> unit_cost = 14.50
  calculated_unit_cost: number;
  presentation_sale_price?: number;
}

export interface ProductBatch {
  id: string;
  branch_id: string;
  product_id: string;
  batch_number: string;
  expiry_date: string; // YYYY-MM-DD
  quantity_initial: number;
  quantity_remaining: number;
  unit_cost: number;
  created_at: string;
}

export interface Product {
  id: string;
  branch_id: string;
  category_id: string;
  subcategory_id?: string | null;
  name: string;
  brand: string;
  description?: string;
  photo_url?: string;
  barcode?: string | null; // Opcional, único
  sku: string; // SKU interno obligatorio
  sale_unit: SaleUnitType;
  is_weighable: boolean; // Venta a granel por peso/importe
  is_favorite: boolean; // Acceso rápido en POS
  cost_price: number; // Precio de compra (costo)
  sale_price: number; // Precio de venta al público
  profit_amount: number; // Margen en $
  profit_margin_pct: number; // Margen en %
  wholesale_price?: number | null; // Precio mayoreo opcional
  wholesale_min_qty?: number | null; // A partir de X piezas/kg
  stock_current: number;
  stock_min: number;
  location?: string;
  is_perishable: boolean;
  expiry_date?: string | null;
  batch_code?: string | null;
  is_active: boolean;
  last_sale_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceHistoryEntry {
  id: string;
  branch_id: string;
  product_id: string;
  product_name?: string;
  changed_by: string;
  changed_by_name: string;
  old_cost: number;
  new_cost: number;
  old_price: number;
  new_price: number;
  reason: string;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  branch_id: string;
  product_id: string;
  product_name?: string;
  batch_id?: string | null;
  user_id: string;
  user_name: string;
  movement_type: InventoryMovementType;
  quantity: number; // Positivo entrada, Negativo salida
  stock_before: number;
  stock_after: number;
  unit_cost: number;
  reference_type: 'sale' | 'purchase' | 'manual' | 'count' | 'return';
  reference_id?: string;
  reason: string;
  created_at: string;
}

export interface CartItem {
  product_id: string;
  name: string;
  brand?: string;
  barcode?: string | null;
  sku: string;
  sale_unit: SaleUnitType;
  is_weighable: boolean;
  quantity: number; // Soporta decimales para granel (ej. 0.250 kg)
  regular_price: number;
  wholesale_price?: number | null;
  wholesale_min_qty?: number | null;
  unit_price: number; // Precio efectivo aplicado (regular o mayoreo)
  unit_cost: number;
  discount: number; // Descuento en pesos MXN sobre la línea
  is_wholesale: boolean;
  subtotal: number;
  stock_available: number;
}

export interface CashShift {
  id: string;
  branch_id: string;
  opened_by: string;
  opened_by_name: string;
  closed_by?: string | null;
  closed_by_name?: string | null;
  opened_at: string;
  closed_at?: string | null;
  status: ShiftStatusType;
  opening_amount: number;
  cash_sales_total: number;
  card_sales_total: number;
  transfer_sales_total: number;
  credit_sales_total: number;
  cash_in_total: number;
  cash_out_total: number;
  expected_cash: number;
  counted_cash?: number | null;
  difference?: number | null;
  notes?: string;
}

export interface CashMovement {
  id: string;
  shift_id: string;
  branch_id: string;
  user_id: string;
  user_name: string;
  type: 'ingreso' | 'egreso';
  amount: number;
  concept: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name_snapshot: string;
  barcode_snapshot?: string | null;
  quantity: number;
  sale_unit: SaleUnitType;
  unit_price: number;
  unit_cost: number;
  discount: number;
  is_wholesale: boolean;
  subtotal: number;
  returned_qty: number;
}

export interface Sale {
  id: string;
  branch_id: string;
  shift_id?: string | null;
  folio: string;
  user_id: string;
  user_name: string;
  customer_id?: string | null;
  customer_name?: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  total_cost: number;
  payment_method: PaymentMethodType;
  cash_received: number;
  change_given: number;
  status: SaleStatusType;
  cancel_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  client_sale_uuid: string;
  synced_to_cloud?: boolean;
  items: SaleItem[];
  created_at: string;
}

export interface HeldSale {
  id: string;
  branch_id: string;
  user_id: string;
  user_name: string;
  customer_note: string;
  cart_items: CartItem[];
  created_at: string;
}

export interface Customer {
  id: string;
  branch_id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  credit_limit: number;
  current_balance: number;
  last_payment_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerLedgerEntry {
  id: string;
  branch_id: string;
  customer_id: string;
  customer_name?: string;
  user_id: string;
  user_name: string;
  sale_id?: string | null;
  shift_id?: string | null;
  entry_type: 'cargo_fiado' | 'abono' | 'ajuste_saldo';
  payment_method: 'efectivo' | 'transferencia' | 'tarjeta' | 'n/a';
  amount: number;
  balance_before: number;
  balance_after: number;
  notes?: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  branch_id: string;
  name: string;
  contact_name: string;
  phone: string;
  email?: string;
  visit_days: string[]; // ['Lunes', 'Jueves']
  notes?: string;
  payable_balance: number;
  is_active: boolean;
  created_at: string;
}

export interface SupplierProductQuote {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  product_id: string;
  product_name?: string;
  supplier_sku?: string;
  last_cost_price: number;
  last_purchase_at: string;
  is_preferred: boolean;
  notes?: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name_snapshot: string;
  presentation_id?: string | null;
  presentation_name?: string | null;
  conversion_factor: number;
  quantity: number; // Cantidad comprada (en unidades o cajas)
  units_added_to_stock: number; // quantity * conversion_factor
  unit_cost: number; // Costo por unidad base
  update_product_cost: boolean;
  new_sale_price?: number | null;
  expiry_date?: string | null;
  batch_number?: string | null;
  subtotal: number;
}

export interface Purchase {
  id: string;
  branch_id: string;
  supplier_id: string;
  supplier_name: string;
  user_id: string;
  user_name: string;
  folio_invoice: string;
  total_amount: number;
  paid_amount: number;
  payment_status: 'pagada' | 'pendiente' | 'parcial';
  due_date?: string | null;
  paid_from_shift_id?: string | null;
  notes?: string;
  items: PurchaseItem[];
  purchased_at: string;
}

export interface Expense {
  id: string;
  branch_id: string;
  user_id: string;
  user_name: string;
  shift_id?: string | null;
  category: ExpenseCategoryType;
  description: string;
  amount: number;
  payment_method: 'efectivo_caja' | 'efectivo_externo' | 'transferencia' | 'tarjeta';
  expense_date: string; // YYYY-MM-DD
  created_at: string;
}

export interface OfflineSyncQueueItem {
  id: string;
  action_type: 'CREATE_SALE' | 'CANCEL_SALE' | 'INVENTORY_ADJUST' | 'CUSTOMER_PAYMENT' | 'PRODUCT_UPDATE';
  payload: Record<string, unknown>;
  status: 'pending' | 'synced' | 'error';
  attempts: number;
  error_message?: string;
  created_at: string;
}
