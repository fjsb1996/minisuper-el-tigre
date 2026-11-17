// ============================================================================
// TIENDA TIGRE - BASE DE DATOS LOCAL INDEXEDDB (DEXIE) + COLA OFFLINE
// Permite operación instantánea en celular/PC con o sin internet y
// sincronización automática con Supabase cuando vuelve la conexión.
// ============================================================================

import Dexie, { type Table } from 'dexie';
import {
  AuditLog,
  Branch,
  CashMovement,
  CashShift,
  Category,
  Customer,
  CustomerLedgerEntry,
  Expense,
  HeldSale,
  InventoryMovement,
  OfflineSyncQueueItem,
  PriceHistoryEntry,
  Product,
  ProductBatch,
  ProductPresentation,
  Purchase,
  Sale,
  Supplier,
  SupplierProductQuote,
  UserProfile,
} from '@/types/database';
import {
  SEED_AUDIT_LOGS,
  SEED_BATCHES,
  SEED_BRANCH,
  SEED_CASH_SHIFTS,
  SEED_CATEGORIES,
  SEED_CUSTOMER_LEDGER,
  SEED_CUSTOMERS,
  SEED_EXPENSES,
  SEED_INVENTORY_MOVEMENTS,
  SEED_PRESENTATIONS,
  SEED_PRICE_HISTORY,
  SEED_PRODUCTS,
  SEED_PURCHASES,
  SEED_SALES,
  SEED_SUPPLIER_QUOTES,
  SEED_SUPPLIERS,
  SEED_USERS,
} from './seed-data';

export class TiendaTigreLocalDB extends Dexie {
  branches!: Table<Branch, string>;
  users!: Table<UserProfile, string>;
  categories!: Table<Category, string>;
  products!: Table<Product, string>;
  presentations!: Table<ProductPresentation, string>;
  batches!: Table<ProductBatch, string>;
  priceHistory!: Table<PriceHistoryEntry, string>;
  inventoryMovements!: Table<InventoryMovement, string>;
  cashShifts!: Table<CashShift, string>;
  cashMovements!: Table<CashMovement, string>;
  sales!: Table<Sale, string>;
  heldSales!: Table<HeldSale, string>;
  customers!: Table<Customer, string>;
  customerLedger!: Table<CustomerLedgerEntry, string>;
  suppliers!: Table<Supplier, string>;
  supplierQuotes!: Table<SupplierProductQuote, string>;
  purchases!: Table<Purchase, string>;
  expenses!: Table<Expense, string>;
  auditLogs!: Table<AuditLog, string>;
  syncQueue!: Table<OfflineSyncQueueItem, string>;

  constructor() {
    super('TiendaTigrePosDB_v1');

    this.version(1).stores({
      branches: 'id, code',
      users: 'id, email, role, branch_id',
      categories: 'id, parent_id, slug, sort_order, branch_id',
      products: 'id, barcode, sku, category_id, subcategory_id, name, is_favorite, is_active, branch_id',
      presentations: 'id, product_id, barcode',
      batches: 'id, product_id, expiry_date, branch_id',
      priceHistory: 'id, product_id, created_at, branch_id',
      inventoryMovements: 'id, product_id, movement_type, created_at, branch_id',
      cashShifts: 'id, status, opened_at, branch_id',
      cashMovements: 'id, shift_id, type, created_at',
      sales: 'id, folio, shift_id, customer_id, status, created_at, client_sale_uuid, branch_id',
      heldSales: 'id, created_at, branch_id',
      customers: 'id, name, phone, current_balance, branch_id',
      customerLedger: 'id, customer_id, entry_type, created_at, branch_id',
      suppliers: 'id, name, payable_balance, branch_id',
      supplierQuotes: 'id, supplier_id, product_id, [supplier_id+product_id]',
      purchases: 'id, supplier_id, payment_status, purchased_at, branch_id',
      expenses: 'id, category, expense_date, shift_id, branch_id',
      auditLogs: 'id, action, entity_type, created_at, branch_id',
      syncQueue: 'id, status, action_type, created_at',
    });
  }
}

export const localDB = typeof window !== 'undefined' ? new TiendaTigreLocalDB() : null;

let seedPromise: Promise<void> | null = null;

/**
 * Inicializa IndexedDB con los datos semilla si la base local está vacía
 */
export async function ensureLocalDBSeeded(): Promise<void> {
  if (!localDB) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const productCount = await localDB.products.count();
    if (productCount > 0) return;

    await localDB.transaction(
      'rw',
      [
        localDB.branches,
        localDB.users,
        localDB.categories,
        localDB.products,
        localDB.presentations,
        localDB.batches,
        localDB.priceHistory,
        localDB.inventoryMovements,
        localDB.cashShifts,
        localDB.sales,
        localDB.customers,
        localDB.customerLedger,
        localDB.suppliers,
        localDB.supplierQuotes,
        localDB.purchases,
        localDB.expenses,
        localDB.auditLogs,
      ],
      async () => {
        await localDB.branches.put(SEED_BRANCH);
        await localDB.users.bulkPut(SEED_USERS);
        await localDB.categories.bulkPut(SEED_CATEGORIES);
        await localDB.products.bulkPut(SEED_PRODUCTS);
        await localDB.presentations.bulkPut(SEED_PRESENTATIONS);
        await localDB.batches.bulkPut(SEED_BATCHES);
        await localDB.priceHistory.bulkPut(SEED_PRICE_HISTORY);
        await localDB.inventoryMovements.bulkPut(SEED_INVENTORY_MOVEMENTS);
        await localDB.cashShifts.bulkPut(SEED_CASH_SHIFTS);
        await localDB.sales.bulkPut(SEED_SALES);
        await localDB.customers.bulkPut(SEED_CUSTOMERS);
        await localDB.customerLedger.bulkPut(SEED_CUSTOMER_LEDGER);
        await localDB.suppliers.bulkPut(SEED_SUPPLIERS);
        await localDB.supplierQuotes.bulkPut(SEED_SUPPLIER_QUOTES);
        await localDB.purchases.bulkPut(SEED_PURCHASES);
        await localDB.expenses.bulkPut(SEED_EXPENSES);
        await localDB.auditLogs.bulkPut(SEED_AUDIT_LOGS);
      }
    );
  })();

  return seedPromise;
}
