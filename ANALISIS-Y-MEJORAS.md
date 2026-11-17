# Análisis técnico y plan de mejoras — Tienda Tigre POS

**Fecha:** 13 de noviembre de 2026
**Alcance:** todo el repositorio (`src/`, `supabase/`, `public/`, configuración y pruebas).
**Método:** lectura completa de las 13 rutas, 6 componentes, store, capa Dexie, SQL (migraciones + seed), PWA y configuración; verificación de compilación y de la lógica de precios; auditorías paralelas de UI y de infraestructura.

**Estado verificado**
- `npx tsc --noEmit` → **0 errores** (con `strict: true`).
- `npm test` (Vitest) → **no pudo ejecutarse en este entorno** (el sandbox bloquea el spawn de esbuild, `EPERM`); se replicaron las 11 aserciones de `formatters` contra el módulo real: **11/11 correctas**.
- No hay repositorio Git ni `.gitignore`; `node_modules/`, `.next/` y `tsconfig.tsbuildinfo` viven dentro de la carpeta.

---

## 1. Resumen ejecutivo

Tienda Tigre es una **PWA de punto de venta para abarrotes** construida con Next.js 14 (App Router), TypeScript estricto, Zustand, Dexie/IndexedDB y Supabase opcional: 14 rutas, ~14 300 líneas de código propio en 31 archivos, 21 tablas SQL con RLS, escáner dual (cámara + lector HID), venta a granel, fiado, compras, gastos, reportes y ticket térmico.

**Veredicto:** es un **MVP funcional y muy completo en alcance** —la profundidad del modelo de dominio sorprende para un proyecto de este tamaño— pero **todavía no está listo para operar dinero real en una tienda**. Los cuatro bloqueantes no son de "pulido":

1. **La identidad y los roles son decorativos.** Cualquiera entra como dueño sin contraseña.
2. **La "nube" no existe.** Las ventas hechas con internet nunca llegan a Supabase y la app dice "Sincronizado".
3. **La contabilidad de caja e inventario se desvía.** Pagos mixtos se registran como efectivo, el arqueo viene precargado con lo esperado y se puede vender sin existencia.
4. **El dato vive en un solo lugar y sin red de seguridad.** IndexedDB + un seed de demostración que se resembra solo + respaldo que solo exporta + esquema local sin migraciones.

Lo bueno: la arquitectura elegida es la correcta para el problema (offline-first, MXN, móvil), el esquema SQL está bien pensado y la lógica pura de precios/márgenes/granel ya está aislada y probada. **No haría un rewrite**: haría una cirugía por fases sobre esta base.

| Prioridad | Tema | Riesgo si no se corrige |
|---|---|---|
| P0 | Autenticación, roles y guardas de ruta | Cualquiera cobra, borra caja o descarga la cartera de fiado |
| P0 | Cobro (mixto, doble submit, folio, stock, arqueo) | Faltantes de caja ficticios, ventas duplicadas, inventario irrecuperable |
| P0 | Sincronización y respaldo | Pérdida total del historial al limpiar el navegador |
| P1 | RLS por operación y rol | Fuga de costos entre sucursales; cajero puede borrar ventas |
| P1 | Fechas y reportes | "Hoy" no es hoy; la caja de la tarde desaparece del corte |
| P2 | Mantenibilidad (store/páginas monolito, duplicación) | Cada cambio cuesta más y rompe otra pantalla |

---

## 2. Lo que está bien hecho (y conviene preservar)

- **Modelo de dominio rico y correcto en lo conceptual:** kardex inmutable, lotes y caducidades, presentaciones con equivalencias caja→pieza, precio de mayoreo por cantidad, venta a granel bidireccional (peso o importe en pesos), fiado con ledger de saldos antes/después, compras con cuenta por pagar y gastos con origen de efectivo.
- **SQL con decisiones acertadas:** dinero y cantidades en `NUMERIC(12,2)/(12,3)` (nunca `float`), `profit_amount`/`profit_margin_pct` y `calculated_unit_cost` como columnas generadas, unicidad de `barcode`/`sku` por sucursal con índice parcial, índices GIN/trigram para búsqueda, RLS habilitada en **las 21 tablas** (el problema son las políticas, no la activación).
- **Offline-first real, no simulada:** Dexie con 20 tablas espejo, cola de sincronización, PWA instalable, service worker registrado, escáner de cámara con feedback háptico/sonoro y lector USB/Bluetooth sin foco.
- **Lógica financiera pura y testeable:** `formatters.ts` concentra redondeo monetario, márgenes, granel, mayoreo y EAN-13 interno, con pruebas unitarias (11 aserciones correctas).
- **Validación con Zod y mensajes en es-MX** en los seis formularios principales (producto, categoría, inventario, cliente, proveedor, gasto).
- **UX de mostrador cuidada:** atajos F3–F12 y Alt+letra, productos favoritos, ventas en espera, reimpresión de ticket, ticket 58/80 mm y compartir por WhatsApp, verificador de precios.

---

## 3. Bloqueantes (P0)

### 3.1 Autenticación y roles decorativos

**Evidencia:** `src/lib/store/useTiendaStore.ts:327-353`, `src/app/login/page.tsx:13-14,39-44`, `src/components/layout/AppShell.tsx:422-437`, `src/app/configuracion/page.tsx:57-71,403-419`.

- `loginWithEmail()` **solo compara el correo** contra la lista local; si Supabase no está configurado (modo por defecto) la contraseña nunca se valida.
- El formulario arranca con `admin@tiendatigre.mx` / `tigre2026` ya escritos, y hay botones de "acceso rápido por rol" que inician sesión como admin con un clic.
- El header permite **cambiar de usuario con un `<select>`** sin PIN ni contraseña; `pin_code` existe en el modelo pero **no se valida en ningún punto de la app**.
- No hay `middleware.ts` ni guarda por ruta: las rutas de administración solo se ocultan del menú, no se bloquean. Cualquiera puede abrir `/configuracion` y descargar el respaldo completo (clientes, saldos, usuarios) o "restaurar datos semilla" y borrar la operación.

**Por qué importa:** es un POS que maneja efectivo y crédito de clientes. Sin identidad real no hay control de caja, ni límites de crédito confiables, ni no repudiación: la bitácora la escribe el propio cliente y es falsificable.

**Corrección:** Supabase Auth obligatorio (o PIN verificado en servidor con `pgcrypto`), `switchUserRole` con credencial, guarda de rutas por rol en layout/middleware, `canManage` en configuración, y excluir `pin_code`/PII del respaldo.

### 3.2 La sincronización con Supabase no existe

**Evidencia:** `src/lib/store/useTiendaStore.ts:1100-1111`, `:1783-1840`, `src/lib/supabase/client.ts`, `supabase/migrations/001_initial_schema.sql:299-313`.

- Solo hay **dos** llamadas a Supabase en todo el proyecto: `signInWithPassword` y un `sales.upsert` dentro de la cola.
- Si hay red, la venta **no se encola y tampoco se envía**: se marca `synced_to_cloud: true` sin escribir nada.
- El `upsert` envía **solo la cabecera** (sin líneas, sin `user_id`, sin `customer_id`, sin `shift_id`). `sale_items` nunca se llena.
- **Los errores de PostgREST se ignoran** (`supabase-js` no lanza: devuelve `{ error }`), así que un rechazo por RLS o por folio duplicado se marca como `synced`.
- No hay descarga (*pull*), ni reconciliación, ni resolución de conflictos, ni reintento de los ítems en `error`, ni soporte de los otros 4 `action_type` declarados.
- No hay login/sesión de Supabase en el flujo real, por lo que las políticas RLS nunca se ejercitan desde la app.

**Por qué importa:** con dos cajas o una tablet y una PC, **cada dispositivo tiene su propio catálogo y su propio stock**; no hay forma de consolidar. Y si el navegador borra sus datos (o se reinstala la PWA), se pierde el historial completo. El indicador "Sincronizado" del sidebar (`AppShell.tsx:276-282`) es, hoy, una afirmación falsa.

**Corrección:** patrón *outbox* transaccional (encolar siempre, también online), escritura por RPC `security definer` que inserte venta + líneas + kardex en una transacción, `client_sale_uuid` como clave de idempotencia, pull incremental por `updated_at`, backoff con límite de intentos, y estado de sincronización visible y honesto.

### 3.3 Integridad del dinero y de la caja

| # | Hallazgo | Evidencia | Consecuencia |
|---|---|---|---|
| a | Pagos mixtos se registran como **efectivo por el total** (efectivo+tarjeta+vales) | `pos/page.tsx:286-311`, `useTiendaStore.ts:978-981,1035-1055` | El corte espera en cajón dinero que entró por tarjeta: **faltante ficticio** exactamente igual al cobro con tarjeta |
| b | El **efectivo contado** del corte se precarga con el esperado | `caja/page.tsx:52-55,143-149` | El cajero solo confirma: la diferencia siempre es $0.00. El arqueo deja de detectar faltantes |
| c | **Doble submit** del cobro (botón sin `disabled`, sin guarda de reentrada) | `pos/page.tsx:872-879`, `:307` | Venta y salida de stock duplicadas; el folio se calcula con `sales.length + 1`, así que **ambas llevan el mismo folio** |
| d | `expected_cash` y totales del turno se mantienen **incrementalmente a mano** | `useTiendaStore.ts:1035-1055,1247-1250` | Cualquier camino no previsto (mixto, cancelación, borrado) lo desincroniza sin reconciliación |
| e | Borrar un gasto **no revierte** su movimiento de caja | `useTiendaStore.ts:1775-1778` | El efectivo esperado queda reducido para siempre |
| f | Cancelar una venta de un turno **ya cerrado** no ajusta el corte histórico | `useTiendaStore.ts:1226-1255` | El corte archivado y la realidad divergen |
| g | Descuento global sin tope sobre el subtotal | `pos/page.tsx:103-110`, `useTiendaStore.ts:854-856` | Un 0 de más deja el ticket en $0, descuenta stock y no deja motivo auditado |
| h | Se puede cobrar **sin turno de caja abierto** | `useTiendaStore.ts:947,968` | Esa venta nunca entra a ningún corte |

**Corrección:** desglose por método en la venta (efectivo/tarjeta/transferencia/fiado con importes), `cashReceived` = solo el efectivo, `expected_cash` **derivado** (vista o trigger, nunca incremental), idempotencia por `client_sale_uuid` y `disabled` durante el cobro, campo de conteo vacío, reversos simétricos al borrar/cancelar, y turno obligatorio para cobrar.

### 3.4 Inventario: se puede vender lo que no hay

**Evidencia:** `useTiendaStore.ts:993-1028`, `:733-772`, `pos/page.tsx:182-191`, `pos/WeighableItemModal.tsx`.

- `addToCart` guarda `stock_available` pero **nadie lo usa** para bloquear.
- En el cobro: `stockAfter = Math.max(0, stockBefore - quantity)` → con stock 2 y venta de 5 se graba `quantity: -5`, `stock_before: 2`, `stock_after: 0`: el renglón del kardex **no cumple** `stock_after - stock_before = quantity`.
- Los **lotes nunca se consumen** en la venta: `quantity_remaining` no baja, así que perecederos y FEFO no funcionan de verdad.
- No hay unicidad local de `barcode`/`sku` (Dexie no declara índice único) ni validación en `saveProduct`: se pueden crear duplicados y el escáner cobra el primero.
- La importación CSV usa `line.split(',')` (rompe nombres con comas) y sustituye valores inválidos por defectos silenciosos (`costo || 10`): una importación puede reescribir precios y existencias sin aviso.
- La generación masiva de códigos internos es determinista desde 101: la segunda tanda repite EAN y asigna el mismo código a otro producto.

**Corrección:** validar cantidad ≤ existencia (o confirmar venta sin stock registrando la diferencia como merma), `CHECK (stock_current >= 0)` y `CHECK (stock_after - stock_before = quantity)` en SQL, consumir lotes por caducidad, parser CSV real con vista previa y validación Zod, y secuencia persistida para códigos internos.

### 3.5 Durabilidad del dato

- **Un solo almacén:** IndexedDB. El respaldo (`configuracion/page.tsx:86-120`) **solo exporta JSON**; no hay importación/restauración ni copia automática.
- **El seed demo se auto-instala:** `ensureLocalDBSeeded()` siembra 31 productos y ventas de demostración en **cualquier** base vacía (`db.ts:107-158`). Si el usuario limpia datos del sitio o cambia de navegador, la tienda "renace" con catálogo y ventas falsas, y el turno de caja de demostración aparece **abierto** con $1 962.50 esperados.
- **Dexie está en `version(1)` sobre una base llamada `..._v1`:** añadir un índice o campo obliga a borrar la base (perdiendo ventas locales no sincronizadas) porque no hay plan de migración.
- **Sin Git, sin `.gitignore`, sin CI:** no hay revisión de cambios ni forma de volver atrás; `node_modules` y `.next` están en el árbol (y en OneDrive).
- El seed de demostración tiene inconsistencias verificadas: `total_cost` declarado no cuadra con la suma de sus líneas en 2 ventas, el kardex no cuadra con el stock de `prod-019` y un cargo de fiado de $620 apunta a una venta de otro cliente de $124.

**Corrección:** respaldo **y restauración** (JSON versionado + exportación periódica), seed explícito (`modo demo` o primer arranque sin datos), migraciones Dexie versionadas con `upgrade()`, y Git + CI desde hoy.

---

## 4. Seguridad de datos en Supabase (P1)

La RLS está **habilitada** en todas las tablas, pero las políticas no resisten una revisión:

1. **`sale_items` abierta a `anon`:** `FOR ALL USING (true)` (`002_rls_policies.sql:130-132`). Cualquiera con la anon key (va en el bundle) puede leer costos de todas las sucursales y borrar líneas de venta.
2. **`product_presentations` abierta a `anon`:** `FOR SELECT USING (true)` (`002:88-90`) expone costos de caja.
3. **El cajero puede `UPDATE`/`DELETE`** ventas, turnos, movimientos de caja, clientes, fiado y ventas en espera (`002:118-144`): puede cambiar totales, borrar un turno con diferencia o alterar límites de crédito.
4. **Funciones `SECURITY DEFINER` sin `SET search_path`** (`002:7-15`, `001:457-483`): riesgo de *shadowing* de `profiles` y escalada de privilegios.
5. **No hay bootstrap de `profiles`:** ninguna migración crea el trigger `handle_new_user` y el seed no inserta usuarios; al desplegar, `get_my_role()` devuelve `NULL` y **todas las políticas niegan** — la app "no ve nada".
6. **El cajero ve costos:** `SELECT` sin restricción de columnas y `productos/page.tsx:646` los pinta sin gate de rol (solo se oculta la edición).
7. **Auditoría falsificable:** `audit_logs` se inserta desde el cliente y sin validar `user_id = auth.uid()`; no hay triggers de auditoría para ventas/caja/inventario.
8. **Falta `CHECK` de integridad numérica** (`stock_current >= 0`, `total >= 0`, `returned_qty <= quantity`), `expected_cash` sin reconciliación, y `ON DELETE CASCADE` desde `branches` que borraría el histórico contable.
9. **Web:** sin CSP ni cabeceras de seguridad (`next.config.mjs`), `images.remotePatterns` abierto a `**`, y Next **14.2.21** con CVEs conocidas (p. ej. CVE-2025-29927, corregida en 14.2.25).

**Corrección prioritaria:** políticas por operación y por rol (`SELECT/INSERT/UPDATE/DELETE` separadas, `TO authenticated`, filtro de sucursal), `SET search_path` en todas las funciones, trigger de alta de perfil con promoción documentada a admin, vista pública de productos sin costos, y triggers de auditoría en servidor.

---

## 5. Exactitud de reportes (P1)

- **"Hoy" no es hoy:** `src/app/page.tsx:50-61` toma la **venta más reciente** como referencia y aplica una ventana de 24 h desde ahí. Con los datos demo, "HOY" muestra ventas de hace días.
- **Utilidad neta mal calculada:** los ingresos se filtran por periodo pero **los gastos no** (`page.tsx:71-74`): se restan gastos de todo el histórico.
- **Zona horaria:** las fechas se comparan por `created_at.slice(0,10)` (UTC) y los filtros se inicializan con `toISOString()` (`reportes/page.tsx:32-43`, `gastos/page.tsx:30-32`, `productos/page.tsx:171`). En México (UTC−6) **todo lo vendido después de las 18:00 cae en el día siguiente**: el corte y el reporte de utilidad pierden la caja de la tarde.
- **Pestañas desalineadas:** en reportes, "Por Cliente" y "Por Proveedor" listan el universo completo mientras los KPIs sí están filtrados por fecha (`reportes/page.tsx:456,484`).
- **Etiquetas engañosas:** en proveedores el "Margen" es en realidad *markup* sobre costo (`proveedores/page.tsx:421-424`), y el CSV de reportes exporta siempre el reporte por producto aunque el usuario esté en otra pestaña.

**Corrección:** un helper único de fechas locales (`America/Mexico_City`), filtros `startOfDay/endOfDay` sobre un rango explícito, gastos filtrados por `expense_date` dentro del mismo rango, y `marginOnSalePct` etiquetado correctamente.

---

## 6. Mantenibilidad y rendimiento (P2)

**Arquitectura**
- `useTiendaStore.ts` tiene **1 688 líneas** y mezcla persistencia, reglas de negocio, auditoría y sincronización en un solo objeto. No es testeable sin navegador.
- Páginas monolito: `productos` 1 460 líneas, `inventario` 1 048, `pos` 1 047, cada una con su tabla, sus modales, su exportación y su lógica.
- **377 colores hex hardcodeados** en 15 archivos; no hay tokens de diseño ni componentes compartidos: 10 tablas escritas a mano, **21 modales** `fixed inset-0` copiados (0 con `role="dialog"`, solo 3 cierran con Escape), 3 exportaciones CSV/print duplicadas, **8 búsquedas de código de barras** con criterios distintos (unas filtran `is_active`, otras no; unas normalizan mayúsculas, otras no).
- **16 llamadas a `useTiendaStore()` sin selector:** cualquier cambio (escanear un producto) re-renderiza el shell completo, la tabla y todos los hijos; además provoca que la **cámara se reinicie en cada re-render** porque los callbacks se pasan como flechas nuevas.
- `seed-data.ts` (1 952 líneas) se importa desde el store y desde Dexie: **el catálogo demo viaja en el bundle principal** de todas las rutas.
- El store carga **todas** las ventas, movimientos y bitácora a memoria en cada arranque, sin paginación ni virtualización: en una tablet barata con un año de historial será el cuello de botella.
- **Duplicación de lógica de dinero** entre UI y store (`cartTotal` en POS vs `processCheckout`), lo que ya produce divergencias (granel por importe, descuentos).

**Calidad de proceso**
- **Sin ESLint** aunque existe `npm run lint` (y dos `eslint-disable` que referencian reglas no instaladas); sin Prettier; sin CI.
- **Pruebas:** 6 casos, todos de `formatters`. Sin tests del store, del cobro, de la cola offline ni de RLS; Vitest en entorno `node` (no puede montar componentes) y sin cobertura.
- **Dependencias sin uso:** `date-fns`, `react-hook-form`, `@zxing/library`, `dexie-react-hooks`, `class-variance-authority`.
- **Detalles que delatan falta de verificación en navegador:** clases Tailwind inexistentes en v3 (`h-15`, `py-0.2`, `shadow-xs`, `shadow-2xs`, `backdrop-blur-xs`), botón "Guardar borrador (F11)" que solo lanza un toast sin guardar nada, `window.prompt`/`window.confirm` para capturas críticas, `userScalable: false` que impide el zoom (WCAG 1.4.4), y un `Intl.NumberFormat` nuevo por cada importe formateado.

---

## 7. Plan de mejora propuesto

Ordenado por **riesgo evitado / esfuerzo**. No propongo reescribir: la base es buena y el dominio ya está modelado.

### Fase 0 — Bloqueantes (≈1 semana)
1. **Identidad real:** PIN/contraseña validados, eliminar el selector de rol del header y los accesos rápidos, guarda de rutas por rol, `canManage` en configuración. *Por qué:* sin esto ningún otro control es creíble.
2. **Cobro correcto:** desglose de métodos, `cashReceived` solo efectivo, `disabled` + idempotencia, tope de descuento, turno obligatorio. *Por qué:* es el dinero que se cuenta cada noche.
3. **Verdad en pantalla:** quitar/renombrar el indicador "Sincronizado"; mostrar "Solo en este dispositivo" hasta que exista sync real.
4. **Respaldo y restauración** (export + import JSON versionado) y **seed solo en modo demo**. *Por qué:* hoy un "borrar datos del sitio" destruye la operación.
5. **Higiene:** `git init` + `.gitignore` + CI (`tsc`, `test`, `lint`), ESLint, y actualizar Next a 14.2.31+.

### Fase 1 — Integridad y nube (2–3 semanas)
6. **Outbox transaccional + RPC de venta** (cabecera + líneas + kardex + turno en una transacción), idempotencia por `client_sale_uuid`, pull incremental, reintentos con backoff y UI del estado de la cola.
7. **`expected_cash` derivado** (vista o trigger), reversos simétricos, y arqueo con conteo vacío.
8. **Stock y lotes:** bloquear sobreventa, `CHECK` en SQL, FEFO al vender, unicidad local de barcode/SKU.
9. **RLS por operación y rol**, `search_path` fijo, bootstrap de `profiles`, triggers de auditoría, vista de productos sin costos.
10. **Fechas locales** en toda la app y reportes cuadrados.

### Fase 2 — Estructura (3–4 semanas)
11. **Dividir el store** en slices por dominio (`catalog`, `sales`, `cash`, `credit`, `inventory`) + **repositorios** (`LocalRepository`/`CloudRepository`) y **funciones de dominio puras** testables (`buildSale`, `applyPayment`, `computeShiftTotals`).
12. **Sistema de UI mínimo:** `Modal`, `ConfirmDialog`, `DataTable` (paginada/virtualizada), `KpiCard`, `MoneyInput`, `EmptyState`, `StatusBadge`, `exportCSV()`, `useDateRange()`, `useCheckout()`, `findProductByCode()`. Elimina ~60 % del JSX duplicado y los 377 hex.
13. **Selectores de Zustand** (`useShallow`) y `useCallback`/refs en los modales de cámara.
14. **Seed fuera del bundle** (JSON en `public/`, carga diferida, solo en demo) y paginación del historial.
15. **Pruebas:** `fake-indexeddb` + `jsdom`, tests de `processCheckout`, `cancelOrReturnSale`, `syncPendingOfflineQueue`, arqueo y fiado; pgTAP para RLS; Playwright para "abrir caja → vender mixto → cortar" offline y online.

### Fase 3 — Producto (después)
16. Facturación/SAT si el negocio lo pide (hoy no hay CFDI ni propinas), multi-sucursal real (hoy `DEFAULT_BRANCH_ID` está hardcodeado en el store), impresión ESC/POS nativa (hoy es `window.print()` con CSS), roles granulares, telemetría de errores, y facturación recurrente/analítica avanzada.

### Criterios de aceptación de las fases 0–1
- `tsc`, `lint` y `test` en verde en CI; 0 hallazgos críticos abiertos.
- Un cajero **no puede** abrir configuración, ver costos, cambiar de rol ni cancelar ventas ajenas.
- Venta mixta de $100 ($40 efectivo + $60 tarjeta) → `cash_sales_total` = 40 y arqueo con $40 esperados.
- Vender 5 con stock 2 → bloqueado (o confirmación explícita) y kardex coherente.
- Dos dispositivos: venta en uno aparece en el otro tras sincronizar; al limpiar datos del navegador se restaura desde respaldo.
- Reporte "Hoy" a las 21:00 incluye la venta de las 20:55.

---

## 8. Victorias rápidas (medio día, alto retorno)

1. `disabled` en el botón de cobro y guarda de reentrada en `handleConfirmCheckout`.
2. Vaciar el campo de efectivo contado en el corte.
3. Quitar el `<select>` de usuario del header; exigir credencial en `/login`.
4. Confirmaciones en acciones destructivas (baja de producto, borrar gasto/categoría, cancelar venta F4, vaciar carrito).
5. Eliminar el falso "Guardar borrador" o implementarlo.
6. `max={cartSubtotal}` en el descuento.
7. `findProductByCode()` único (normaliza y filtra activos).
8. `Intl.NumberFormat` a nivel de módulo y `Map` de productos con `useMemo` en reportes.
9. Corregir clases Tailwind inválidas (`h-15`→`h-14`, `shadow-xs`→`shadow-sm`…).
10. Quitar `userScalable: false` y las 5 dependencias sin uso.

---

## 9. Conclusión

El proyecto demuestra criterio: eligió el stack correcto para una tienda mexicana sin infraestructura, modeló el dominio con inusual detalle y mantuvo el tipado estricto sin deuda de `any`. Lo que falta no es "más funcionalidades", sino **convertir la demo en un sistema confiable**: identidad real, sincronización real, caja que cuadre y un dato que no se pierda.

Si hubiera que elegir **tres** cosas: (1) autenticación y roles, (2) cobro/arqueo correctos e idempotentes, (3) respaldo-restauración o sync real. Con esas tres, el resto del plan es mejora incremental sin riesgo de reescritura.

---

### Anexo: índice de evidencia principal

| Tema | Archivos |
|---|---|
| Auth/roles | `useTiendaStore.ts:318-353`, `login/page.tsx:13-44`, `AppShell.tsx:422-437` |
| Cobro y caja | `pos/page.tsx:275-321,713-881`, `useTiendaStore.ts:900-1131,1293-1412`, `caja/page.tsx:52-97` |
| Inventario | `useTiendaStore.ts:626-728,990-1028`, `inventario/page.tsx:356-386`, `db.ts:73-96` |
| Sync | `useTiendaStore.ts:1783-1840`, `supabase/client.ts`, `types/database.ts:398-406` |
| RLS/esquema | `001_initial_schema.sql`, `002_rls_policies.sql` |
| Reportes | `page.tsx:44-146`, `reportes/page.tsx:32-82,456-484` |
| PWA/config | `public/sw.js`, `public/manifest.json`, `next.config.mjs`, `layout.tsx` |
| Pruebas | `src/__tests__/pricing-and-inventory.test.ts`, `vitest.config.ts` |
