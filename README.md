# 🐯 Tienda Tigre — Sistema de Administración y Punto de Venta (POS) para Abarrotes

Aplicación web progresiva (**PWA**) completa, **Offline-First** y **Mobile-First**, diseñada para la operación diaria de una tienda de abarrotes, cremería, verdulería y miscelánea en **México (MXN)**.

Permite operar con **una sola mano desde el celular** (usando la cámara como escáner de código de barras con sonido y vibración) y desde **PC en el mostrador** (con lector láser USB/Bluetooth tipo teclado, atajo global `Ctrl+K` e impresora térmica de **58 mm / 80 mm**).

---

## ✨ Características Principales

### 1. Catálogo de Productos y Categorías Jerárquicas
- **9 Categorías iniciales editables + Subcategorías personalizadas**: Bebidas (refrescos, jugos, leches, agua), Golosinas (galletas, botanas/Sabritas, paletas), Abarrotes, Papelería, Verduras y frutas, Carnes, Salchichonería y embutidos, Limpieza/hogar y Otros.
- **Precios independientes**: Precio de compra (costo) y precio de venta con cálculo automático en tiempo real de **margen en `$` y `%`**.
- **Venta a granel / Báscula**: Soporte para piezas, kg, gramos, litros y paquetes. Permite despachar pidiendo por peso (`0.250 kg`) o por importe en pesos (*"deme \$25 pesos de jamón"*).
- **Presentaciones y Equivalencias**: Registra cajas o paquetes (ej. Caja de 24 piezas → pieza) calculando automáticamente el costo unitario.
- **Precio de mayoreo automático** a partir de $X$ unidades.
- **Perecederos**: Fecha de caducidad y control de lotes.
- **Historial automático de cambios de precio** (fecha, usuario, costo/precio anterior y nuevo).

### 2. Escáner de Código de Barras Dual + Open Food Facts
- **Cámara en celular**: Compatible con `EAN-13`, `EAN-8`, `UPC-A`, `UPC-E` y `Code128` con retroalimentación háptica (`navigator.vibrate`) y sonido sintetizado por Web Audio API.
- **Escáner láser USB/Bluetooth en PC**: Detector global de ráfagas HID sin necesidad de hacer clic en un campo de texto.
- **Comportamiento inteligente**:
  - En **POS**: Agrega al carrito o suma +1 si ya estaba.
  - En **Productos**: Si el código existe abre su ficha; si no existe abre el formulario de creación e intenta autocompletar nombre y marca desde **Open Food Facts**.
  - En **Inventario**: Modo **"Conteo Rápido"** para ajustar existencias físicas escaneando anaqueles.

### 3. Inventario, Kardex y Lista de Compras
- **Kardex inmutable** con trazabilidad de entradas por compra, salidas por venta, devoluciones y ajustes manuales (*merma, caducado, robo, consumo propio*) con motivo obligatorio.
- **Valor total del inventario** a precio de costo y a precio de venta.
- **Lista de compras inteligente** agrupada por proveedor según stock mínimo y mejor costo.
- **Importación y exportación masiva** en formato CSV compatible con Excel.

### 4. Punto de Venta (POS) y Control de Caja por Turno
- Métodos de pago: **Efectivo** (con botones rápidos de billetes MXN y cálculo de cambio), **Tarjeta**, **Transferencia** y **Fiado**.
- **Ticket térmico imprimible en 58 mm y 80 mm** o compartible por **WhatsApp**.
- **Ventas en espera** y **Cancelación/Devolución** con reintegro automático al inventario.
- **Apertura y Corte de Caja por turno** con arqueo de efectivo esperado vs. físico contado.

### 5. Clientes y Fiado, Proveedores, Compras, Gastos y Reportes
- **Clientes y Fiado**: Límite de crédito, estado de cuenta, abonos y envío de recordatorio de cobro por **WhatsApp**.
- **Proveedores y Compras**: Días de visita, cuentas por pagar, entrada de facturas que actualiza stock y costos, y **comparador de costos entre proveedores**.
- **Reportes y Dashboard con Recharts**: Cálculo exacto de **Utilidad Neta Real** ($\text{Ventas} - \text{Costo de lo vendido} - \text{Gastos}$).
- **Seguridad y Roles**: `Dueño/Admin`, `Encargado` y `Cajero` con **Row Level Security (RLS)** en PostgreSQL y bitácora de auditoría (`audit_logs`).
- **Modo Offline (IndexedDB + Dexie)** y **Generador de Etiquetas de Anaquel y Códigos Internos**.

---

## 🚀 Instalación y Ejecución Local Paso a Paso

### 1. Requisitos previos
- **Node.js** 18.17 o superior y `npm`.

### 2. Clonar e instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Copia el archivo `.env.example` a `.env.local`:
```bash
cp .env.example .env.local
```
> **Nota:** La aplicación incluye una arquitectura **Híbrida Offline-First**. Si ejecutas `npm run dev` antes de configurar tus credenciales de Supabase, la app iniciará automáticamente con la base de datos local **IndexedDB** precargada con los 31 productos mexicanos de demostración, proveedores, clientes y ventas para que puedas probar todas las funciones de inmediato.

### 4. Iniciar el servidor de desarrollo
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) en tu navegador o celular en la misma red Wi-Fi.

### 5. Ejecutar pruebas automatizadas
```bash
npm test
```

---

## 🗄️ Configuración de Base de Datos en Supabase

1. Crea un nuevo proyecto en [Supabase](https://supabase.com/).
2. Ve al **SQL Editor** de tu proyecto en Supabase y ejecuta en orden:
   - `supabase/migrations/001_initial_schema.sql` (Crea las 20 tablas, índices GIN/Trigram, vistas calculadas y triggers de historial de precios y auditoría).
   - `supabase/migrations/002_rls_policies.sql` (Habilita Row Level Security y políticas para `admin`, `encargado` y `cajero`).
   - `supabase/seed.sql` (Inserta la sucursal Matriz, las 9 categorías + subcategorías, los productos de ejemplo con códigos EAN-13 reales, presentaciones por caja, proveedores y clientes).
3. Copia el `Project URL` y `anon public key` desde **Project Settings → API** en tu archivo `.env.local`.

---

## ☁️ Guía de Despliegue en Vercel

1. Sube este repositorio a **GitHub / GitLab / Bitbucket**.
2. Ingresa a [Vercel](https://vercel.com/) y selecciona **"Add New Project"** importando tu repositorio.
3. En la sección **Environment Variables** de Vercel, agrega las variables de `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_STORE_NAME="Abarrotes El Tigre"`
   - `NEXT_PUBLIC_CURRENCY="MXN"`
4. Haz clic en **Deploy**.
5. **Instalar como App en Celular (PWA)**:
   - Abre la URL de Vercel en Chrome (Android) o Safari (iOS).
   - Selecciona **"Agregar a la pantalla de inicio" / "Instalar aplicación"**.
   - La app se ejecutará a pantalla completa con soporte offline.
