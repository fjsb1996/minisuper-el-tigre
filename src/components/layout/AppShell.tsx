'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Boxes,
  Calculator,
  Camera,
  Cloud,
  CloudOff,
  FilePlus,
  FileText,
  FolderTree,
  Home,
  LogOut,
  Menu,
  Moon,
  Package,
  RefreshCw,
  ScanBarcode,
  Search,
  Settings,
  ShoppingCart,
  Sun,
  Tag,
  Truck,
  UserCircle2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import { GlobalCommandK } from './GlobalCommandK';
import { CameraScannerModal } from '@/components/scanner/CameraScannerModal';
import { toast } from 'sonner';
import { formatMXN } from '@/lib/utils/formatters';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const {
    isInitialized,
    initializeApp,
    isOnline,
    setOnlineStatus,
    currentUser,
    users,
    switchUserRole,
    cart,
    clearCart,
    products,
    addToCart,
    cashShifts,
  } = useTiendaStore();

  const [isCommandKOpen, setIsCommandKOpen] = useState(false);
  const [isQuickScannerOpen, setIsQuickScannerOpen] = useState(false);
  const [isPriceCheckerOpen, setIsPriceCheckerOpen] = useState(false);
  const [priceCheckQuery, setPriceCheckQuery] = useState('');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOnlineStatus(navigator.onLine);
    initializeApp();

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const handleOnline = () => {
      setOnlineStatus(true);
      toast.success('Conexión restablecida.');
    };
    const handleOffline = () => {
      setOnlineStatus(false);
      toast.warning('Modo Offline activado.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandKOpen((prev) => !prev);
      } else if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        router.push('/productos?nuevo=1');
      } else if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setIsPriceCheckerOpen(true);
      } else if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        clearCart();
        router.push('/pos');
        toast.info('Nueva venta lista');
      } else if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        router.push('/caja?accion=retiro');
      } else if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        router.push('/caja?accion=corte');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [initializeApp, setOnlineStatus, router, clearCart]);

  const lowStockCount = products.filter(
    (p) => p.is_active && p.stock_current <= p.stock_min
  ).length;
  const activeShift = cashShifts.find((s) => s.status === 'abierta');

  const mainMenuItems = [
    { label: 'Inicio', href: '/', icon: Home, roles: ['admin', 'encargado', 'cajero'] },
    { label: 'Ventas', href: '/pos', icon: ShoppingCart, roles: ['admin', 'encargado', 'cajero'] },
    { label: 'Artículos', href: '/productos', icon: Package, roles: ['admin', 'encargado', 'cajero'] },
    { label: 'Categorías', href: '/categorias', icon: FolderTree, roles: ['admin', 'encargado'] },
    { label: 'Clientes / Fiado', href: '/clientes', icon: Users, roles: ['admin', 'encargado', 'cajero'] },
  ].filter((i) => i.roles.includes(currentUser.role));

  const adminMenuItems = [
    { label: 'Caja', href: '/caja', icon: Calculator, roles: ['admin', 'encargado', 'cajero'] },
    { label: 'Inventario', href: '/inventario', icon: Boxes, roles: ['admin', 'encargado'] },
    { label: 'Compras', href: '/compras', icon: ArrowLeftRight, roles: ['admin', 'encargado'] },
    { label: 'Proveedores', href: '/proveedores', icon: Truck, roles: ['admin', 'encargado'] },
    { label: 'Gastos', href: '/gastos', icon: Wallet, roles: ['admin', 'encargado'] },
    { label: 'Finanzas y Reportes', href: '/reportes', icon: BarChart3, roles: ['admin', 'encargado'] },
    { label: 'Etiquetas', href: '/etiquetas', icon: Tag, roles: ['admin', 'encargado'] },
    { label: 'Configuración', href: '/configuracion', icon: Settings, roles: ['admin', 'encargado'] },
  ].filter((i) => i.roles.includes(currentUser.role));

  const handleGlobalQuickScan = (barcode: string) => {
    const found = products.find((p) => p.barcode === barcode || p.sku === barcode);
    if (found) {
      addToCart(found, 1);
      toast.success(`${found.name} (${formatMXN(found.sale_price)}) agregado a la venta`);
      if (pathname !== '/pos') {
        router.push('/pos');
      }
    } else {
      toast.info(`Código ${barcode} no registrado. Abriendo registro de artículo...`);
      router.push(`/productos?nuevoCodigo=${encodeURIComponent(barcode)}`);
    }
  };

  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (!mounted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f1f5f9] text-slate-800">
        <img
          src="/logo-el-tigre.png"
          alt="Mini-Súper EL TIGRE"
          className="h-16 w-auto object-contain"
        />
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin text-[#0066cc]" />
          Iniciando Mini-Súper EL TIGRE...
        </div>
      </div>
    );
  }

  const checkedProducts = priceCheckQuery.trim()
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(priceCheckQuery.toLowerCase()) ||
            p.sku.toLowerCase().includes(priceCheckQuery.toLowerCase()) ||
            (p.barcode && p.barcode.includes(priceCheckQuery.trim()))
        )
        .slice(0, 5)
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-[#eef2f6] text-slate-800 dark:bg-zinc-950 dark:text-zinc-100 lg:flex-row">
      {/* ===================================================================== */}
      {/* SIDEBAR MINIMALISTA ESTILO ZINDEY (Cabecera Azul + Cuerpo Oscuro)     */}
      {/* ===================================================================== */}
      <aside className="hidden w-52 shrink-0 flex-col bg-[#2b2d30] text-slate-200 shadow-lg lg:flex">
        {/* Cabecera Azul Brillante con Logo Oficial Sin Fondo */}
        <Link
          href="/pos"
          className="flex h-20 items-center justify-center bg-gradient-to-r from-[#0077d8] to-[#0055a5] px-2.5 shadow-sm"
        >
          <div className="flex w-full items-center justify-center rounded-xl bg-white/95 px-2.5 py-1.5 shadow-md transition hover:bg-white">
            <img
              src="/logo-el-tigre.png"
              alt="Mini-Súper EL TIGRE"
              className="h-12 w-auto object-contain"
            />
          </div>
        </Link>

        {/* Menú Principal y Administración */}
        <nav className="flex-1 space-y-5 overflow-y-auto py-4">
          <div>
            <p className="mb-1.5 px-4 text-[11px] font-semibold text-slate-400">
              Menú principal
            </p>
            <div className="space-y-0.5">
              {mainMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-[#e8f0f8] text-[#005bb5]'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-[#0066cc]' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 px-4 text-[11px] font-semibold text-slate-400">
              Administración
            </p>
            <div className="space-y-0.5">
              {adminMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-[#e8f0f8] text-[#005bb5]'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-[#0066cc]' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Estado de Red Minimalista */}
        <div className="border-t border-white/10 p-3 text-[11px] text-slate-400">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              {isOnline ? (
                <Cloud className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <CloudOff className="h-3.5 w-3.5 text-amber-400" />
              )}
              {isOnline ? 'Sincronizado' : 'Modo Offline'}
            </span>
            <span className="font-mono text-[10px]">
              {activeShift ? 'CAJA-01' : 'CERRADA'}
            </span>
          </div>
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* ÁREA DERECHA: BARRA SUPERIOR DE ACCIONES RÁPIDAS + CONTENIDO          */}
      {/* ===================================================================== */}
      <div className="flex flex-1 flex-col pb-16 lg:pb-0">
        {/* Top Action Ribbon Minimalista */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
          {/* Izquierda: Menú Móvil + 5 Accesos Rápidos con Atajos Alt */}
          <div className="flex items-center gap-1 sm:gap-3 md:gap-5">
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden dark:border-zinc-700 dark:text-zinc-200"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => router.push('/productos?nuevo=1')}
              className="group flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 transition hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              <FilePlus className="h-5 w-5 text-sky-600 transition-transform group-hover:scale-105" />
              <span className="mt-1 text-xs font-extrabold text-[#005bb5] dark:text-sky-400">
                Agregar Artículo
              </span>
              <span className="hidden text-[10px] font-semibold text-slate-400 sm:block">
                Alt+A
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPriceCheckQuery('');
                setIsPriceCheckerOpen(true);
              }}
              className="group flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 transition hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              <ScanBarcode className="h-5 w-5 text-sky-600 transition-transform group-hover:scale-105" />
              <span className="mt-1 text-xs font-extrabold text-[#005bb5] dark:text-sky-400">
                Consultar Precio
              </span>
              <span className="hidden text-[10px] font-semibold text-slate-400 sm:block">
                Alt+C
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                clearCart();
                router.push('/pos');
                toast.info('Lista para nueva venta');
              }}
              className="group hidden flex-col items-center justify-center rounded-lg px-2.5 py-1.5 transition hover:bg-slate-100 sm:flex dark:hover:bg-zinc-800"
            >
              <ShoppingCart className="h-5 w-5 text-sky-600 transition-transform group-hover:scale-105" />
              <span className="mt-1 text-xs font-extrabold text-[#005bb5] dark:text-sky-400">
                Nueva Venta
              </span>
              <span className="text-[10px] font-semibold text-slate-400">Alt+V</span>
            </button>

            <button
              type="button"
              onClick={() => router.push('/caja')}
              className="group hidden flex-col items-center justify-center rounded-lg px-2.5 py-1.5 transition hover:bg-slate-100 md:flex dark:hover:bg-zinc-800"
            >
              <Wallet className="h-5 w-5 text-sky-600 transition-transform group-hover:scale-105" />
              <span className="mt-1 text-xs font-extrabold text-[#005bb5] dark:text-sky-400">
                Retirar Efectivo
              </span>
              <span className="text-[10px] font-semibold text-slate-400">Alt+R</span>
            </button>

            <button
              type="button"
              onClick={() => router.push('/caja')}
              className="group hidden flex-col items-center justify-center rounded-lg px-2.5 py-1.5 transition hover:bg-slate-100 md:flex dark:hover:bg-zinc-800"
            >
              <FileText className="h-5 w-5 text-sky-600 transition-transform group-hover:scale-105" />
              <span className="mt-1 text-xs font-extrabold text-[#005bb5] dark:text-sky-400">
                Nuevo Corte
              </span>
              <span className="text-[10px] font-semibold text-slate-400">Alt+T</span>
            </button>
          </div>

          {/* Derecha: Alertas, Ajustes y Perfil CAJA-01 */}
          <div className="flex items-center gap-3">
            {/* Buscador rápido Ctrl+K */}
            <button
              type="button"
              onClick={() => setIsCommandKOpen(true)}
              title="Búsqueda Global (Ctrl+K)"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Campana de Alertas de Stock Bajo */}
            <Link
              href="/inventario"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
              title="Alertas de inventario"
            >
              <Bell className="h-5 w-5" />
              {lowStockCount > 0 && (
                <span className="absolute -right-1 -top-0.5 rounded-full bg-[#e65100] px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                  {lowStockCount}
                </span>
              )}
            </Link>

            {/* Tema Claro / Oscuro */}
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
              title="Cambiar modo claro / oscuro"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Selector de Usuario / Rol y CAJA-01 */}
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3 dark:border-zinc-800">
              <div className="text-right leading-tight">
                <select
                  value={currentUser.id}
                  onChange={(e) => {
                    switchUserRole(e.target.value);
                    const sel = users.find((u) => u.id === e.target.value);
                    if (sel) toast.success(`Sesión activa: ${sel.full_name}`);
                  }}
                  aria-label="Cambiar usuario activo"
                  className="cursor-pointer bg-transparent text-right text-xs font-extrabold uppercase text-[#005bb5] focus:outline-none dark:text-sky-400"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id} className="text-slate-900">
                      {u.full_name}
                    </option>
                  ))}
                </select>
                <span className="block text-[10px] font-bold uppercase text-slate-500">
                  {currentUser.role === 'admin'
                    ? 'ADMINISTRADOR'
                    : currentUser.role.toUpperCase()}
                </span>
                <span className="block text-[11px] font-extrabold text-[#005bb5] dark:text-sky-400">
                  CAJA-01
                </span>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                <UserCircle2 className="h-7 w-7" />
              </div>
            </div>
          </div>
        </header>

        {/* Contenedor Principal */}
        <main className="flex-1 p-3 sm:p-5">
          {!isInitialized ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <RefreshCw className="h-4 w-4 animate-spin text-[#0066cc]" />
                Cargando sistema...
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* BARRA INFERIOR EN CELULAR                                             */}
      {/* ===================================================================== */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-15 items-center justify-around border-t border-slate-200 bg-white px-1 py-1.5 lg:hidden dark:border-zinc-800 dark:bg-zinc-900">
        <Link
          href="/pos"
          className={`flex flex-1 flex-col items-center text-[11px] font-bold ${
            pathname.startsWith('/pos') ? 'text-[#0066cc]' : 'text-slate-500'
          }`}
        >
          <ShoppingCart className="h-5 w-5" />
          <span>Ventas</span>
        </Link>
        <Link
          href="/productos"
          className={`flex flex-1 flex-col items-center text-[11px] font-bold ${
            pathname.startsWith('/productos') ? 'text-[#0066cc]' : 'text-slate-500'
          }`}
        >
          <Package className="h-5 w-5" />
          <span>Artículos</span>
        </Link>
        <button
          type="button"
          onClick={() => setIsQuickScannerOpen(true)}
          className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#0066cc] text-white shadow-lg"
          aria-label="Escanear código"
        >
          <Camera className="h-5 w-5" />
        </button>
        <Link
          href="/caja"
          className={`flex flex-1 flex-col items-center text-[11px] font-bold ${
            pathname.startsWith('/caja') ? 'text-[#0066cc]' : 'text-slate-500'
          }`}
        >
          <Calculator className="h-5 w-5" />
          <span>Caja</span>
        </Link>
        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex flex-1 flex-col items-center text-[11px] font-bold text-slate-500"
        >
          <Menu className="h-5 w-5" />
          <span>Menú</span>
        </button>
      </nav>

      {/* Drawer Móvil */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="relative z-10 flex w-64 flex-col bg-[#2b2d30] text-white shadow-2xl">
            <div className="flex h-16 items-center justify-between bg-[#0066cc] px-3">
              <div className="rounded-lg bg-white/95 px-2.5 py-1 shadow-xs">
                <img
                  src="/logo-el-tigre.png"
                  alt="Mini-Súper EL TIGRE"
                  className="h-9 w-auto object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="rounded p-1 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-3">
              {[...mainMenuItems, ...adminMenuItems].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/10"
                  >
                    <Icon className="h-4 w-4 text-sky-400" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-white/10 p-3">
              <Link
                href="/login"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="flex items-center justify-center gap-2 rounded-lg bg-white/10 py-2 text-xs font-bold"
              >
                <LogOut className="h-4 w-4" /> Cambiar usuario
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modal Consultar Precio (Alt+C) */}
      {isPriceCheckerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#005bb5] dark:text-sky-400">
                Verificador de Precios (Alt+C)
              </h3>
              <button
                type="button"
                onClick={() => setIsPriceCheckerOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={priceCheckQuery}
              onChange={(e) => setPriceCheckQuery(e.target.value)}
              placeholder="Escanea el código de barras o escribe el nombre del artículo..."
              className="h-12 w-full rounded-lg border border-slate-300 bg-slate-100 px-4 text-sm font-semibold focus:border-[#0066cc] focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
            />
            <div className="mt-4 space-y-2">
              {checkedProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-zinc-800"
                >
                  <div>
                    <p className="text-sm font-extrabold uppercase">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      Código: {p.barcode || p.sku} • Existencia: {p.stock_current} {p.sale_unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-[#005bb5] dark:text-sky-400">
                      {formatMXN(p.sale_price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <GlobalCommandK isOpen={isCommandKOpen} onClose={() => setIsCommandKOpen(false)} />

      <CameraScannerModal
        isOpen={isQuickScannerOpen}
        onClose={() => setIsQuickScannerOpen(false)}
        onScanSuccess={handleGlobalQuickScan}
      />
    </div>
  );
}
