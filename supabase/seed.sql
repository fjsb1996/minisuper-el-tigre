-- ============================================================================
-- TIENDA TIGRE - SEED.SQL (DATOS SEMILLA DE EJEMPLO PARA MÉXICO - MXN)
-- Incluye: Sucursal Matriz, 9 Categorías principales + Subcategorías,
-- Productos reales de abarrotes con códigos EAN-13, productos a granel,
-- presentaciones por caja, lotes perecederos, proveedores, clientes y gastos.
-- ============================================================================

-- 1. Sucursal Principal
INSERT INTO public.branches (id, name, code, address, phone, rfc, currency, tax_rate, printer_width_mm)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Abarrotes y Cremería El Tigre - Matriz',
    'MATRIZ',
    'Av. Insurgentes Sur 412, Col. Roma Sur, CDMX',
    '5512345678',
    'ACT260101MX9',
    'MXN',
    16.00,
    58
) ON CONFLICT (id) DO NOTHING;

-- 2. Categorías Principales
INSERT INTO public.categories (id, branch_id, parent_id, name, slug, icon, color, sort_order) VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NULL, 'Bebidas', 'bebidas', 'CupSoda', '#2563eb', 1),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', NULL, 'Golosinas', 'golosinas', 'Candy', '#db2777', 2),
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NULL, 'Abarrotes', 'abarrotes', 'ShoppingBasket', '#ea580c', 3),
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', NULL, 'Papelería', 'papeleria', 'PencilRuler', '#7c3aed', 4),
    ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', NULL, 'Verduras y frutas', 'verduras-y-frutas', 'Apple', '#16a34a', 5),
    ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', NULL, 'Carnes', 'carnes', 'Beef', '#dc2626', 6),
    ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', NULL, 'Salchichonería y embutidos', 'salchichoneria', 'Sandwich', '#e11d48', 7),
    ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', NULL, 'Limpieza/hogar', 'limpieza-hogar', 'Sparkles', '#0891b2', 8),
    ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', NULL, 'Otros', 'otros', 'Boxes', '#64748b', 9)
ON CONFLICT (id) DO NOTHING;

-- Subcategorías de Bebidas y Golosinas
INSERT INTO public.categories (id, branch_id, parent_id, name, slug, icon, color, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Refrescos', 'refrescos', 'CupSoda', '#2563eb', 1),
    ('11000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Jugos y Néctares', 'jugos', 'GlassWater', '#f59e0b', 2),
    ('11000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Leches sabor y natural', 'leches', 'Milk', '#3b82f6', 3),
    ('11000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Agua natural y mineral', 'agua', 'Droplet', '#06b6d4', 4),
    ('12000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Galletas y Pan Dulce', 'galletas', 'Cookie', '#d97706', 1),
    ('12000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Botanas / Sabritas / Barcel', 'botanas', 'Flame', '#e11d48', 2),
    ('12000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Paletas, Chocolates y Dulces', 'paletas-dulces', 'Candy', '#ec4899', 3)
ON CONFLICT (id) DO NOTHING;

-- 3. Productos de Ejemplo en todas las categorías
INSERT INTO public.products (
    id, branch_id, category_id, subcategory_id, name, brand, barcode, sku,
    sale_unit, is_weighable, is_favorite, cost_price, sale_price,
    wholesale_price, wholesale_min_qty, stock_current, stock_min, location, is_perishable, expiry_date
) VALUES
    -- BEBIDAS
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Coca-Cola Original 600 ml', 'Coca-Cola', '7501055300075', 'BEB-001', 'pieza', false, true, 14.50, 20.00, 18.50, 12, 48, 15, 'Refrigerador 1 - Puerta Izq', false, NULL),
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Coca-Cola Retornable 2.5 L', 'Coca-Cola', '7501055311880', 'BEB-002', 'pieza', false, true, 24.00, 32.00, 30.00, 6, 24, 10, 'Rejas Entrada', false, NULL),
    ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'Jugo Del Valle Mango 413 ml', 'Del Valle', '7501055330423', 'BEB-003', 'pieza', false, false, 11.20, 16.00, 14.50, 12, 18, 8, 'Refrigerador 1 - Puerta Der', false, NULL),
    ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'Leche Alpura Clásica Entera 1 L', 'Alpura', '7501055900039', 'BEB-004', 'litro', false, true, 22.80, 29.00, 27.50, 12, 16, 10, 'Refrigerador Lácteos', true, CURRENT_DATE + INTERVAL '6 days'),
    ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'Leche Hershey''s Chocolate 200 ml', 'Hershey''s', '7501024542031', 'BEB-005', 'pieza', false, false, 9.50, 14.00, 12.50, 24, 30, 10, 'Pasillo 1 - Nivel 3', true, CURRENT_DATE + INTERVAL '45 days'),
    ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000004', 'Agua Bonafont Natural 1.5 L', 'Bonafont', '7501075110052', 'BEB-006', 'pieza', false, true, 10.50, 16.00, 14.00, 12, 35, 12, 'Refrigerador 1 - Abajo', false, NULL),

    -- GOLOSINAS
    ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', 'Sabritas Original Sal 45 g', 'Sabritas', '7501011115590', 'GOL-001', 'pieza', false, true, 13.80, 19.00, NULL, NULL, 22, 8, 'Exhibidor Sabritas', false, NULL),
    ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', 'Doritos Nacho 62 g', 'Sabritas', '7501011131064', 'GOL-002', 'pieza', false, true, 14.50, 20.00, NULL, NULL, 18, 8, 'Exhibidor Sabritas', false, NULL),
    ('20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000001', 'Galletas Emperador Chocolate 109 g', 'Gamesa', '7501000630363', 'GOL-003', 'pieza', false, false, 14.00, 19.00, 17.50, 10, 14, 6, 'Pasillo 2 - Galletas', false, NULL),
    ('20000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000001', 'Gansito Marinela 50 g', 'Marinela', '7501000153107', 'GOL-004', 'pieza', false, true, 12.00, 17.00, NULL, NULL, 15, 6, 'Exhibidor Bimbo/Marinela', true, CURRENT_DATE + INTERVAL '4 days'),
    ('20000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000003', 'Paleta Payaso Ricolino 45 g', 'Ricolino', '7501000266128', 'GOL-005', 'pieza', false, false, 11.50, 17.00, 15.00, 10, 20, 5, 'Mostrador Dulces', false, NULL),

    -- ABARROTES
    ('20000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', NULL, 'Huevo Blanco San Juan (Granel Kg)', 'San Juan', NULL, 'ABA-001', 'kg', true, true, 36.00, 48.00, 45.00, 5, 25.500, 8.000, 'Mostrador Principal', true, CURRENT_DATE + INTERVAL '14 days'),
    ('20000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', NULL, 'Aceite Nutrioli Puro de Soya 850 ml', 'Nutrioli', '7501039121726', 'ABA-002', 'pieza', false, false, 34.50, 44.00, 41.00, 12, 12, 6, 'Pasillo 1 - Aceites', false, NULL),
    ('20000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', NULL, 'Frijol Negro Querétaro (Granel Kg)', 'Verde Valle', NULL, 'ABA-003', 'kg', true, true, 28.00, 38.00, 35.00, 10, 18.250, 5.000, 'Costales Mostrador', false, NULL),
    ('20000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', NULL, 'Atún Dolores en Agua 140 g', 'Dolores', '7501045400013', 'ABA-004', 'pieza', false, false, 16.80, 23.00, 21.00, 12, 4, 10, 'Pasillo 1 - Enlatados', false, NULL),
    ('20000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', NULL, 'Sopa Maruchan Habanero y Camarón 64 g', 'Maruchan', '041789001956', 'ABA-005', 'pieza', false, true, 12.20, 17.00, 15.50, 12, 32, 12, 'Pasillo 1 - Sopas', false, NULL),

    -- PAPELERÍA
    ('20000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', NULL, 'Cuaderno Profesional Scribe Raya 100 Hojas', 'Scribe', '7501058711021', 'PAP-001', 'pieza', false, false, 22.00, 35.00, 31.00, 10, 15, 5, 'Vitrina Papelería', false, NULL),
    ('20000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', NULL, 'Bolígrafo BIC Cristal Punto Mediano Negro', 'BIC', '070330129764', 'PAP-002', 'pieza', false, false, 3.80, 7.00, 5.50, 12, 42, 10, 'Vitrina Papelería', false, NULL),

    -- VERDURAS Y FRUTAS (A GRANEL)
    ('20000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', NULL, 'Jitomate Saladet Fresco', 'Central de Abastos', NULL, 'VER-001', 'kg', true, true, 18.00, 29.00, 25.00, 5, 14.500, 5.000, 'Huacal Verduras 1', true, CURRENT_DATE + INTERVAL '4 days'),
    ('20000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', NULL, 'Aguacate Hass Michoacán', 'Central de Abastos', NULL, 'VER-002', 'kg', true, true, 52.00, 78.00, 70.00, 3, 6.800, 3.000, 'Huacal Verduras 2', true, CURRENT_DATE + INTERVAL '5 days'),
    ('20000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', NULL, 'Cebolla Blanca Limpia', 'Central de Abastos', NULL, 'VER-003', 'kg', true, true, 14.00, 24.00, 20.00, 5, 11.200, 4.000, 'Huacal Verduras 3', true, CURRENT_DATE + INTERVAL '10 days'),

    -- CARNES (A GRANEL)
    ('20000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', NULL, 'Bistec de Res Suadero / Diezmillo', 'Rastro Selecto', NULL, 'CAR-001', 'kg', true, true, 145.00, 198.00, 185.00, 3, 4.250, 2.500, 'Vitrina Carnicería', true, CURRENT_DATE + INTERVAL '2 days'),
    ('20000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', NULL, 'Pechuga de Pollo sin Hueso', 'Bachoco', NULL, 'CAR-002', 'kg', true, true, 98.00, 138.00, 128.00, 3, 5.600, 3.000, 'Vitrina Carnicería', true, CURRENT_DATE + INTERVAL '2 days'),

    -- SALCHICHONERÍA Y EMBUTIDOS (A GRANEL)
    ('20000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', NULL, 'Jamón de Pavo Virginia FUD (Granel Kg)', 'FUD', NULL, 'SAL-001', 'kg', true, true, 128.00, 180.00, 165.00, 2, 3.400, 1.500, 'Vitrina Cremería', true, CURRENT_DATE + INTERVAL '7 days'),
    ('20000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', NULL, 'Salchicha de Pavo Viena FUD (Granel Kg)', 'FUD', NULL, 'SAL-002', 'kg', true, true, 76.00, 110.00, 98.00, 2, 4.100, 2.000, 'Vitrina Cremería', true, CURRENT_DATE + INTERVAL '9 days'),
    ('20000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', NULL, 'Queso Oaxaca Artesanal (Granel Kg)', 'La Vaquita', NULL, 'SAL-003', 'kg', true, true, 115.00, 160.00, 148.00, 2, 2.850, 2.000, 'Vitrina Cremería', true, CURRENT_DATE + INTERVAL '5 days'),

    -- LIMPIEZA Y HOGAR
    ('20000000-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008', NULL, 'Detergente en Polvo Roma 1 kg', 'Roma', '7501026004056', 'LIM-001', 'pieza', false, false, 31.00, 42.00, 39.00, 10, 14, 5, 'Pasillo 3 - Limpieza', false, NULL),
    ('20000000-0000-0000-0000-000000000028', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008', NULL, 'Limpiador Fabuloso Lavanda 1 L', 'Fabuloso', '7501035903029', 'LIM-002', 'litro', false, false, 23.00, 32.00, 29.00, 6, 3, 6, 'Pasillo 3 - Limpieza', false, NULL),
    ('20000000-0000-0000-0000-000000000029', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008', NULL, 'Papel Higiénico Pétalo Rendimax 4 Rollos', 'Pétalo', '7501036621359', 'LIM-003', 'paquete', false, false, 24.50, 34.00, 31.50, 6, 11, 5, 'Pasillo 3 - Papel', false, NULL),

    -- OTROS
    ('20000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009', NULL, 'Encendedor Mini BIC Colores', 'BIC', '070330600065', 'OTR-001', 'pieza', false, true, 9.00, 15.00, 12.50, 10, 28, 10, 'Caja Mostrador', false, NULL),
    ('20000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009', NULL, 'Bolsa de Hielo Cristal 5 kg', 'Cristal', '7501099900059', 'OTR-002', 'paquete', false, true, 18.00, 28.00, NULL, NULL, 9, 4, 'Congelador Exterior', false, NULL)
ON CONFLICT (id) DO NOTHING;

-- 4. Presentaciones / Equivalencias por Caja
INSERT INTO public.product_presentations (product_id, name, barcode, conversion_factor, box_cost_price, presentation_sale_price) VALUES
    ('20000000-0000-0000-0000-000000000001', 'Caja / Reja c/24 botellas 600ml', '17501055300072', 24, 348.00, 444.00),
    ('20000000-0000-0000-0000-000000000004', 'Caja c/12 Tetrapack 1 L', '17501055900036', 12, 273.60, 330.00),
    ('20000000-0000-0000-0000-000000000016', 'Caja c/12 Sopas Vaso 64g', '10041789001953', 12, 146.40, 186.00);

-- 5. Proveedores
INSERT INTO public.suppliers (id, branch_id, name, contact_name, phone, email, visit_days, notes, payable_balance) VALUES
    ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Coca-Cola FEMSA', 'Roberto Méndez (Preventa)', '5541228890', 'preventa.sur@femsa.com.mx', ARRAY['Lunes', 'Miércoles', 'Viernes'], 'Dejar envases vacíos listos a las 8:00 AM', 0),
    ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Grupo Bimbo / Marinela / Ricolino', 'Carlos Estrada', '5539887123', 'carlos.estrada@grupobimbo.com', ARRAY['Martes', 'Jueves', 'Sábado'], 'Recibe cambio de producto caducado pieza por pieza', 850.00),
    ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Sabritas y Gamesa (PepsiCo)', 'Luis Hernández', '5581129034', 'luis.hernandez@pepsico.com', ARRAY['Martes', 'Viernes'], 'Revisión de tiraje en exhibidor principal', 0),
    ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Distribuidora Zorro Abarrotero / Mayorista', 'Ventas Mostrador', '5555110022', 'contacto@zorroabarrotero.com.mx', ARRAY['Lunes', 'Jueves'], 'Mayorista para abarrotes, enlatados y limpieza', 1420.00),
    ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Sigma Alimentos (FUD / Lácteos / Carnes)', 'Miguel Ángel Torres', '5577665544', 'mtorres@sigma-alimentos.com', ARRAY['Miércoles', 'Sábado'], 'Entrega refrigerada antes de las 10:00 AM', 640.00)
ON CONFLICT (id) DO NOTHING;

-- 6. Clientes y Cuentas de Fiado
INSERT INTO public.customers (id, branch_id, name, phone, address, notes, credit_limit, current_balance) VALUES
    ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Doña Martha Gómez (Depa 4B)', '525511223344', 'Tonalá 128 Int. 4B, Roma Sur', 'Liquida puntualmente cada quincena', 1500.00, 385.50),
    ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Maestro Jorge Ramírez (Taller Mecánico)', '525599887766', 'Bajío 305, Local B', 'Pide refrescos y botanas para los trabajadores los viernes', 1000.00, 620.00),
    ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Sra. Elena Vázquez', '525544332211', 'Monterrey 210', 'Cliente frecuente de verdura y cremería', 800.00, 0.00)
ON CONFLICT (id) DO NOTHING;
