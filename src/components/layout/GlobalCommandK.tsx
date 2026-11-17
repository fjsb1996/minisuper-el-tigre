'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Barcode,
  Boxes,
  Calculator,
  Package,
  Receipt,
  Search,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import { formatMXN } from '@/lib/utils/formatters';
import { toast } from 'sonner';

interface GlobalCommandKProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalCommandK({ isOpen, onClose }: GlobalCommandKProps) {
  const router = useRouter();
  const { products, customers, suppliers, addToCart } = useTiendaStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  const matchedProducts = q
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.includes(q))
        )
        .slice(0, 6)
    : products.slice(0, 4);

  const matchedCustomers = q
    ? customers
        .filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q))
        .slice(0, 3)
    : [];

  const matchedSuppliers = q
    ? suppliers.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 3)
    : [];

  const quickNav = [
    { label: 'Ir al Punto de Venta (POS)', href: '/pos', icon: ShoppingCart },
    { label: 'Catálogo de Productos y Precios', href: '/productos', icon: Package },
    { label: 'Inventario, Kardex y Conteo Rápido', href: '/inventario', icon: Boxes },
    { label: 'Apertura y Corte de Caja', href: '/caja', icon: Calculator },
    { label: 'Clientes y Cuentas de Fiado', href: '/clientes', icon: Users },
    { label: 'Proveedores y Comparador de Costos', href: '/proveedores', icon: Truck },
    { label: 'Imprimir Etiquetas y Códigos de Barras', href: '/etiquetas', icon: Tag },
    { label: 'Reportes y Utilidad Neta', href: '/reportes', icon: Receipt },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-16 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Buscador */}
        <div className="flex items-center border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <Search className="mr-3 h-5 w-5 text-orange-500" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto (nombre, código, SKU), cliente, proveedor o sección..."
            className="flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Resultados */}
        <div className="max-h-[70vh] overflow-y-auto p-3 space-y-4">
          {/* Productos */}
          <div>
            <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Productos ({matchedProducts.length})
            </p>
            <div className="space-y-1">
              {matchedProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/productos?buscar=${encodeURIComponent(prod.sku)}`);
                      onClose();
                    }}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                      <Barcode className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {prod.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        SKU: {prod.sku} {prod.barcode ? `• EAN: ${prod.barcode}` : '• Granel'} •
                        Stock: {prod.stock_current} {prod.sale_unit}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {formatMXN(prod.sale_price)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        addToCart(prod, 1);
                        toast.success(`${prod.name} agregado al carrito POS`);
                        onClose();
                        router.push('/pos');
                      }}
                      className="rounded-lg bg-orange-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-500"
                    >
                      + POS
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Clientes */}
          {matchedCustomers.length > 0 && (
            <div>
              <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Clientes y Fiado
              </p>
              {matchedCustomers.map((cust) => (
                <button
                  key={cust.id}
                  type="button"
                  onClick={() => {
                    router.push('/clientes');
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {cust.name}
                    </p>
                    <p className="text-xs text-zinc-500">Tel: {cust.phone}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-600">
                    Fiado: {formatMXN(cust.current_balance)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Proveedores */}
          {matchedSuppliers.length > 0 && (
            <div>
              <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Proveedores
              </p>
              {matchedSuppliers.map((sup) => (
                <button
                  key={sup.id}
                  type="button"
                  onClick={() => {
                    router.push('/proveedores');
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {sup.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Visita: {sup.visit_days.join(', ')}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-zinc-500">
                    Por pagar: {formatMXN(sup.payable_balance)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Navegación rápida */}
          <div>
            <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Accesos Rápidos
            </p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {quickNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => {
                      router.push(item.href);
                      onClose();
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    <Icon className="h-4 w-4 text-orange-500" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
