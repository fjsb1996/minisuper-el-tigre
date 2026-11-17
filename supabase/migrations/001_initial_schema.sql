-- ============================================================================
-- TIENDA TIGRE - MIGRACIÓN 001: ESQUEMA COMPLETO, ÍNDICES Y TRIGGERS
-- Base de datos: PostgreSQL (Supabase)
-- Moneda: MXN | Idioma: es-MX | Soporte Multi-Sucursal Nativo
-- ============================================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 1. TIPOS ENUMERADOS (ENUMS)
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'encargado', 'cajero');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE sale_unit_type AS ENUM ('pieza', 'kg', 'gramo', 'litro', 'paquete');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE inventory_movement_type AS ENUM (
        'inventario_inicial',
        'entrada_compra',
        'salida_venta',
        'devolucion_venta',
        'ajuste_merma',
        'ajuste_caducado',
        'ajuste_robo',
        'ajuste_consumo_propio',
        'conteo_fisico'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM ('efectivo', 'tarjeta', 'transferencia', 'fiado', 'mixto');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE sale_status_type AS ENUM ('completada', 'cancelada', 'devuelta_parcial');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE shift_status_type AS ENUM ('abierta', 'cerrada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE expense_category_type AS ENUM (
        'luz', 'renta', 'sueldos', 'transporte', 'mantenimiento', 'bolsas_insumos', 'impuestos', 'otros'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================================
-- 2. ORGANIZACIÓN, SUCURSALES, USUARIOS Y BITÁCORA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT,
    phone TEXT,
    rfc TEXT,
    currency TEXT NOT NULL DEFAULT 'MXN',
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 16.00,
    ticket_header TEXT DEFAULT '¡Gracias por su preferencia!',
    ticket_footer TEXT DEFAULT 'Revise su mercancía y su cambio antes de salir.',
    printer_width_mm INTEGER NOT NULL DEFAULT 58 CHECK (printer_width_mm IN (58, 80)),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'cajero',
    pin_code TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT,
    action TEXT NOT NULL, -- 'CAMBIO_PRECIO', 'AJUSTE_INVENTARIO', 'CANCELACION_VENTA', 'CORTE_DIFERENCIA', etc.
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_data JSONB,
    new_data JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. CATÁLOGO DE CATEGORÍAS Y PRODUCTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'Package',
    color TEXT DEFAULT '#ea580c',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    brand TEXT,
    description TEXT,
    photo_url TEXT,
    barcode TEXT,
    sku TEXT NOT NULL,
    sale_unit sale_unit_type NOT NULL DEFAULT 'pieza',
    is_weighable BOOLEAN NOT NULL DEFAULT false,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    sale_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
    -- Columnas calculadas para margen en $ y %
    profit_amount NUMERIC(12,2) GENERATED ALWAYS AS (sale_price - cost_price) STORED,
    profit_margin_pct NUMERIC(8,2) GENERATED ALWAYS AS (
        CASE WHEN cost_price > 0 THEN ROUND(((sale_price - cost_price) / cost_price) * 100, 2) ELSE 100 END
    ) STORED,
    wholesale_price NUMERIC(12,2) CHECK (wholesale_price IS NULL OR wholesale_price >= 0),
    wholesale_min_qty NUMERIC(12,3) CHECK (wholesale_min_qty IS NULL OR wholesale_min_qty > 0),
    stock_current NUMERIC(12,3) NOT NULL DEFAULT 0,
    stock_min NUMERIC(12,3) NOT NULL DEFAULT 5,
    location TEXT,
    is_perishable BOOLEAN NOT NULL DEFAULT false,
    expiry_date DATE,
    batch_code TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sale_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Presentaciones / Equivalencias (ej. Caja de 24 piezas -> pieza)
CREATE TABLE IF NOT EXISTS public.product_presentations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Ej: 'Caja c/24 pzas', 'Reja c/12', 'Paquete c/6'
    barcode TEXT,
    conversion_factor NUMERIC(12,3) NOT NULL CHECK (conversion_factor > 0),
    box_cost_price NUMERIC(12,2) NOT NULL CHECK (box_cost_price >= 0),
    calculated_unit_cost NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(box_cost_price / conversion_factor, 2)) STORED,
    presentation_sale_price NUMERIC(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lotes y Fechas de Caducidad para perecederos (Lácteos, Carnes, Verduras, Salchichonería)
CREATE TABLE IF NOT EXISTS public.product_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    expiry_date DATE NOT NULL,
    quantity_initial NUMERIC(12,3) NOT NULL CHECK (quantity_initial > 0),
    quantity_remaining NUMERIC(12,3) NOT NULL CHECK (quantity_remaining >= 0),
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historial de cambios de precio de compra y venta
CREATE TABLE IF NOT EXISTS public.price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    changed_by_name TEXT DEFAULT 'Sistema / Admin',
    old_cost NUMERIC(12,2) NOT NULL,
    new_cost NUMERIC(12,2) NOT NULL,
    old_price NUMERIC(12,2) NOT NULL,
    new_price NUMERIC(12,2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. INVENTARIO Y KARDEX
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES public.product_batches(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT DEFAULT 'Admin',
    movement_type inventory_movement_type NOT NULL,
    quantity NUMERIC(12,3) NOT NULL, -- Positivo entrada, Negativo salida
    stock_before NUMERIC(12,3) NOT NULL,
    stock_after NUMERIC(12,3) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    reference_type TEXT, -- 'sale', 'purchase', 'manual', 'count'
    reference_id TEXT,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. CLIENTES Y CUENTA DE FIADO
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    notes TEXT,
    credit_limit NUMERIC(12,2) NOT NULL DEFAULT 1000.00,
    current_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    last_payment_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. CAJA, TURNOS Y PUNTO DE VENTA (POS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cash_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    opened_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    opened_by_name TEXT,
    closed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    closed_by_name TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    status shift_status_type NOT NULL DEFAULT 'abierta',
    opening_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    cash_sales_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    card_sales_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    transfer_sales_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    credit_sales_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    cash_in_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    cash_out_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    expected_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
    counted_cash NUMERIC(12,2),
    difference NUMERIC(12,2),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_id UUID NOT NULL REFERENCES public.cash_shifts(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT,
    type TEXT NOT NULL CHECK (type IN ('ingreso', 'egreso')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    concept TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES public.cash_shifts(id) ON DELETE SET NULL,
    folio TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_method payment_method_type NOT NULL DEFAULT 'efectivo',
    cash_received NUMERIC(12,2) DEFAULT 0,
    change_given NUMERIC(12,2) DEFAULT 0,
    status sale_status_type NOT NULL DEFAULT 'completada',
    cancel_reason TEXT,
    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ,
    client_sale_uuid TEXT UNIQUE, -- Idempotencia para ventas Offline sincronizadas
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name_snapshot TEXT NOT NULL,
    barcode_snapshot TEXT,
    quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
    sale_unit sale_unit_type NOT NULL DEFAULT 'pieza',
    unit_price NUMERIC(12,2) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_wholesale BOOLEAN NOT NULL DEFAULT false,
    subtotal NUMERIC(12,2) NOT NULL,
    returned_qty NUMERIC(12,3) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.held_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer_note TEXT NOT NULL,
    cart_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    shift_id UUID REFERENCES public.cash_shifts(id) ON DELETE SET NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('cargo_fiado', 'abono', 'ajuste_saldo')),
    payment_method TEXT DEFAULT 'efectivo',
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    balance_before NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. PROVEEDORES, COMPRAS Y GASTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    visit_days TEXT[] DEFAULT '{}',
    notes TEXT,
    payable_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplier_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    supplier_sku TEXT,
    last_cost_price NUMERIC(12,2) NOT NULL CHECK (last_cost_price >= 0),
    last_purchase_at TIMESTAMPTZ DEFAULT NOW(),
    is_preferred BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    UNIQUE(supplier_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    supplier_name TEXT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT,
    folio_invoice TEXT NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'pagada' CHECK (payment_status IN ('pagada', 'pendiente', 'parcial')),
    due_date DATE,
    paid_from_shift_id UUID REFERENCES public.cash_shifts(id) ON DELETE SET NULL,
    notes TEXT,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name_snapshot TEXT,
    presentation_id UUID REFERENCES public.product_presentations(id) ON DELETE SET NULL,
    quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
    update_product_cost BOOLEAN NOT NULL DEFAULT true,
    new_sale_price NUMERIC(12,2),
    expiry_date DATE,
    batch_number TEXT,
    subtotal NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT,
    shift_id UUID REFERENCES public.cash_shifts(id) ON DELETE SET NULL,
    category expense_category_type NOT NULL DEFAULT 'otros',
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'efectivo_externo' CHECK (
        payment_method IN ('efectivo_caja', 'efectivo_externo', 'transferencia', 'tarjeta')
    ),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. ÍNDICES DE RENDIMIENTO
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_branch_barcode
    ON public.products (branch_id, barcode)
    WHERE barcode IS NOT NULL AND barcode <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_branch_sku
    ON public.products (branch_id, sku);

CREATE INDEX IF NOT EXISTS idx_products_category
    ON public.products (branch_id, category_id);

CREATE INDEX IF NOT EXISTS idx_products_search_trgm
    ON public.products USING gin ((name || ' ' || COALESCE(brand, '') || ' ' || COALESCE(sku, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_date
    ON public.inventory_movements (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_batches_expiry
    ON public.product_batches (branch_id, expiry_date ASC)
    WHERE quantity_remaining > 0;

CREATE INDEX IF NOT EXISTS idx_sales_branch_date
    ON public.sales (branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_date
    ON public.customer_ledger (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_branch_date
    ON public.expenses (branch_id, expense_date DESC);

-- ============================================================================
-- 9. TRIGGERS AUTOMÁTICOS (HISTORIAL DE PRECIOS Y AUDITORÍA)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_log_product_price_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.cost_price IS DISTINCT FROM NEW.cost_price) OR (OLD.sale_price IS DISTINCT FROM NEW.sale_price) THEN
        INSERT INTO public.price_history (
            branch_id, product_id, changed_by, old_cost, new_cost, old_price, new_price, reason
        ) VALUES (
            NEW.branch_id, NEW.id, auth.uid(), OLD.cost_price, NEW.cost_price, OLD.sale_price, NEW.sale_price, 'Actualización de catálogo/compra'
        );

        INSERT INTO public.audit_logs (
            branch_id, user_id, action, entity_type, entity_id, old_data, new_data, reason
        ) VALUES (
            NEW.branch_id,
            auth.uid(),
            'CAMBIO_PRECIO',
            'product',
            NEW.id::TEXT,
            jsonb_build_object('cost_price', OLD.cost_price, 'sale_price', OLD.sale_price, 'name', OLD.name),
            jsonb_build_object('cost_price', NEW.cost_price, 'sale_price', NEW.sale_price, 'name', NEW.name),
            'Cambio de costo o precio de venta'
        );
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_product_price_change ON public.products;
CREATE TRIGGER trg_product_price_change
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_log_product_price_change();
