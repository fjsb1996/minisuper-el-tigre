-- ============================================================================
-- TIENDA TIGRE - MIGRACIÓN 002: ROW LEVEL SECURITY (RLS) POR ROLES
-- Roles: 'admin' (Dueño), 'encargado' (Inventario/Compras/Reportes), 'cajero' (POS/Consulta)
-- ============================================================================

-- Funciones auxiliares de seguridad
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = true LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_branch_id()
RETURNS UUID AS $$
    SELECT branch_id FROM public.profiles WHERE id = auth.uid() AND is_active = true LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Habilitar RLS en todas las tablas del esquema
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.held_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICAS DE ACCESO POR TABLA
-- ============================================================================

-- 1. Branches: Todos los usuarios activos pueden leer su sucursal; solo Admin edita
CREATE POLICY "Lectura de sucursal para usuarios autenticados"
    ON public.branches FOR SELECT
    USING (id = public.get_my_branch_id() OR public.get_my_role() = 'admin');

CREATE POLICY "Admin administra sucursales"
    ON public.branches FOR ALL
    USING (public.get_my_role() = 'admin');

-- 2. Profiles: Cada usuario ve su perfil y compañeros de sucursal; solo Admin modifica roles
CREATE POLICY "Lectura de perfiles de la sucursal"
    ON public.profiles FOR SELECT
    USING (branch_id = public.get_my_branch_id() OR id = auth.uid());

CREATE POLICY "Admin administra perfiles"
    ON public.profiles FOR ALL
    USING (public.get_my_role() = 'admin');

-- 3. Audit Logs: Todos pueden insertar eventos; solo Admin y Encargado pueden consultar; nadie borra
CREATE POLICY "Insertar bitácora de auditoría"
    ON public.audit_logs FOR INSERT
    WITH CHECK (branch_id = public.get_my_branch_id());

CREATE POLICY "Admin y Encargado leen bitácora"
    ON public.audit_logs FOR SELECT
    USING (branch_id = public.get_my_branch_id() AND public.get_my_role() IN ('admin', 'encargado'));

-- 4. Categorías y Productos: Todos leen; Admin y Encargado crean/editan; Cajero actualiza stock por venta
CREATE POLICY "Lectura de categorías"
    ON public.categories FOR SELECT
    USING (branch_id IS NULL OR branch_id = public.get_my_branch_id());

CREATE POLICY "Admin y Encargado gestionan categorías"
    ON public.categories FOR ALL
    USING (public.get_my_role() IN ('admin', 'encargado'));

CREATE POLICY "Lectura de productos en sucursal"
    ON public.products FOR SELECT
    USING (branch_id = public.get_my_branch_id());

CREATE POLICY "Admin y Encargado gestionan productos"
    ON public.products FOR ALL
    USING (branch_id = public.get_my_branch_id() AND public.get_my_role() IN ('admin', 'encargado'));

CREATE POLICY "Presentaciones lectura general"
    ON public.product_presentations FOR SELECT
    USING (true);

CREATE POLICY "Admin y Encargado gestionan presentaciones"
    ON public.product_presentations FOR ALL
    USING (public.get_my_role() IN ('admin', 'encargado'));

CREATE POLICY "Lotes lectura y gestión en sucursal"
    ON public.product_batches FOR SELECT
    USING (branch_id = public.get_my_branch_id());

CREATE POLICY "Admin y Encargado gestionan lotes"
    ON public.product_batches FOR ALL
    USING (branch_id = public.get_my_branch_id() AND public.get_my_role() IN ('admin', 'encargado'));

CREATE POLICY "Historial de precios visible para Admin y Encargado"
    ON public.price_history FOR SELECT
    USING (branch_id = public.get_my_branch_id() AND public.get_my_role() IN ('admin', 'encargado'));

-- 5. Inventario / Kardex
CREATE POLICY "Lectura de movimientos de inventario"
    ON public.inventory_movements FOR SELECT
    USING (branch_id = public.get_my_branch_id());

CREATE POLICY "Registro de movimientos de inventario"
    ON public.inventory_movements FOR INSERT
    WITH CHECK (branch_id = public.get_my_branch_id());

-- 6. POS, Ventas, Turnos de Caja y Clientes (Cajero, Encargado y Admin operan en su sucursal)
CREATE POLICY "Operación de turnos de caja en sucursal"
    ON public.cash_shifts FOR ALL
    USING (branch_id = public.get_my_branch_id());

CREATE POLICY "Movimientos de caja en sucursal"
    ON public.cash_movements FOR ALL
    USING (branch_id = public.get_my_branch_id());

CREATE POLICY "Ventas en sucursal"
    ON public.sales FOR ALL
    USING (branch_id = public.get_my_branch_id());

CREATE POLICY "Detalle de ventas"
    ON public.sale_items FOR ALL
    USING (true);

CREATE POLICY "Ventas en espera en sucursal"
    ON public.held_sales FOR ALL
    USING (branch_id = public.get_my_branch_id());

CREATE POLICY "Clientes y fiado en sucursal"
    ON public.customers FOR ALL
    USING (branch_id = public.get_my_branch_id());

CREATE POLICY "Movimientos de fiado en sucursal"
    ON public.customer_ledger FOR ALL
    USING (branch_id = public.get_my_branch_id());

-- 7. Proveedores, Compras y Gastos (Solo Admin y Encargado gestionan compras/proveedores)
CREATE POLICY "Lectura de proveedores en sucursal"
    ON public.suppliers FOR SELECT
    USING (branch_id = public.get_my_branch_id());

CREATE POLICY "Admin y Encargado gestionan proveedores"
    ON public.suppliers FOR ALL
    USING (branch_id = public.get_my_branch_id() AND public.get_my_role() IN ('admin', 'encargado'));

CREATE POLICY "Comparador proveedor-producto"
    ON public.supplier_products FOR ALL
    USING (public.get_my_role() IN ('admin', 'encargado'));

CREATE POLICY "Compras a proveedores por Admin y Encargado"
    ON public.purchases FOR ALL
    USING (branch_id = public.get_my_branch_id() AND public.get_my_role() IN ('admin', 'encargado'));

CREATE POLICY "Detalle de compras"
    ON public.purchase_items FOR ALL
    USING (public.get_my_role() IN ('admin', 'encargado'));

CREATE POLICY "Gastos gestionados por Admin y Encargado"
    ON public.expenses FOR ALL
    USING (branch_id = public.get_my_branch_id() AND public.get_my_role() IN ('admin', 'encargado'));
