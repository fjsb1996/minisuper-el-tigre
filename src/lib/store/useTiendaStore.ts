// ============================================================================
// TIENDA TIGRE - STORE CENTRAL REACTIVO Y SERVICIO DE OPERACIONES
// Conecta la UI con IndexedDB (Offline-First) y Supabase (Cloud Sync).
// Registra Kardex, Historial de Precios y Bitácora de Auditoría en cada acción.
// ============================================================================

'use client';

import { create } from 'zustand';
import {
  AuditLog,
  Branch,
  CartItem,
  CashMovement,
  CashShift,
  Category,
  Customer,
  CustomerLedgerEntry,
  Expense,
  HeldSale,
  InventoryMovement,
  InventoryMovementType,
  OfflineSyncQueueItem,
  PaymentMethodType,
  PriceHistoryEntry,
  Product,
  ProductBatch,
  ProductPresentation,
  Purchase,
  Sale,
  SaleItem,
  Supplier,
  SupplierProductQuote,
  UserProfile,
  UserRole,
} from '@/types/database';
import {
  DEFAULT_BRANCH_ID,
  SEED_BRANCH,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  SEED_USERS,
} from '@/lib/db-local/seed-data';
import { ensureLocalDBSeeded, localDB } from '@/lib/db-local/db';
import {
  calculateProfitMargin,
  resolveEffectiveUnitPrice,
  roundCurrency,
  roundQuantity,
} from '@/lib/utils/formatters';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

function uid(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface TiendaStoreState {
  isInitialized: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  branch: Branch;
  currentUser: UserProfile;
  users: UserProfile[];
  categories: Category[];
  products: Product[];
  presentations: ProductPresentation[];
  batches: ProductBatch[];
  priceHistory: PriceHistoryEntry[];
  inventoryMovements: InventoryMovement[];
  cashShifts: CashShift[];
  cashMovements: CashMovement[];
  sales: Sale[];
  heldSales: HeldSale[];
  customers: Customer[];
  customerLedger: CustomerLedgerEntry[];
  suppliers: Supplier[];
  supplierQuotes: SupplierProductQuote[];
  purchases: Purchase[];
  expenses: Expense[];
  auditLogs: AuditLog[];
  syncQueue: OfflineSyncQueueItem[];

  // Carrito de Punto de Venta (POS)
  cart: CartItem[];
  selectedCustomerId: string | null;
  globalDiscount: number;

  // Inicialización y Sesión
  initializeApp: () => Promise<void>;
  setOnlineStatus: (online: boolean) => void;
  switchUserRole: (userId: string) => Promise<void>;
  loginWithEmail: (email: string, password?: string) => Promise<{ ok: boolean; error?: string }>;
  createUserProfile: (data: Omit<UserProfile, 'id' | 'branch_id' | 'created_at'>) => Promise<void>;
  updateBranchConfig: (patch: Partial<Branch>) => Promise<void>;

  // Categorías
  saveCategory: (category: Partial<Category> & { name: string }) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;

  // Productos, Presentaciones y Lotes
  saveProduct: (
    data: Partial<Product> & { name: string; sku: string; sale_price: number; cost_price: number },
    presentationsList?: Omit<ProductPresentation, 'id' | 'product_id' | 'calculated_unit_cost'>[],
    reason?: string
  ) => Promise<Product>;
  toggleProductActive: (productId: string) => Promise<void>;
  toggleProductFavorite: (productId: string) => Promise<void>;
  addProductBatch: (batch: Omit<ProductBatch, 'id' | 'branch_id' | 'created_at'>) => Promise<void>;

  // Inventario y Kardex
  registerInventoryAdjustment: (params: {
    productId: string;
    movementType: InventoryMovementType;
    quantity: number; // En conteo_fisico es el nuevo stock físico; en ajustes es delta
    reason: string;
    unitCost?: number;
  }) => Promise<void>;
  bulkImportProducts: (rows: Array<Partial<Product> & { name: string }>) => Promise<number>;

  // Carrito POS
  addToCart: (product: Product, customQuantity?: number, overrideSubtotalMXN?: number) => void;
  updateCartItemQuantity: (productId: string, newQty: number) => void;
  updateCartItemDiscount: (productId: string, discountMXN: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  setSelectedCustomer: (customerId: string | null) => void;
  setGlobalDiscount: (discountMXN: number) => void;
  holdCurrentSale: (note: string) => Promise<void>;
  resumeHeldSale: (heldId: string) => Promise<void>;
  deleteHeldSale: (heldId: string) => Promise<void>;

  // Cobro y Ventas
  processCheckout: (params: {
    paymentMethod: PaymentMethodType;
    cashReceived?: number;
    customerId?: string | null;
  }) => Promise<{ ok: boolean; sale?: Sale; error?: string }>;
  cancelOrReturnSale: (params: {
    saleId: string;
    reason: string;
  }) => Promise<{ ok: boolean; error?: string }>;

  // Turnos y Corte de Caja
  openCashShift: (openingAmount: number, notes?: string) => Promise<CashShift>;
  registerCashMovement: (params: {
    type: 'ingreso' | 'egreso';
    amount: number;
    concept: string;
  }) => Promise<void>;
  closeCashShift: (countedCash: number, notes?: string) => Promise<CashShift>;

  // Clientes y Fiado
  saveCustomer: (data: Partial<Customer> & { name: string; phone: string }) => Promise<Customer>;
  registerCustomerPayment: (params: {
    customerId: string;
    amount: number;
    paymentMethod: 'efectivo' | 'transferencia' | 'tarjeta';
    notes?: string;
  }) => Promise<void>;

  // Proveedores, Compras y Gastos
  saveSupplier: (data: Partial<Supplier> & { name: string }) => Promise<Supplier>;
  saveSupplierQuote: (quote: Omit<SupplierProductQuote, 'id' | 'last_purchase_at'>) => Promise<void>;
  registerPurchase: (params: {
    supplierId: string;
    folioInvoice: string;
    paymentStatus: 'pagada' | 'pendiente' | 'parcial';
    paidAmount: number;
    dueDate?: string | null;
    payFromCurrentShift: boolean;
    notes?: string;
    items: Array<{
      productId: string;
      presentationId?: string | null;
      conversionFactor: number;
      quantity: number;
      unitCost: number;
      updateProductCost: boolean;
      newSalePrice?: number | null;
      expiryDate?: string | null;
      batchNumber?: string | null;
    }>;
  }) => Promise<Purchase>;
  paySupplierBalance: (params: {
    supplierId: string;
    amount: number;
    fromCashShift: boolean;
    notes?: string;
  }) => Promise<void>;
  registerExpense: (
    data: Omit<Expense, 'id' | 'branch_id' | 'user_id' | 'user_name' | 'created_at'>
  ) => Promise<Expense>;
  deleteExpense: (id: string) => Promise<void>;

  // Sincronización Offline y Respaldos
  syncPendingOfflineQueue: () => Promise<{ syncedCount: number }>;
  resetDemoDatabase: () => Promise<void>;
}

export const useTiendaStore = create<TiendaStoreState>((set, get) => ({
  isInitialized: false,
  isOnline: true,
  isSyncing: false,
  branch: SEED_BRANCH,
  currentUser: SEED_USERS[0],
  users: SEED_USERS,
  categories: SEED_CATEGORIES,
  products: SEED_PRODUCTS,
  presentations: [],
  batches: [],
  priceHistory: [],
  inventoryMovements: [],
  cashShifts: [],
  cashMovements: [],
  sales: [],
  heldSales: [],
  customers: [],
  customerLedger: [],
  suppliers: [],
  supplierQuotes: [],
  purchases: [],
  expenses: [],
  auditLogs: [],
  syncQueue: [],

  cart: [],
  selectedCustomerId: null,
  globalDiscount: 0,

  initializeApp: async () => {
    if (typeof window === 'undefined') return;
    await ensureLocalDBSeeded();
    if (!localDB) return;

    const [
      branches,
      users,
      categories,
      products,
      presentations,
      batches,
      priceHistory,
      inventoryMovements,
      cashShifts,
      cashMovements,
      sales,
      heldSales,
      customers,
      customerLedger,
      suppliers,
      supplierQuotes,
      purchases,
      expenses,
      auditLogs,
      syncQueue,
    ] = await Promise.all([
      localDB.branches.toArray(),
      localDB.users.toArray(),
      localDB.categories.orderBy('sort_order').toArray(),
      localDB.products.toArray(),
      localDB.presentations.toArray(),
      localDB.batches.toArray(),
      localDB.priceHistory.reverse().sortBy('created_at'),
      localDB.inventoryMovements.reverse().sortBy('created_at'),
      localDB.cashShifts.reverse().sortBy('opened_at'),
      localDB.cashMovements.reverse().sortBy('created_at'),
      localDB.sales.reverse().sortBy('created_at'),
      localDB.heldSales.reverse().sortBy('created_at'),
      localDB.customers.toArray(),
      localDB.customerLedger.reverse().sortBy('created_at'),
      localDB.suppliers.toArray(),
      localDB.supplierQuotes.toArray(),
      localDB.purchases.reverse().sortBy('purchased_at'),
      localDB.expenses.reverse().sortBy('expense_date'),
      localDB.auditLogs.reverse().sortBy('created_at'),
      localDB.syncQueue.toArray(),
    ]);

    const savedUserId = window.localStorage.getItem('tigre_active_user_id');
    const activeUser = users.find((u) => u.id === savedUserId) || users[0] || SEED_USERS[0];

    set({
      isInitialized: true,
      branch: branches[0] || SEED_BRANCH,
      currentUser: activeUser,
      users,
      categories,
      products,
      presentations,
      batches,
      priceHistory,
      inventoryMovements,
      cashShifts,
      cashMovements,
      sales,
      heldSales,
      customers,
      customerLedger,
      suppliers,
      supplierQuotes,
      purchases,
      expenses,
      auditLogs,
      syncQueue,
    });
  },

  setOnlineStatus: (online: boolean) => {
    set({ isOnline: online });
    if (online) {
      get().syncPendingOfflineQueue();
    }
  },

  switchUserRole: async (userId: string) => {
    const user = get().users.find((u) => u.id === userId);
    if (!user) return;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('tigre_active_user_id', user.id);
    }
    set({ currentUser: user });
  },

  loginWithEmail: async (email: string, password?: string) => {
    const normalized = email.trim().toLowerCase();
    // Si Supabase está configurado, intentar login real
    if (isSupabaseConfigured() && password) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalized,
          password,
        });
        if (error) {
          return { ok: false, error: 'Credenciales inválidas en Supabase: ' + error.message };
        }
      }
    }

    const foundLocal = get().users.find((u) => u.email.toLowerCase() === normalized);
    if (foundLocal) {
      await get().switchUserRole(foundLocal.id);
      return { ok: true };
    }
    return {
      ok: false,
      error:
        'No se encontró ningún usuario con ese correo. Usa una de las cuentas de demostración o regístrate.',
    };
  },

  createUserProfile: async (data) => {
    const newUser: UserProfile = {
      ...data,
      id: uid('usr'),
      branch_id: DEFAULT_BRANCH_ID,
      created_at: new Date().toISOString(),
    };
    if (localDB) await localDB.users.put(newUser);
    set((state) => ({ users: [...state.users, newUser] }));
  },

  updateBranchConfig: async (patch) => {
    const updated: Branch = {
      ...get().branch,
      ...patch,
    };
    if (localDB) await localDB.branches.put(updated);
    set({ branch: updated });
  },

  // ==========================================================================
  // CATEGORÍAS Y SUBCATEGORÍAS
  // ==========================================================================
  saveCategory: async (data) => {
    const existing = data.id ? get().categories.find((c) => c.id === data.id) : undefined;
    const slug = data.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const category: Category = {
      id: existing?.id || uid('cat'),
      branch_id: DEFAULT_BRANCH_ID,
      parent_id: data.parent_id ?? existing?.parent_id ?? null,
      name: data.name.trim(),
      slug,
      description: data.description ?? existing?.description ?? '',
      icon: data.icon || existing?.icon || 'Package',
      color: data.color || existing?.color || '#ea580c',
      sort_order: data.sort_order ?? existing?.sort_order ?? get().categories.length + 1,
      is_active: data.is_active ?? existing?.is_active ?? true,
      created_at: existing?.created_at || new Date().toISOString(),
    };

    if (localDB) await localDB.categories.put(category);
    set((state) => {
      const others = state.categories.filter((c) => c.id !== category.id);
      return { categories: [...others, category].sort((a, b) => a.sort_order - b.sort_order) };
    });
    return category;
  },

  deleteCategory: async (id) => {
    if (localDB) await localDB.categories.delete(id);
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id && c.parent_id !== id),
    }));
  },

  // ==========================================================================
  // PRODUCTOS, EQUIVALENCIAS, LOTES E HISTORIAL DE PRECIOS
  // ==========================================================================
  saveProduct: async (data, presentationsList, reason = 'Actualización en catálogo') => {
    const state = get();
    const existing = data.id ? state.products.find((p) => p.id === data.id) : undefined;
    const now = new Date().toISOString();

    const costPrice = roundCurrency(Number(data.cost_price) || 0);
    const salePrice = roundCurrency(Number(data.sale_price) || 0);
    const { profitAmount, profitMarginPct } = calculateProfitMargin(costPrice, salePrice);

    const product: Product = {
      id: existing?.id || uid('prod'),
      branch_id: DEFAULT_BRANCH_ID,
      category_id: data.category_id || existing?.category_id || 'cat-abarrotes',
      subcategory_id: data.subcategory_id ?? existing?.subcategory_id ?? null,
      name: data.name.trim(),
      brand: (data.brand || existing?.brand || 'Genérico').trim(),
      description: data.description ?? existing?.description ?? '',
      photo_url: data.photo_url ?? existing?.photo_url ?? '',
      barcode: data.barcode ? data.barcode.trim() : null,
      sku: data.sku.trim().toUpperCase(),
      sale_unit: data.sale_unit || existing?.sale_unit || 'pieza',
      is_weighable:
        data.is_weighable ??
        existing?.is_weighable ??
        (data.sale_unit === 'kg' || data.sale_unit === 'gramo'),
      is_favorite: data.is_favorite ?? existing?.is_favorite ?? false,
      cost_price: costPrice,
      sale_price: salePrice,
      profit_amount: profitAmount,
      profit_margin_pct: profitMarginPct,
      wholesale_price:
        data.wholesale_price && Number(data.wholesale_price) > 0
          ? roundCurrency(Number(data.wholesale_price))
          : null,
      wholesale_min_qty:
        data.wholesale_min_qty && Number(data.wholesale_min_qty) > 0
          ? roundQuantity(Number(data.wholesale_min_qty))
          : null,
      stock_current: roundQuantity(
        data.stock_current !== undefined ? Number(data.stock_current) : existing?.stock_current ?? 0
      ),
      stock_min: roundQuantity(
        data.stock_min !== undefined ? Number(data.stock_min) : existing?.stock_min ?? 5
      ),
      location: data.location ?? existing?.location ?? '',
      is_perishable: data.is_perishable ?? existing?.is_perishable ?? false,
      expiry_date: data.expiry_date ?? existing?.expiry_date ?? null,
      batch_code: data.batch_code ?? existing?.batch_code ?? null,
      is_active: data.is_active ?? existing?.is_active ?? true,
      last_sale_at: existing?.last_sale_at ?? null,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    if (localDB) {
      await localDB.products.put(product);
    }

    // Si es producto nuevo con stock inicial > 0, registrar movimiento de inventario inicial
    const newMovements: InventoryMovement[] = [];
    if (!existing && product.stock_current > 0) {
      const initMov: InventoryMovement = {
        id: uid('mov'),
        branch_id: DEFAULT_BRANCH_ID,
        product_id: product.id,
        product_name: product.name,
        user_id: state.currentUser.id,
        user_name: state.currentUser.full_name,
        movement_type: 'inventario_inicial',
        quantity: product.stock_current,
        stock_before: 0,
        stock_after: product.stock_current,
        unit_cost: product.cost_price,
        reference_type: 'manual',
        reason: 'Inventario inicial al dar de alta el producto',
        created_at: now,
      };
      if (localDB) await localDB.inventoryMovements.put(initMov);
      newMovements.push(initMov);
    }

    // Si cambió el precio de compra o de venta, registrar en Historial de Precios y Bitácora
    const newPriceHistory: PriceHistoryEntry[] = [];
    const newAuditLogs: AuditLog[] = [];
    if (
      existing &&
      (existing.cost_price !== product.cost_price || existing.sale_price !== product.sale_price)
    ) {
      const phEntry: PriceHistoryEntry = {
        id: uid('ph'),
        branch_id: DEFAULT_BRANCH_ID,
        product_id: product.id,
        product_name: product.name,
        changed_by: state.currentUser.id,
        changed_by_name: state.currentUser.full_name,
        old_cost: existing.cost_price,
        new_cost: product.cost_price,
        old_price: existing.sale_price,
        new_price: product.sale_price,
        reason,
        created_at: now,
      };
      const auditEntry: AuditLog = {
        id: uid('aud'),
        branch_id: DEFAULT_BRANCH_ID,
        user_id: state.currentUser.id,
        user_name: state.currentUser.full_name,
        action: 'CAMBIO_PRECIO',
        entity_type: 'product',
        entity_id: product.id,
        old_data: {
          name: existing.name,
          cost_price: existing.cost_price,
          sale_price: existing.sale_price,
        },
        new_data: {
          name: product.name,
          cost_price: product.cost_price,
          sale_price: product.sale_price,
        },
        reason,
        created_at: now,
      };

      if (localDB) {
        await localDB.priceHistory.put(phEntry);
        await localDB.auditLogs.put(auditEntry);
      }
      newPriceHistory.push(phEntry);
      newAuditLogs.push(auditEntry);
    }

    // Actualizar presentaciones/equivalencias si se proporcionaron
    let updatedPresentations = state.presentations;
    if (presentationsList !== undefined) {
      const filtered = state.presentations.filter((p) => p.product_id !== product.id);
      const createdPres: ProductPresentation[] = presentationsList.map((pres) => ({
        id: uid('pres'),
        product_id: product.id,
        name: pres.name,
        barcode: pres.barcode,
        conversion_factor: Number(pres.conversion_factor) || 1,
        box_cost_price: roundCurrency(Number(pres.box_cost_price) || 0),
        calculated_unit_cost: roundCurrency(
          (Number(pres.box_cost_price) || 0) / Math.max(1, Number(pres.conversion_factor) || 1)
        ),
        presentation_sale_price: pres.presentation_sale_price,
      }));
      if (localDB) {
        const oldIds = state.presentations
          .filter((p) => p.product_id === product.id)
          .map((p) => p.id);
        await localDB.presentations.bulkDelete(oldIds);
        await localDB.presentations.bulkPut(createdPres);
      }
      updatedPresentations = [...filtered, ...createdPres];
    }

    set((curr) => ({
      products: [product, ...curr.products.filter((p) => p.id !== product.id)],
      presentations: updatedPresentations,
      inventoryMovements: [...newMovements, ...curr.inventoryMovements],
      priceHistory: [...newPriceHistory, ...curr.priceHistory],
      auditLogs: [...newAuditLogs, ...curr.auditLogs],
    }));

    return product;
  },

  toggleProductActive: async (productId) => {
    const prod = get().products.find((p) => p.id === productId);
    if (!prod) return;
    const updated = { ...prod, is_active: !prod.is_active, updated_at: new Date().toISOString() };
    if (localDB) await localDB.products.put(updated);
    set((state) => ({
      products: state.products.map((p) => (p.id === productId ? updated : p)),
    }));
  },

  toggleProductFavorite: async (productId) => {
    const prod = get().products.find((p) => p.id === productId);
    if (!prod) return;
    const updated = {
      ...prod,
      is_favorite: !prod.is_favorite,
      updated_at: new Date().toISOString(),
    };
    if (localDB) await localDB.products.put(updated);
    set((state) => ({
      products: state.products.map((p) => (p.id === productId ? updated : p)),
    }));
  },

  addProductBatch: async (batchData) => {
    const batch: ProductBatch = {
      ...batchData,
      id: uid('batch'),
      branch_id: DEFAULT_BRANCH_ID,
      created_at: new Date().toISOString(),
    };
    if (localDB) await localDB.batches.put(batch);
    set((state) => ({ batches: [batch, ...state.batches] }));
  },

  // ==========================================================================
  // INVENTARIO, AJUSTES MANUALES Y CONTEO RÁPIDO
  // ==========================================================================
  registerInventoryAdjustment: async ({
    productId,
    movementType,
    quantity,
    reason,
    unitCost,
  }) => {
    const state = get();
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;

    const now = new Date().toISOString();
    const stockBefore = product.stock_current;
    let delta = roundQuantity(quantity);
    let stockAfter = stockBefore;

    if (movementType === 'conteo_fisico') {
      // En modo conteo físico, 'quantity' representa el conteo físico real
      stockAfter = Math.max(0, roundQuantity(quantity));
      delta = roundQuantity(stockAfter - stockBefore);
    } else if (
      movementType === 'ajuste_merma' ||
      movementType === 'ajuste_caducado' ||
      movementType === 'ajuste_robo' ||
      movementType === 'ajuste_consumo_propio' ||
      movementType === 'salida_venta'
    ) {
      delta = -Math.abs(delta);
      stockAfter = Math.max(0, roundQuantity(stockBefore + delta));
    } else {
      delta = Math.abs(delta);
      stockAfter = roundQuantity(stockBefore + delta);
    }

    const updatedProduct: Product = {
      ...product,
      stock_current: stockAfter,
      updated_at: now,
    };

    const movement: InventoryMovement = {
      id: uid('mov'),
      branch_id: DEFAULT_BRANCH_ID,
      product_id: product.id,
      product_name: product.name,
      user_id: state.currentUser.id,
      user_name: state.currentUser.full_name,
      movement_type: movementType,
      quantity: delta,
      stock_before: stockBefore,
      stock_after: stockAfter,
      unit_cost: unitCost ?? product.cost_price,
      reference_type: movementType === 'conteo_fisico' ? 'count' : 'manual',
      reason: reason.trim(),
      created_at: now,
    };

    const audit: AuditLog = {
      id: uid('aud'),
      branch_id: DEFAULT_BRANCH_ID,
      user_id: state.currentUser.id,
      user_name: state.currentUser.full_name,
      action: 'AJUSTE_INVENTARIO',
      entity_type: 'product',
      entity_id: product.id,
      old_data: { name: product.name, stock_current: stockBefore },
      new_data: { name: product.name, stock_current: stockAfter, movement_type: movementType },
      reason: reason.trim(),
      created_at: now,
    };

    if (localDB) {
      await localDB.products.put(updatedProduct);
      await localDB.inventoryMovements.put(movement);
      await localDB.auditLogs.put(audit);
    }

    set((curr) => ({
      products: curr.products.map((p) => (p.id === product.id ? updatedProduct : p)),
      inventoryMovements: [movement, ...curr.inventoryMovements],
      auditLogs: [audit, ...curr.auditLogs],
    }));
  },

  bulkImportProducts: async (rows) => {
    let count = 0;
    for (const row of rows) {
      if (!row.name) continue;
      await get().saveProduct(
        {
          ...row,
          name: row.name,
          sku: row.sku || `IMP-${Math.floor(1000 + Math.random() * 9000)}`,
          cost_price: Number(row.cost_price) || 0,
          sale_price: Number(row.sale_price) || 10,
        },
        undefined,
        'Importación masiva CSV/Excel'
      );
      count++;
    }
    return count;
  },

  // ==========================================================================
  // CARRITO DE PUNTO DE VENTA (POS)
  // ==========================================================================
  addToCart: (product, customQuantity, overrideSubtotalMXN) => {
    set((state) => {
      const existingIndex = state.cart.findIndex((item) => item.product_id === product.id);
      const qtyToAdd = customQuantity !== undefined ? roundQuantity(customQuantity) : 1;

      if (existingIndex >= 0) {
        const current = state.cart[existingIndex];
        const newQuantity = roundQuantity(current.quantity + qtyToAdd);
        const { unitPrice, isWholesale } = resolveEffectiveUnitPrice({
          regularPrice: product.sale_price,
          wholesalePrice: product.wholesale_price,
          wholesaleMinQty: product.wholesale_min_qty,
          quantity: newQuantity,
        });
        const subtotal =
          overrideSubtotalMXN !== undefined && existingIndex === -1
            ? roundCurrency(overrideSubtotalMXN)
            : roundCurrency(Math.max(0, newQuantity * unitPrice - current.discount));

        const updatedCart = [...state.cart];
        updatedCart[existingIndex] = {
          ...current,
          quantity: newQuantity,
          unit_price: unitPrice,
          is_wholesale: isWholesale,
          subtotal,
          stock_available: product.stock_current,
        };
        return { cart: updatedCart };
      } else {
        const { unitPrice, isWholesale } = resolveEffectiveUnitPrice({
          regularPrice: product.sale_price,
          wholesalePrice: product.wholesale_price,
          wholesaleMinQty: product.wholesale_min_qty,
          quantity: qtyToAdd,
        });
        const subtotal =
          overrideSubtotalMXN !== undefined
            ? roundCurrency(overrideSubtotalMXN)
            : roundCurrency(qtyToAdd * unitPrice);

        const newItem: CartItem = {
          product_id: product.id,
          name: product.name,
          brand: product.brand,
          barcode: product.barcode,
          sku: product.sku,
          sale_unit: product.sale_unit,
          is_weighable: product.is_weighable,
          quantity: qtyToAdd,
          regular_price: product.sale_price,
          wholesale_price: product.wholesale_price,
          wholesale_min_qty: product.wholesale_min_qty,
          unit_price: unitPrice,
          unit_cost: product.cost_price,
          discount: 0,
          is_wholesale: isWholesale,
          subtotal,
          stock_available: product.stock_current,
        };
        return { cart: [...state.cart, newItem] };
      }
    });
  },

  updateCartItemQuantity: (productId, newQty) => {
    if (newQty <= 0) {
      get().removeFromCart(productId);
      return;
    }
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.product_id !== productId) return item;
        const qty = roundQuantity(newQty);
        const { unitPrice, isWholesale } = resolveEffectiveUnitPrice({
          regularPrice: item.regular_price,
          wholesalePrice: item.wholesale_price,
          wholesaleMinQty: item.wholesale_min_qty,
          quantity: qty,
        });
        const subtotal = roundCurrency(Math.max(0, qty * unitPrice - item.discount));
        return {
          ...item,
          quantity: qty,
          unit_price: unitPrice,
          is_wholesale: isWholesale,
          subtotal,
        };
      }),
    }));
  },

  updateCartItemDiscount: (productId, discountMXN) => {
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.product_id !== productId) return item;
        const rawTotal = item.quantity * item.unit_price;
        const validDiscount = roundCurrency(Math.min(rawTotal, Math.max(0, discountMXN)));
        return {
          ...item,
          discount: validDiscount,
          subtotal: roundCurrency(rawTotal - validDiscount),
        };
      }),
    }));
  },

  removeFromCart: (productId) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.product_id !== productId),
    }));
  },

  clearCart: () => {
    set({ cart: [], selectedCustomerId: null, globalDiscount: 0 });
  },

  setSelectedCustomer: (customerId) => {
    set({ selectedCustomerId: customerId });
  },

  setGlobalDiscount: (discountMXN) => {
    set({ globalDiscount: roundCurrency(Math.max(0, discountMXN)) });
  },

  holdCurrentSale: async (note) => {
    const state = get();
    if (state.cart.length === 0) return;
    const held: HeldSale = {
      id: uid('held'),
      branch_id: DEFAULT_BRANCH_ID,
      user_id: state.currentUser.id,
      user_name: state.currentUser.full_name,
      customer_note: note.trim() || `Cliente ${new Date().toLocaleTimeString('es-MX')}`,
      cart_items: state.cart,
      created_at: new Date().toISOString(),
    };
    if (localDB) await localDB.heldSales.put(held);
    set((curr) => ({
      heldSales: [held, ...curr.heldSales],
      cart: [],
      selectedCustomerId: null,
      globalDiscount: 0,
    }));
  },

  resumeHeldSale: async (heldId) => {
    const state = get();
    const held = state.heldSales.find((h) => h.id === heldId);
    if (!held) return;
    if (localDB) await localDB.heldSales.delete(heldId);
    set((curr) => ({
      cart: held.cart_items,
      heldSales: curr.heldSales.filter((h) => h.id !== heldId),
    }));
  },

  deleteHeldSale: async (heldId) => {
    if (localDB) await localDB.heldSales.delete(heldId);
    set((curr) => ({
      heldSales: curr.heldSales.filter((h) => h.id !== heldId),
    }));
  },

  // ==========================================================================
  // COBRO Y PROCESAMIENTO DE VENTA (CON SOPORTE OFFLINE E INVENTARIO)
  // ==========================================================================
  processCheckout: async ({ paymentMethod, cashReceived = 0, customerId }) => {
    const state = get();
    if (state.cart.length === 0) {
      return { ok: false, error: 'El carrito está vacío.' };
    }

    const subtotal = roundCurrency(state.cart.reduce((acc, item) => acc + item.subtotal, 0));
    const discountAmount = roundCurrency(
      state.globalDiscount + state.cart.reduce((acc, item) => acc + item.discount, 0)
    );
    const total = roundCurrency(Math.max(0, subtotal - state.globalDiscount));
    const totalCost = roundCurrency(
      state.cart.reduce((acc, item) => acc + item.quantity * item.unit_cost, 0)
    );

    const targetCustomerId = customerId ?? state.selectedCustomerId;
    const customer = targetCustomerId
      ? state.customers.find((c) => c.id === targetCustomerId)
      : undefined;

    if (paymentMethod === 'fiado') {
      if (!customer) {
        return {
          ok: false,
          error: 'Selecciona un cliente registrado para poder vender a fiado (crédito).',
        };
      }
      if (customer.current_balance + total > customer.credit_limit) {
        return {
          ok: false,
          error: `El cliente ${customer.name} excedería su límite de crédito ($${customer.credit_limit.toFixed(2)} MXN). Saldo actual: $${customer.current_balance.toFixed(2)} MXN.`,
        };
      }
    }

    if (paymentMethod === 'efectivo' && cashReceived < total) {
      return {
        ok: false,
        error: 'El efectivo recibido es menor al total de la venta.',
      };
    }

    const now = new Date().toISOString();
    const datePart = now.slice(0, 10).replace(/-/g, '');
    const seq = String(state.sales.length + 1).padStart(4, '0');
    const folio = `V-${datePart}-${seq}`;
    const saleId = uid('sale');
    const activeShift = state.cashShifts.find((s) => s.status === 'abierta');

    const saleItems: SaleItem[] = state.cart.map((item) => ({
      id: uid('si'),
      sale_id: saleId,
      product_id: item.product_id,
      product_name_snapshot: item.name,
      barcode_snapshot: item.barcode,
      quantity: item.quantity,
      sale_unit: item.sale_unit,
      unit_price: item.unit_price,
      unit_cost: item.unit_cost,
      discount: item.discount,
      is_wholesale: item.is_wholesale,
      subtotal: item.subtotal,
      returned_qty: 0,
    }));

    const sale: Sale = {
      id: saleId,
      branch_id: DEFAULT_BRANCH_ID,
      shift_id: activeShift?.id || null,
      folio,
      user_id: state.currentUser.id,
      user_name: state.currentUser.full_name,
      customer_id: customer?.id || null,
      customer_name: customer?.name || 'Público en General',
      subtotal,
      discount_amount: discountAmount,
      total,
      total_cost: totalCost,
      payment_method: paymentMethod,
      cash_received: paymentMethod === 'efectivo' ? roundCurrency(cashReceived) : total,
      change_given:
        paymentMethod === 'efectivo' ? roundCurrency(Math.max(0, cashReceived - total)) : 0,
      status: 'completada',
      client_sale_uuid: uid('csuuid'),
      synced_to_cloud: state.isOnline && isSupabaseConfigured(),
      items: saleItems,
      created_at: now,
    };

    // 1. Descontar stock y crear movimientos de Kardex
    const updatedProducts = [...state.products];
    const newMovements: InventoryMovement[] = [];

    for (const item of state.cart) {
      const pIdx = updatedProducts.findIndex((p) => p.id === item.product_id);
      if (pIdx >= 0) {
        const prod = updatedProducts[pIdx];
        const stockBefore = prod.stock_current;
        const stockAfter = roundQuantity(Math.max(0, stockBefore - item.quantity));
        const updatedProd: Product = {
          ...prod,
          stock_current: stockAfter,
          last_sale_at: now,
          updated_at: now,
        };
        updatedProducts[pIdx] = updatedProd;
        if (localDB) await localDB.products.put(updatedProd);

        const mov: InventoryMovement = {
          id: uid('mov'),
          branch_id: DEFAULT_BRANCH_ID,
          product_id: prod.id,
          product_name: prod.name,
          user_id: state.currentUser.id,
          user_name: state.currentUser.full_name,
          movement_type: 'salida_venta',
          quantity: -item.quantity,
          stock_before: stockBefore,
          stock_after: stockAfter,
          unit_cost: prod.cost_price,
          reference_type: 'sale',
          reference_id: sale.id,
          reason: `Venta mostrador Folio ${folio}`,
          created_at: now,
        };
        if (localDB) await localDB.inventoryMovements.put(mov);
        newMovements.push(mov);
      }
    }

    // 2. Actualizar turno de caja si está abierto
    let updatedShifts = state.cashShifts;
    if (activeShift) {
      const shiftPatch: CashShift = {
        ...activeShift,
        cash_sales_total:
          paymentMethod === 'efectivo'
            ? roundCurrency(activeShift.cash_sales_total + total)
            : activeShift.cash_sales_total,
        card_sales_total:
          paymentMethod === 'tarjeta'
            ? roundCurrency(activeShift.card_sales_total + total)
            : activeShift.card_sales_total,
        transfer_sales_total:
          paymentMethod === 'transferencia'
            ? roundCurrency(activeShift.transfer_sales_total + total)
            : activeShift.transfer_sales_total,
        credit_sales_total:
          paymentMethod === 'fiado'
            ? roundCurrency(activeShift.credit_sales_total + total)
            : activeShift.credit_sales_total,
        expected_cash:
          paymentMethod === 'efectivo'
            ? roundCurrency(activeShift.expected_cash + total)
            : activeShift.expected_cash,
      };
      if (localDB) await localDB.cashShifts.put(shiftPatch);
      updatedShifts = state.cashShifts.map((s) => (s.id === shiftPatch.id ? shiftPatch : s));
    }

    // 3. Si es venta a Fiado, actualizar saldo del cliente y su estado de cuenta
    let updatedCustomers = state.customers;
    const newLedgerEntries: CustomerLedgerEntry[] = [];
    if (paymentMethod === 'fiado' && customer) {
      const balanceBefore = customer.current_balance;
      const balanceAfter = roundCurrency(balanceBefore + total);
      const updatedCustomer: Customer = {
        ...customer,
        current_balance: balanceAfter,
        updated_at: now,
      };
      const ledgerEntry: CustomerLedgerEntry = {
        id: uid('led'),
        branch_id: DEFAULT_BRANCH_ID,
        customer_id: customer.id,
        customer_name: customer.name,
        user_id: state.currentUser.id,
        user_name: state.currentUser.full_name,
        sale_id: sale.id,
        shift_id: activeShift?.id || null,
        entry_type: 'cargo_fiado',
        payment_method: 'n/a',
        amount: total,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        notes: `Compra a fiado Folio ${folio} (${saleItems.length} productos)`,
        created_at: now,
      };
      if (localDB) {
        await localDB.customers.put(updatedCustomer);
        await localDB.customerLedger.put(ledgerEntry);
      }
      updatedCustomers = state.customers.map((c) =>
        c.id === updatedCustomer.id ? updatedCustomer : c
      );
      newLedgerEntries.push(ledgerEntry);
    }

    // 4. Si estamos Offline o pendientes de nube, agregar a la cola de sincronización
    const newQueueItems: OfflineSyncQueueItem[] = [];
    if (!state.isOnline || !isSupabaseConfigured()) {
      const qItem: OfflineSyncQueueItem = {
        id: uid('sync'),
        action_type: 'CREATE_SALE',
        payload: { sale },
        status: 'pending',
        attempts: 0,
        created_at: now,
      };
      if (localDB) await localDB.syncQueue.put(qItem);
      newQueueItems.push(qItem);
    }

    if (localDB) {
      await localDB.sales.put(sale);
    }

    set((curr) => ({
      sales: [sale, ...curr.sales],
      products: updatedProducts,
      inventoryMovements: [...newMovements, ...curr.inventoryMovements],
      cashShifts: updatedShifts,
      customers: updatedCustomers,
      customerLedger: [...newLedgerEntries, ...curr.customerLedger],
      syncQueue: [...newQueueItems, ...curr.syncQueue],
      cart: [],
      selectedCustomerId: null,
      globalDiscount: 0,
    }));

    return { ok: true, sale };
  },

  cancelOrReturnSale: async ({ saleId, reason }) => {
    const state = get();
    const sale = state.sales.find((s) => s.id === saleId);
    if (!sale) return { ok: false, error: 'Venta no encontrada.' };
    if (sale.status === 'cancelada') {
      return { ok: false, error: 'Esta venta ya fue cancelada previamente.' };
    }

    const now = new Date().toISOString();
    const updatedSale: Sale = {
      ...sale,
      status: 'cancelada',
      cancel_reason: reason.trim(),
      cancelled_by: state.currentUser.id,
      cancelled_at: now,
    };

    // Reintegrar existencias al inventario automáticamente
    const updatedProducts = [...state.products];
    const newMovements: InventoryMovement[] = [];

    for (const item of sale.items) {
      const pIdx = updatedProducts.findIndex((p) => p.id === item.product_id);
      if (pIdx >= 0) {
        const prod = updatedProducts[pIdx];
        const stockBefore = prod.stock_current;
        const stockAfter = roundQuantity(stockBefore + item.quantity);
        const updatedProd: Product = {
          ...prod,
          stock_current: stockAfter,
          updated_at: now,
        };
        updatedProducts[pIdx] = updatedProd;
        if (localDB) await localDB.products.put(updatedProd);

        const mov: InventoryMovement = {
          id: uid('mov'),
          branch_id: DEFAULT_BRANCH_ID,
          product_id: prod.id,
          product_name: prod.name,
          user_id: state.currentUser.id,
          user_name: state.currentUser.full_name,
          movement_type: 'devolucion_venta',
          quantity: item.quantity,
          stock_before: stockBefore,
          stock_after: stockAfter,
          unit_cost: item.unit_cost,
          reference_type: 'return',
          reference_id: sale.id,
          reason: `Cancelación/Devolución Folio ${sale.folio}: ${reason}`,
          created_at: now,
        };
        if (localDB) await localDB.inventoryMovements.put(mov);
        newMovements.push(mov);
      }
    }

    // Si fue venta a fiado, descontar del saldo del cliente
    let updatedCustomers = state.customers;
    const newLedger: CustomerLedgerEntry[] = [];
    if (sale.payment_method === 'fiado' && sale.customer_id) {
      const cust = state.customers.find((c) => c.id === sale.customer_id);
      if (cust) {
        const balBefore = cust.current_balance;
        const balAfter = roundCurrency(Math.max(0, balBefore - sale.total));
        const updatedCust = { ...cust, current_balance: balAfter, updated_at: now };
        const led: CustomerLedgerEntry = {
          id: uid('led'),
          branch_id: DEFAULT_BRANCH_ID,
          customer_id: cust.id,
          customer_name: cust.name,
          user_id: state.currentUser.id,
          user_name: state.currentUser.full_name,
          sale_id: sale.id,
          entry_type: 'ajuste_saldo',
          payment_method: 'n/a',
          amount: sale.total,
          balance_before: balBefore,
          balance_after: balAfter,
          notes: `Cancelación de venta Folio ${sale.folio}: ${reason}`,
          created_at: now,
        };
        if (localDB) {
          await localDB.customers.put(updatedCust);
          await localDB.customerLedger.put(led);
        }
        updatedCustomers = state.customers.map((c) => (c.id === cust.id ? updatedCust : c));
        newLedger.push(led);
      }
    }

    // Actualizar turno de caja si pertenece al turno abierto
    let updatedShifts = state.cashShifts;
    if (sale.shift_id) {
      const shift = state.cashShifts.find((s) => s.id === sale.shift_id);
      if (shift && shift.status === 'abierta') {
        const patchedShift: CashShift = {
          ...shift,
          cash_sales_total:
            sale.payment_method === 'efectivo'
              ? roundCurrency(Math.max(0, shift.cash_sales_total - sale.total))
              : shift.cash_sales_total,
          card_sales_total:
            sale.payment_method === 'tarjeta'
              ? roundCurrency(Math.max(0, shift.card_sales_total - sale.total))
              : shift.card_sales_total,
          transfer_sales_total:
            sale.payment_method === 'transferencia'
              ? roundCurrency(Math.max(0, shift.transfer_sales_total - sale.total))
              : shift.transfer_sales_total,
          credit_sales_total:
            sale.payment_method === 'fiado'
              ? roundCurrency(Math.max(0, shift.credit_sales_total - sale.total))
              : shift.credit_sales_total,
          expected_cash:
            sale.payment_method === 'efectivo'
              ? roundCurrency(Math.max(0, shift.expected_cash - sale.total))
              : shift.expected_cash,
        };
        if (localDB) await localDB.cashShifts.put(patchedShift);
        updatedShifts = state.cashShifts.map((s) => (s.id === shift.id ? patchedShift : s));
      }
    }

    // Registrar en bitácora de auditoría
    const audit: AuditLog = {
      id: uid('aud'),
      branch_id: DEFAULT_BRANCH_ID,
      user_id: state.currentUser.id,
      user_name: state.currentUser.full_name,
      action: 'CANCELACION_VENTA',
      entity_type: 'sale',
      entity_id: sale.id,
      old_data: { folio: sale.folio, total: sale.total, status: 'completada' },
      new_data: { folio: sale.folio, total: sale.total, status: 'cancelada' },
      reason: reason.trim(),
      created_at: now,
    };

    if (localDB) {
      await localDB.sales.put(updatedSale);
      await localDB.auditLogs.put(audit);
    }

    set((curr) => ({
      sales: curr.sales.map((s) => (s.id === saleId ? updatedSale : s)),
      products: updatedProducts,
      inventoryMovements: [...newMovements, ...curr.inventoryMovements],
      customers: updatedCustomers,
      customerLedger: [...newLedger, ...curr.customerLedger],
      cashShifts: updatedShifts,
      auditLogs: [audit, ...curr.auditLogs],
    }));

    return { ok: true };
  },

  // ==========================================================================
  // TURNOS Y CORTE DE CAJA
  // ==========================================================================
  openCashShift: async (openingAmount, notes) => {
    const state = get();
    const now = new Date().toISOString();
    const amount = roundCurrency(Math.max(0, openingAmount));
    const newShift: CashShift = {
      id: uid('shift'),
      branch_id: DEFAULT_BRANCH_ID,
      opened_by: state.currentUser.id,
      opened_by_name: state.currentUser.full_name,
      opened_at: now,
      status: 'abierta',
      opening_amount: amount,
      cash_sales_total: 0,
      card_sales_total: 0,
      transfer_sales_total: 0,
      credit_sales_total: 0,
      cash_in_total: 0,
      cash_out_total: 0,
      expected_cash: amount,
      notes: notes || 'Apertura de turno',
    };

    if (localDB) await localDB.cashShifts.put(newShift);
    set((curr) => ({ cashShifts: [newShift, ...curr.cashShifts] }));
    return newShift;
  },

  registerCashMovement: async ({ type, amount, concept }) => {
    const state = get();
    const activeShift = state.cashShifts.find((s) => s.status === 'abierta');
    if (!activeShift) return;

    const cleanAmount = roundCurrency(Math.max(0, amount));
    const mov: CashMovement = {
      id: uid('cmov'),
      shift_id: activeShift.id,
      branch_id: DEFAULT_BRANCH_ID,
      user_id: state.currentUser.id,
      user_name: state.currentUser.full_name,
      type,
      amount: cleanAmount,
      concept: concept.trim(),
      created_at: new Date().toISOString(),
    };

    const updatedShift: CashShift = {
      ...activeShift,
      cash_in_total:
        type === 'ingreso'
          ? roundCurrency(activeShift.cash_in_total + cleanAmount)
          : activeShift.cash_in_total,
      cash_out_total:
        type === 'egreso'
          ? roundCurrency(activeShift.cash_out_total + cleanAmount)
          : activeShift.cash_out_total,
      expected_cash:
        type === 'ingreso'
          ? roundCurrency(activeShift.expected_cash + cleanAmount)
          : roundCurrency(activeShift.expected_cash - cleanAmount),
    };

    if (localDB) {
      await localDB.cashMovements.put(mov);
      await localDB.cashShifts.put(updatedShift);
    }

    set((curr) => ({
      cashMovements: [mov, ...curr.cashMovements],
      cashShifts: curr.cashShifts.map((s) => (s.id === updatedShift.id ? updatedShift : s)),
    }));
  },

  closeCashShift: async (countedCash, notes) => {
    const state = get();
    const activeShift = state.cashShifts.find((s) => s.status === 'abierta');
    if (!activeShift) throw new Error('No hay caja abierta');

    const now = new Date().toISOString();
    const counted = roundCurrency(Math.max(0, countedCash));
    const difference = roundCurrency(counted - activeShift.expected_cash);

    const closedShift: CashShift = {
      ...activeShift,
      closed_by: state.currentUser.id,
      closed_by_name: state.currentUser.full_name,
      closed_at: now,
      status: 'cerrada',
      counted_cash: counted,
      difference,
      notes: notes || activeShift.notes,
    };

    if (localDB) await localDB.cashShifts.put(closedShift);

    const newAudits: AuditLog[] = [];
    if (Math.abs(difference) > 0.01) {
      const audit: AuditLog = {
        id: uid('aud'),
        branch_id: DEFAULT_BRANCH_ID,
        user_id: state.currentUser.id,
        user_name: state.currentUser.full_name,
        action: 'CORTE_CAJA_DIFERENCIA',
        entity_type: 'cash_shift',
        entity_id: closedShift.id,
        old_data: { expected_cash: activeShift.expected_cash },
        new_data: { counted_cash: counted, difference },
        reason: notes || 'Diferencia en arqueo de cierre de turno',
        created_at: now,
      };
      if (localDB) await localDB.auditLogs.put(audit);
      newAudits.push(audit);
    }

    set((curr) => ({
      cashShifts: curr.cashShifts.map((s) => (s.id === closedShift.id ? closedShift : s)),
      auditLogs: [...newAudits, ...curr.auditLogs],
    }));

    return closedShift;
  },

  // ==========================================================================
  // CLIENTES Y FIADO
  // ==========================================================================
  saveCustomer: async (data) => {
    const state = get();
    const existing = data.id ? state.customers.find((c) => c.id === data.id) : undefined;
    const now = new Date().toISOString();

    const customer: Customer = {
      id: existing?.id || uid('cust'),
      branch_id: DEFAULT_BRANCH_ID,
      name: data.name.trim(),
      phone: data.phone.trim(),
      address: data.address ?? existing?.address ?? '',
      notes: data.notes ?? existing?.notes ?? '',
      credit_limit: roundCurrency(Number(data.credit_limit ?? existing?.credit_limit ?? 1000)),
      current_balance: existing?.current_balance ?? 0,
      last_payment_at: existing?.last_payment_at ?? null,
      is_active: data.is_active ?? existing?.is_active ?? true,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    if (localDB) await localDB.customers.put(customer);
    set((curr) => ({
      customers: [customer, ...curr.customers.filter((c) => c.id !== customer.id)],
    }));
    return customer;
  },

  registerCustomerPayment: async ({ customerId, amount, paymentMethod, notes }) => {
    const state = get();
    const customer = state.customers.find((c) => c.id === customerId);
    if (!customer) return;

    const now = new Date().toISOString();
    const cleanAmount = roundCurrency(Math.min(customer.current_balance, Math.max(0.01, amount)));
    const balanceBefore = customer.current_balance;
    const balanceAfter = roundCurrency(Math.max(0, balanceBefore - cleanAmount));
    const activeShift = state.cashShifts.find((s) => s.status === 'abierta');

    const updatedCustomer: Customer = {
      ...customer,
      current_balance: balanceAfter,
      last_payment_at: now,
      updated_at: now,
    };

    const ledgerEntry: CustomerLedgerEntry = {
      id: uid('led'),
      branch_id: DEFAULT_BRANCH_ID,
      customer_id: customer.id,
      customer_name: customer.name,
      user_id: state.currentUser.id,
      user_name: state.currentUser.full_name,
      shift_id: activeShift?.id || null,
      entry_type: 'abono',
      payment_method: paymentMethod,
      amount: cleanAmount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      notes: notes || `Abono a cuenta (${paymentMethod})`,
      created_at: now,
    };

    if (localDB) {
      await localDB.customers.put(updatedCustomer);
      await localDB.customerLedger.put(ledgerEntry);
    }

    // Si el abono fue en efectivo y hay turno abierto, entra efectivo a caja
    if (paymentMethod === 'efectivo' && activeShift) {
      await get().registerCashMovement({
        type: 'ingreso',
        amount: cleanAmount,
        concept: `Abono de fiado: ${customer.name}`,
      });
    }

    set((curr) => ({
      customers: curr.customers.map((c) => (c.id === customerId ? updatedCustomer : c)),
      customerLedger: [ledgerEntry, ...curr.customerLedger],
    }));
  },

  // ==========================================================================
  // PROVEEDORES, COMPRAS Y GASTOS
  // ==========================================================================
  saveSupplier: async (data) => {
    const state = get();
    const existing = data.id ? state.suppliers.find((s) => s.id === data.id) : undefined;
    const now = new Date().toISOString();

    const supplier: Supplier = {
      id: existing?.id || uid('sup'),
      branch_id: DEFAULT_BRANCH_ID,
      name: data.name.trim(),
      contact_name: (data.contact_name ?? existing?.contact_name ?? '').trim(),
      phone: (data.phone ?? existing?.phone ?? '').trim(),
      email: (data.email ?? existing?.email ?? '').trim(),
      visit_days: data.visit_days ?? existing?.visit_days ?? [],
      notes: data.notes ?? existing?.notes ?? '',
      payable_balance: existing?.payable_balance ?? 0,
      is_active: data.is_active ?? existing?.is_active ?? true,
      created_at: existing?.created_at || now,
    };

    if (localDB) await localDB.suppliers.put(supplier);
    set((curr) => ({
      suppliers: [supplier, ...curr.suppliers.filter((s) => s.id !== supplier.id)],
    }));
    return supplier;
  },

  saveSupplierQuote: async (quoteData) => {
    const state = get();
    const supplier = state.suppliers.find((s) => s.id === quoteData.supplier_id);
    const product = state.products.find((p) => p.id === quoteData.product_id);
    if (!supplier || !product) return;

    const existing = state.supplierQuotes.find(
      (q) => q.supplier_id === supplier.id && q.product_id === product.id
    );

    const quote: SupplierProductQuote = {
      id: existing?.id || uid('sq'),
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      product_id: product.id,
      product_name: product.name,
      supplier_sku: quoteData.supplier_sku || existing?.supplier_sku || product.sku,
      last_cost_price: roundCurrency(quoteData.last_cost_price),
      last_purchase_at: new Date().toISOString(),
      is_preferred: quoteData.is_preferred ?? existing?.is_preferred ?? false,
      notes: quoteData.notes ?? existing?.notes ?? '',
    };

    if (localDB) await localDB.supplierQuotes.put(quote);
    set((curr) => ({
      supplierQuotes: [quote, ...curr.supplierQuotes.filter((q) => q.id !== quote.id)],
    }));
  },

  registerPurchase: async ({
    supplierId,
    folioInvoice,
    paymentStatus,
    paidAmount,
    dueDate,
    payFromCurrentShift,
    notes,
    items,
  }) => {
    const state = get();
    const supplier = state.suppliers.find((s) => s.id === supplierId);
    if (!supplier) throw new Error('Proveedor no encontrado');

    const now = new Date().toISOString();
    const purchaseId = uid('pur');
    const activeShift = state.cashShifts.find((s) => s.status === 'abierta');

    const purchaseItems = items.map((item) => {
      const prod = state.products.find((p) => p.id === item.productId);
      const factor = Math.max(1, Number(item.conversionFactor) || 1);
      const unitsAdded = roundQuantity(item.quantity * factor);
      const subtotal = roundCurrency(unitsAdded * item.unitCost);

      return {
        id: uid('pi'),
        purchase_id: purchaseId,
        product_id: item.productId,
        product_name_snapshot: prod?.name || 'Producto',
        presentation_id: item.presentationId || null,
        conversion_factor: factor,
        quantity: item.quantity,
        units_added_to_stock: unitsAdded,
        unit_cost: roundCurrency(item.unitCost),
        update_product_cost: item.updateProductCost,
        new_sale_price: item.newSalePrice || null,
        expiry_date: item.expiryDate || null,
        batch_number: item.batchNumber || null,
        subtotal,
      };
    });

    const totalAmount = roundCurrency(purchaseItems.reduce((acc, i) => acc + i.subtotal, 0));
    const effectivePaid =
      paymentStatus === 'pagada'
        ? totalAmount
        : paymentStatus === 'pendiente'
          ? 0
          : roundCurrency(Math.min(totalAmount, Math.max(0, paidAmount)));

    const pendingDebt = roundCurrency(Math.max(0, totalAmount - effectivePaid));

    const purchase: Purchase = {
      id: purchaseId,
      branch_id: DEFAULT_BRANCH_ID,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      user_id: state.currentUser.id,
      user_name: state.currentUser.full_name,
      folio_invoice: folioInvoice.trim() || `COMP-${Date.now().toString().slice(-5)}`,
      total_amount: totalAmount,
      paid_amount: effectivePaid,
      payment_status: paymentStatus,
      due_date: dueDate || null,
      paid_from_shift_id: payFromCurrentShift && activeShift ? activeShift.id : null,
      notes,
      items: purchaseItems,
      purchased_at: now,
    };

    // Actualizar stock, costos de productos, lotes y Kardex
    for (const pItem of purchaseItems) {
      const prod = get().products.find((p) => p.id === pItem.product_id);
      if (!prod) continue;

      const stockBefore = prod.stock_current;
      const stockAfter = roundQuantity(stockBefore + pItem.units_added_to_stock);
      const newCost = pItem.update_product_cost ? pItem.unit_cost : prod.cost_price;
      const newSale =
        pItem.new_sale_price && pItem.new_sale_price > 0 ? pItem.new_sale_price : prod.sale_price;

      await get().saveProduct(
        {
          ...prod,
          stock_current: stockAfter,
          cost_price: newCost,
          sale_price: newSale,
          expiry_date: pItem.expiry_date || prod.expiry_date,
          batch_code: pItem.batch_number || prod.batch_code,
        },
        undefined,
        `Compra a proveedor ${supplier.name} (${purchase.folio_invoice})`
      );

      const mov: InventoryMovement = {
        id: uid('mov'),
        branch_id: DEFAULT_BRANCH_ID,
        product_id: prod.id,
        product_name: prod.name,
        user_id: state.currentUser.id,
        user_name: state.currentUser.full_name,
        movement_type: 'entrada_compra',
        quantity: pItem.units_added_to_stock,
        stock_before: stockBefore,
        stock_after: stockAfter,
        unit_cost: pItem.unit_cost,
        reference_type: 'purchase',
        reference_id: purchase.id,
        reason: `Compra a ${supplier.name} Folio ${purchase.folio_invoice}`,
        created_at: now,
      };
      if (localDB) await localDB.inventoryMovements.put(mov);
      set((curr) => ({ inventoryMovements: [mov, ...curr.inventoryMovements] }));

      // Actualizar cotización en el comparador de proveedores
      await get().saveSupplierQuote({
        supplier_id: supplier.id,
        product_id: prod.id,
        last_cost_price: pItem.unit_cost,
        is_preferred: true,
      });

      // Si trae fecha de caducidad, registrar lote
      if (pItem.expiry_date) {
        await get().addProductBatch({
          product_id: prod.id,
          batch_number: pItem.batch_number || `LOT-${purchase.folio_invoice}`,
          expiry_date: pItem.expiry_date,
          quantity_initial: pItem.units_added_to_stock,
          quantity_remaining: pItem.units_added_to_stock,
          unit_cost: pItem.unit_cost,
        });
      }
    }

    // Si quedó saldo por pagar al proveedor, sumarlo a su cuenta por pagar
    if (pendingDebt > 0) {
      const updatedSupplier: Supplier = {
        ...supplier,
        payable_balance: roundCurrency(supplier.payable_balance + pendingDebt),
      };
      if (localDB) await localDB.suppliers.put(updatedSupplier);
      set((curr) => ({
        suppliers: curr.suppliers.map((s) => (s.id === supplier.id ? updatedSupplier : s)),
      }));
    }

    // Si se pagó en efectivo desde la caja actual
    if (payFromCurrentShift && effectivePaid > 0 && activeShift) {
      await get().registerCashMovement({
        type: 'egreso',
        amount: effectivePaid,
        concept: `Pago compra a proveedor ${supplier.name} (${purchase.folio_invoice})`,
      });
    }

    if (localDB) await localDB.purchases.put(purchase);
    set((curr) => ({ purchases: [purchase, ...curr.purchases] }));

    return purchase;
  },

  paySupplierBalance: async ({ supplierId, amount, fromCashShift, notes }) => {
    const state = get();
    const supplier = state.suppliers.find((s) => s.id === supplierId);
    if (!supplier) return;

    const cleanAmount = roundCurrency(Math.min(supplier.payable_balance, Math.max(0.01, amount)));
    const updatedSupplier: Supplier = {
      ...supplier,
      payable_balance: roundCurrency(Math.max(0, supplier.payable_balance - cleanAmount)),
    };

    if (localDB) await localDB.suppliers.put(updatedSupplier);

    if (fromCashShift) {
      await get().registerCashMovement({
        type: 'egreso',
        amount: cleanAmount,
        concept: `Abono a cuenta por pagar: ${supplier.name} ${notes ? `(${notes})` : ''}`,
      });
    }

    set((curr) => ({
      suppliers: curr.suppliers.map((s) => (s.id === supplierId ? updatedSupplier : s)),
    }));
  },

  registerExpense: async (data) => {
    const state = get();
    const activeShift = state.cashShifts.find((s) => s.status === 'abierta');
    const cleanAmount = roundCurrency(data.amount);

    const expense: Expense = {
      ...data,
      id: uid('exp'),
      branch_id: DEFAULT_BRANCH_ID,
      user_id: state.currentUser.id,
      user_name: state.currentUser.full_name,
      shift_id: data.payment_method === 'efectivo_caja' && activeShift ? activeShift.id : null,
      amount: cleanAmount,
      created_at: new Date().toISOString(),
    };

    if (localDB) await localDB.expenses.put(expense);

    if (data.payment_method === 'efectivo_caja' && activeShift) {
      await get().registerCashMovement({
        type: 'egreso',
        amount: cleanAmount,
        concept: `Gasto (${data.category}): ${data.description}`,
      });
    }

    set((curr) => ({ expenses: [expense, ...curr.expenses] }));
    return expense;
  },

  deleteExpense: async (id) => {
    if (localDB) await localDB.expenses.delete(id);
    set((curr) => ({ expenses: curr.expenses.filter((e) => e.id !== id) }));
  },

  // ==========================================================================
  // SINCRONIZACIÓN OFFLINE Y RESPALDO
  // ==========================================================================
  syncPendingOfflineQueue: async () => {
    const state = get();
    const pending = state.syncQueue.filter((q) => q.status === 'pending');
    if (pending.length === 0) return { syncedCount: 0 };

    set({ isSyncing: true });

    let syncedCount = 0;
    const supabase = getSupabaseBrowserClient();

    for (const item of pending) {
      try {
        if (supabase && item.action_type === 'CREATE_SALE') {
          const sale = item.payload.sale as Sale;
          await supabase.from('sales').upsert({
            id: sale.id,
            branch_id: sale.branch_id,
            folio: sale.folio,
            subtotal: sale.subtotal,
            discount_amount: sale.discount_amount,
            total: sale.total,
            total_cost: sale.total_cost,
            payment_method: sale.payment_method,
            cash_received: sale.cash_received,
            change_given: sale.change_given,
            status: sale.status,
            client_sale_uuid: sale.client_sale_uuid,
            created_at: sale.created_at,
          });
        }

        const updatedItem: OfflineSyncQueueItem = {
          ...item,
          status: 'synced',
          attempts: item.attempts + 1,
        };
        if (localDB) await localDB.syncQueue.put(updatedItem);
        syncedCount++;
      } catch (err) {
        const failedItem: OfflineSyncQueueItem = {
          ...item,
          status: 'error',
          attempts: item.attempts + 1,
          error_message: err instanceof Error ? err.message : 'Error de red',
        };
        if (localDB) await localDB.syncQueue.put(failedItem);
      }
    }

    if (localDB) {
      const updatedQueue = await localDB.syncQueue.toArray();
      set({ syncQueue: updatedQueue, isSyncing: false });
    } else {
      set({ isSyncing: false });
    }

    return { syncedCount };
  },

  resetDemoDatabase: async () => {
    if (!localDB) return;
    await localDB.delete();
    await localDB.open();
    await ensureLocalDBSeeded();
    await get().initializeApp();
  },
}));
