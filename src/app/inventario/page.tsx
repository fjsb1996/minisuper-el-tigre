'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Calendar,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileSpreadsheet,
  History,
  Plus,
  ScanLine,
  Search,
  ShoppingCart,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import { InventoryMovementType, Product } from '@/types/database';
import {
  formatDateShortMX,
  formatDateTimeMX,
  formatMXN,
  formatQuantityWithUnit,
  getDaysUntilExpiry,
  roundCurrency,
  roundQuantity,
} from '@/lib/utils/formatters';
import { inventoryAdjustmentSchema } from '@/lib/validations/schemas';
import { CameraScannerModal } from '@/components/scanner/CameraScannerModal';
import { UsbBarcodeListener } from '@/components/scanner/UsbBarcodeListener';
import { toast } from 'sonner';

const MOVEMENT_LABELS: Record<
  InventoryMovementType,
  { label: string; color: string; isEntry: boolean }
> = {
  inventario_inicial: {
    label: 'Inventario Inicial',
    color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    isEntry: true,
  },
  entrada_compra: {
    label: 'Entrada por Compra',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    isEntry: true,
  },
  salida_venta: {
    label: 'Salida por Venta POS',
    color: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
    isEntry: false,
  },
  devolucion_venta: {
    label: 'Devolución / Cancelación',
    color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    isEntry: true,
  },
  ajuste_merma: {
    label: 'Ajuste por Merma / Daño',
    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    isEntry: false,
  },
  ajuste_caducado: {
    label: 'Baja por Caducidad',
    color: 'bg-red-500/15 text-red-600 dark:text-red-400',
    isEntry: false,
  },
  ajuste_robo: {
    label: 'Baja por Robo / Extravío',
    color: 'bg-red-600/20 text-red-700 dark:text-red-300',
    isEntry: false,
  },
  ajuste_consumo_propio: {
    label: 'Consumo Propio / Tienda',
    color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
    isEntry: false,
  },
  conteo_fisico: {
    label: 'Conteo Físico Rápido',
    color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    isEntry: true,
  },
};

function InventarioContent() {
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    products,
    inventoryMovements,
    suppliers,
    supplierQuotes,
    registerInventoryAdjustment,
    bulkImportProducts,
  } = useTiendaStore();

  const [activeTab, setActiveTab] = useState<
    'kardex' | 'alertas' | 'conteo_rapido' | 'lista_compras'
  >('kardex');

  // Filtros de Kardex
  const [selectedProductId, setSelectedProductId] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchKardex, setSearchKardex] = useState('');

  // Modal Ajuste Manual
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjProductId, setAdjProductId] = useState<string>('');
  const [adjType, setAdjType] = useState<InventoryMovementType>('ajuste_merma');
  const [adjQuantity, setAdjQuantity] = useState<string>('1');
  const [adjReason, setAdjReason] = useState<string>('');
  const [adjError, setAdjError] = useState<string | null>(null);

  // Modo Conteo Rápido con Escáner
  const [isCountScannerOpen, setIsCountScannerOpen] = useState(false);
  const [countedProduct, setCountedProduct] = useState<Product | null>(null);
  const [physicalCountValue, setPhysicalCountValue] = useState<string>('0');
  const [countSessionHistory, setCountSessionHistory] = useState<
    Array<{ product: Product; oldStock: number; newStock: number; time: string }>
  >([]);

  useEffect(() => {
    if (searchParams.get('modo') === 'conteo') {
      setActiveTab('conteo_rapido');
    }
  }, [searchParams]);

  // ==========================================================================
  // CÁLCULO DE VALOR TOTAL DEL INVENTARIO Y ALERTAS
  // ==========================================================================
  const inventoryStats = useMemo(() => {
    const activeProducts = products.filter((p) => p.is_active);
    const totalCostValue = roundCurrency(
      activeProducts.reduce((acc, p) => acc + p.stock_current * p.cost_price, 0)
    );
    const totalSaleValue = roundCurrency(
      activeProducts.reduce((acc, p) => acc + p.stock_current * p.sale_price, 0)
    );
    const expectedProfit = roundCurrency(totalSaleValue - totalCostValue);

    const lowStockProducts = activeProducts.filter((p) => p.stock_current <= p.stock_min);
    const expiringProducts = activeProducts.filter((p) => {
      const days = getDaysUntilExpiry(p.expiry_date);
      return days !== null && days <= 10;
    });
    const noMovementProducts = activeProducts.filter((p) => {
      if (!p.last_sale_at) return true;
      const diffHours =
        (Date.now() - new Date(p.last_sale_at).getTime()) / (1000 * 60 * 60);
      return diffHours > 24;
    });

    return {
      totalCostValue,
      totalSaleValue,
      expectedProfit,
      lowStockProducts,
      expiringProducts,
      noMovementProducts,
    };
  }, [products]);

  // ==========================================================================
  // LISTA DE COMPRAS INTELIGENTE AGRUPADA POR PROVEEDOR
  // ==========================================================================
  const shoppingListBySupplier = useMemo(() => {
    const groups: Record<
      string,
      {
        supplierName: string;
        supplierPhone: string;
        visitDays: string[];
        items: Array<{
          product: Product;
          suggestedQty: number;
          estimatedUnitCost: number;
          estimatedSubtotal: number;
        }>;
        totalEstimated: number;
      }
    > = {};

    for (const prod of inventoryStats.lowStockProducts) {
      // Buscar proveedor preferido o de menor costo para este producto
      const quotes = supplierQuotes.filter((q) => q.product_id === prod.id);
      const preferredQuote =
        quotes.find((q) => q.is_preferred) ||
        quotes.sort((a, b) => a.last_cost_price - b.last_cost_price)[0];

      const supplier = preferredQuote
        ? suppliers.find((s) => s.id === preferredQuote.supplier_id)
        : suppliers.find((s) => s.id === 'sup-004'); // Zorro Abarrotero como respaldo

      const groupKey = supplier?.id || 'general';
      const supplierName = supplier?.name || 'Mayorista General / Central de Abastos';

      if (!groups[groupKey]) {
        groups[groupKey] = {
          supplierName,
          supplierPhone: supplier?.phone || '',
          visitDays: supplier?.visit_days || [],
          items: [],
          totalEstimated: 0,
        };
      }

      // Sugerir resurtir al menos el doble del stock mínimo menos el stock actual
      const targetStock = Math.max(prod.stock_min * 2, prod.stock_min + 5);
      const suggestedQty = roundQuantity(Math.max(1, targetStock - prod.stock_current));
      const estimatedUnitCost = preferredQuote?.last_cost_price ?? prod.cost_price;
      const estimatedSubtotal = roundCurrency(suggestedQty * estimatedUnitCost);

      groups[groupKey].items.push({
        product: prod,
        suggestedQty,
        estimatedUnitCost,
        estimatedSubtotal,
      });
      groups[groupKey].totalEstimated = roundCurrency(
        groups[groupKey].totalEstimated + estimatedSubtotal
      );
    }

    return Object.values(groups);
  }, [inventoryStats.lowStockProducts, supplierQuotes, suppliers]);

  // ==========================================================================
  // HANDLERS: AJUSTE MANUAL Y CONTEO RÁPIDO
  // ==========================================================================
  const handleManualAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjError(null);

    const parsed = inventoryAdjustmentSchema.safeParse({
      product_id: adjProductId,
      movement_type: adjType,
      quantity: adjQuantity,
      reason: adjReason,
    });

    if (!parsed.success) {
      setAdjError(parsed.error.issues[0]?.message || 'Verifica los datos del ajuste');
      return;
    }

    await registerInventoryAdjustment({
      productId: parsed.data.product_id,
      movementType: parsed.data.movement_type,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason,
    });

    toast.success('Ajuste de inventario registrado en Kardex y Bitácora');
    setIsAdjustModalOpen(false);
    setAdjReason('');
  };

  const handleQuickCountBarcode = (code: string) => {
    const clean = code.trim();
    const found = products.find((p) => p.barcode === clean || p.sku === clean);
    if (!found) {
      toast.error(`No se encontró ningún producto con el código ${clean}`);
      return;
    }
    setCountedProduct(found);
    setPhysicalCountValue(String(found.stock_current));
  };

  const handleSaveQuickCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countedProduct) return;

    const newStock = Math.max(0, Number(physicalCountValue) || 0);
    const oldStock = countedProduct.stock_current;

    await registerInventoryAdjustment({
      productId: countedProduct.id,
      movementType: 'conteo_fisico',
      quantity: newStock,
      reason: `Conteo físico rápido con escáner (Sistema: ${oldStock} -> Físico: ${newStock})`,
    });

    setCountSessionHistory((prev) => [
      {
        product: countedProduct,
        oldStock,
        newStock,
        time: new Date().toLocaleTimeString('es-MX'),
      },
      ...prev,
    ]);

    toast.success(`Existencia de "${countedProduct.name}" ajustada a ${newStock} ${countedProduct.sale_unit}`);
    setCountedProduct(null);
  };

  // ==========================================================================
  // IMPORTACIÓN Y EXPORTACIÓN CSV / EXCEL
  // ==========================================================================
  const handleExportCSV = () => {
    const headers = [
      'SKU',
      'Codigo_Barras',
      'Nombre',
      'Marca',
      'Unidad_Venta',
      'Costo_Compra_MXN',
      'Precio_Venta_MXN',
      'Margen_Porcentaje',
      'Stock_Actual',
      'Stock_Minimo',
      'Ubicacion',
      'Fecha_Caducidad',
    ];

    const rows = products.map((p) => [
      p.sku,
      p.barcode || '',
      `"${p.name.replace(/"/g, '""')}"`,
      `"${(p.brand || '').replace(/"/g, '""')}"`,
      p.sale_unit,
      p.cost_price.toFixed(2),
      p.sale_price.toFixed(2),
      p.profit_margin_pct.toFixed(2),
      p.stock_current,
      p.stock_min,
      `"${(p.location || '').replace(/"/g, '""')}"`,
      p.expiry_date || '',
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `inventario-tienda-tigre-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Catálogo e inventario exportado en CSV compatible con Excel');
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      toast.error('El archivo CSV está vacío o no tiene filas de datos.');
      return;
    }

    const parsedRows = lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
      return {
        sku: cols[0] || undefined,
        barcode: cols[1] || null,
        name: cols[2] || 'Producto Importado',
        brand: cols[3] || 'Genérico',
        sale_unit: (cols[4] as Product['sale_unit']) || 'pieza',
        cost_price: Number(cols[5]) || 10,
        sale_price: Number(cols[6]) || 15,
        stock_current: Number(cols[8]) || 0,
        stock_min: Number(cols[9]) || 5,
        location: cols[10] || '',
      };
    });

    const importedCount = await bulkImportProducts(parsedRows);
    toast.success(`Se importaron o actualizaron ${importedCount} productos correctamente.`);
    e.target.value = '';
  };

  // Movimientos filtrados
  const filteredMovements = useMemo(() => {
    const q = searchKardex.trim().toLowerCase();
    return inventoryMovements.filter((m) => {
      if (selectedProductId !== 'ALL' && m.product_id !== selectedProductId) return false;
      if (selectedType !== 'ALL' && m.movement_type !== selectedType) return false;
      if (!q) return true;
      const pName =
        m.product_name || products.find((p) => p.id === m.product_id)?.name || '';
      return (
        pName.toLowerCase().includes(q) ||
        m.reason.toLowerCase().includes(q) ||
        m.user_name.toLowerCase().includes(q)
      );
    });
  }, [inventoryMovements, selectedProductId, selectedType, searchKardex, products]);

  return (
    <div className="space-y-6">
      <UsbBarcodeListener
        enabled={activeTab === 'conteo_rapido'}
        onBarcodeDetected={handleQuickCountBarcode}
      />

      {/* Encabezado Minimalista y Acciones */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0066cc]">
            Inventario, Kardex y Conteo Rápido
          </h1>
          <p className="text-xs text-[#666]">
            Trazabilidad de entradas y salidas, ajustes con motivo obligatorio y lista de compras.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 items-center gap-1.5 rounded-md border border-[#0066cc] bg-white px-3 text-xs font-bold text-[#0066cc] hover:bg-[#e8f0f8]"
          >
            <Upload className="h-4 w-4" />
            Importar CSV/Excel
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex h-9 items-center gap-1.5 rounded-md border border-[#b0bec5] bg-white px-3 text-xs font-bold text-[#455a64] hover:bg-[#f4f6f8]"
          >
            <Download className="h-4 w-4 text-[#2e7d32]" />
            Exportar Excel/CSV
          </button>

          <button
            type="button"
            onClick={() => {
              setAdjProductId(products[0]?.id || '');
              setAdjType('ajuste_merma');
              setAdjQuantity('1');
              setAdjReason('');
              setAdjError(null);
              setIsAdjustModalOpen(true);
            }}
            className="flex h-9 items-center gap-1.5 rounded-md bg-[#0066cc] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
          >
            <Plus className="h-4 w-4" />
            Ajuste Manual
          </button>
        </div>
      </div>

      {/* KPIs de Valor del Inventario */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-[#666]">
            Valor Inventario (a Costo)
          </p>
          <p className="mt-1 text-2xl font-black text-[#222]">
            {formatMXN(inventoryStats.totalCostValue)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#666]">Capital invertido en mercancía</p>
        </div>

        <div className="rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-[#666]">
            Valor Inventario (Precio Venta)
          </p>
          <p className="mt-1 text-2xl font-black text-[#0066cc]">
            {formatMXN(inventoryStats.totalSaleValue)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#2e7d32] font-bold">
            Ganancia potencial: +{formatMXN(inventoryStats.expectedProfit)}
          </p>
        </div>

        <div className="rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-[#d95c38]">
            Alertas de Stock Bajo
          </p>
          <p className="mt-1 text-2xl font-black text-[#d95c38]">
            {inventoryStats.lowStockProducts.length} artículos
          </p>
          <p className="mt-0.5 text-[11px] text-[#666]">Por debajo del mínimo configurado</p>
        </div>

        <div className="rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-[#0066cc]">
            Próximos a Caducar (≤10 días)
          </p>
          <p className="mt-1 text-2xl font-black text-[#222]">
            {inventoryStats.expiringProducts.length} lotes
          </p>
          <p className="mt-0.5 text-[11px] text-[#666]">Lácteos, carnes y salchichonería</p>
        </div>
      </div>

      {/* Pestañas de Navegación del Módulo estilo Carpeta */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#d0d5dd] bg-[#e2e5e9] px-2 pt-2 rounded-t-lg">
        {[
          { id: 'kardex', label: 'Kardex de Movimientos', icon: History },
          {
            id: 'conteo_rapido',
            label: 'Conteo Rápido (Escáner)',
            icon: ScanLine,
          },
          {
            id: 'alertas',
            label: `Alertas (${inventoryStats.lowStockProducts.length + inventoryStats.expiringProducts.length})`,
            icon: AlertTriangle,
          },
          {
            id: 'lista_compras',
            label: 'Lista de Compras por Proveedor',
            icon: ClipboardList,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold transition ${
                active
                  ? 'bg-[#0066cc] text-white shadow-sm'
                  : 'bg-[#d4d8dd] text-[#444] hover:bg-[#dcdfe4]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* PESTAÑA 1: KARDEX DE MOVIMIENTOS                                      */}
      {/* ===================================================================== */}
      {activeTab === 'kardex' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-12">
            <div className="relative sm:col-span-5">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchKardex}
                onChange={(e) => setSearchKardex(e.target.value)}
                placeholder="Buscar en Kardex por producto, motivo o usuario..."
                className="h-11 w-full rounded-xl border border-zinc-300 bg-zinc-50 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>

            <div className="sm:col-span-4">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="ALL">Todos los productos</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="ALL">Todos los tipos de movimiento</option>
                {Object.entries(MOVEMENT_LABELS).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <tr>
                    <th className="px-4 py-3">Fecha y Hora</th>
                    <th className="px-3 py-3">Producto</th>
                    <th className="px-3 py-3">Tipo de Movimiento</th>
                    <th className="px-3 py-3 text-right">Cantidad</th>
                    <th className="px-3 py-3 text-right">Stock Antes → Después</th>
                    <th className="px-3 py-3">Motivo / Referencia</th>
                    <th className="px-4 py-3">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredMovements.map((mov) => {
                    const info = MOVEMENT_LABELS[mov.movement_type] || {
                      label: mov.movement_type,
                      color: 'bg-zinc-200 text-zinc-800',
                      isEntry: mov.quantity >= 0,
                    };
                    const prod = products.find((p) => p.id === mov.product_id);

                    return (
                      <tr key={mov.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                          {formatDateTimeMX(mov.created_at)}
                        </td>
                        <td className="px-3 py-3 font-bold text-zinc-900 dark:text-white">
                          {mov.product_name || prod?.name || 'Producto'}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${info.color}`}
                          >
                            {mov.quantity >= 0 ? (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5" />
                            )}
                            {info.label}
                          </span>
                        </td>
                        <td
                          className={`px-3 py-3 text-right font-extrabold ${
                            mov.quantity >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}{' '}
                          {prod?.sale_unit || ''}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-zinc-600 dark:text-zinc-300">
                          {mov.stock_before} →{' '}
                          <strong className="text-zinc-900 dark:text-white">
                            {mov.stock_after}
                          </strong>
                        </td>
                        <td className="px-3 py-3 text-xs text-zinc-600 dark:text-zinc-300">
                          {mov.reason}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{mov.user_name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PESTAÑA 2: MODO CONTEO RÁPIDO CON ESCÁNER                             */}
      {/* ===================================================================== */}
      {activeTab === 'conteo_rapido' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">Conteo Físico Rápido Escaneando</h2>
                <p className="text-xs text-zinc-500">
                  Escanea un producto en el anaquel con el celular o lector USB para ajustar su existencia al instante.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCountScannerOpen(true)}
                className="flex h-10 items-center gap-2 rounded-md bg-[#0066cc] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
              >
                <Camera className="h-4 w-4" />
                Escanear con Cámara
              </button>
            </div>

            {/* Selector rápido manual o por código */}
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-500">
                O selecciona un producto manualmente:
              </label>
              <select
                value={countedProduct?.id || ''}
                onChange={(e) => {
                  const p = products.find((item) => item.id === e.target.value) || null;
                  setCountedProduct(p);
                  if (p) setPhysicalCountValue(String(p.stock_current));
                }}
                className="h-11 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">— Selecciona o escanea un producto —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.barcode || p.sku}) — Stock Sistema: {p.stock_current} {p.sale_unit}
                  </option>
                ))}
              </select>
            </div>

            {countedProduct && (
              <form
                onSubmit={handleSaveQuickCount}
                className="space-y-4 rounded-2xl border-2 border-orange-500/50 bg-orange-500/5 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase text-orange-600">
                      Producto Escaneado
                    </span>
                    <h3 className="text-lg font-black">{countedProduct.name}</h3>
                    <p className="text-xs text-zinc-500">
                      Código: {countedProduct.barcode || countedProduct.sku} • Ubicación:{' '}
                      {countedProduct.location || 'Mostrador'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-500">Stock en Sistema:</span>
                    <p className="text-xl font-black">
                      {countedProduct.stock_current} {countedProduct.sale_unit}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-extrabold">
                    Existencia Física Contada ({countedProduct.sale_unit}) *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPhysicalCountValue(
                          String(Math.max(0, (Number(physicalCountValue) || 0) - 1))
                        )
                      }
                      className="h-12 w-12 rounded-xl border border-zinc-300 bg-white text-lg font-black dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      autoFocus
                      value={physicalCountValue}
                      onChange={(e) => setPhysicalCountValue(e.target.value)}
                      className="h-12 flex-1 rounded-xl border border-orange-500 bg-white px-4 text-center text-xl font-black focus:outline-none dark:bg-zinc-950"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPhysicalCountValue(String((Number(physicalCountValue) || 0) + 1))
                      }
                      className="h-12 w-12 rounded-xl border border-zinc-300 bg-white text-lg font-black dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-extrabold text-white shadow-md hover:bg-emerald-500"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Confirmar Conteo y Actualizar Existencia
                </button>
              </form>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-6">
            <h3 className="mb-3 text-base font-extrabold">
              Productos Ajustados en esta Sesión ({countSessionHistory.length})
            </h3>
            {countSessionHistory.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-400">
                Aún no has escaneado productos en esta sesión de conteo rápido.
              </p>
            ) : (
              <div className="space-y-2">
                {countSessionHistory.map((item, idx) => {
                  const diff = roundQuantity(item.newStock - item.oldStock);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800"
                    >
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white">
                          {item.product.name}
                        </p>
                        <p className="text-zinc-500">{item.time}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono">
                          {item.oldStock} → <strong>{item.newStock}</strong>{' '}
                          {item.product.sale_unit}
                        </span>
                        <span
                          className={`block font-bold ${
                            diff >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          Diferencia: {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PESTAÑA 3: ALERTAS (STOCK BAJO, PRÓXIMOS A CADUCAR, SIN MOVIMIENTO)   */}
      {/* ===================================================================== */}
      {activeTab === 'alertas' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Stock Bajo */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              Stock Bajo ({inventoryStats.lowStockProducts.length})
            </h3>
            <div className="space-y-2">
              {inventoryStats.lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl bg-red-500/5 p-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-zinc-900 dark:text-white">{p.name}</p>
                    <p className="text-zinc-500">Mínimo requerido: {p.stock_min} {p.sale_unit}</p>
                  </div>
                  <span className="rounded-lg bg-red-500/15 px-2.5 py-1 font-extrabold text-red-600 dark:text-red-400">
                    Quedan: {p.stock_current} {p.sale_unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Próximos a Caducar */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-amber-600 dark:text-amber-400">
              <Calendar className="h-4 w-4" />
              Próximos a Caducar ({inventoryStats.expiringProducts.length})
            </h3>
            <div className="space-y-2">
              {inventoryStats.expiringProducts.map((p) => {
                const days = getDaysUntilExpiry(p.expiry_date);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl bg-amber-500/5 p-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white">{p.name}</p>
                      <p className="text-zinc-500">
                        Vence: {formatDateShortMX(p.expiry_date)} • Lote: {p.batch_code || 'General'}
                      </p>
                    </div>
                    <span className="rounded-lg bg-amber-500/20 px-2.5 py-1 font-extrabold text-amber-700 dark:text-amber-300">
                      {days !== null && days <= 0 ? 'Vencido' : `${days} días`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sin Movimiento Reciente */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-zinc-700 dark:text-zinc-300">
              <Clock className="h-4 w-4 text-blue-500" />
              Productos sin Movimiento Reciente ({inventoryStats.noMovementProducts.length})
            </h3>
            <div className="space-y-2">
              {inventoryStats.noMovementProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-800/60"
                >
                  <div>
                    <p className="font-bold text-zinc-900 dark:text-white">{p.name}</p>
                    <p className="text-zinc-500">
                      Última venta: {p.last_sale_at ? formatDateShortMX(p.last_sale_at) : 'Sin ventas'}
                    </p>
                  </div>
                  <span className="font-bold text-zinc-600 dark:text-zinc-300">
                    Stock: {p.stock_current} {p.sale_unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PESTAÑA 4: LISTA DE COMPRAS SUGERIDA AGRUPADA POR PROVEEDOR           */}
      {/* ===================================================================== */}
      {activeTab === 'lista_compras' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4">
            <h3 className="text-sm font-extrabold text-orange-700 dark:text-orange-300">
              Sugerencia Inteligente de Resurtido por Proveedor
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Generada automáticamente según el stock mínimo, las ventas recientes y el proveedor con mejor costo registrado.
            </p>
          </div>

          {shoppingListBySupplier.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              ¡Excelente! Todos tus productos están por encima de su stock mínimo.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {shoppingListBySupplier.map((group, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="mb-3 flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
                    <div>
                      <h4 className="flex items-center gap-2 text-base font-black">
                        <Truck className="h-4 w-4 text-orange-500" />
                        {group.supplierName}
                      </h4>
                      {group.visitDays.length > 0 && (
                        <p className="text-xs text-zinc-500">
                          Días de visita: {group.visitDays.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-zinc-400">Total Estimado:</span>
                      <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {formatMXN(group.totalEstimated)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center justify-between rounded-xl bg-zinc-50 p-2.5 text-xs dark:bg-zinc-950"
                      >
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-white">
                            {item.product.name}
                          </p>
                          <p className="text-zinc-500">
                            Stock actual: {item.product.stock_current} (Mín: {item.product.stock_min})
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-orange-600 dark:text-orange-400">
                            Pedir: {formatQuantityWithUnit(item.suggestedQty, item.product.sale_unit)}
                          </span>
                          <span className="block text-[11px] text-zinc-500">
                            ~{formatMXN(item.estimatedUnitCost)} c/u ({formatMXN(item.estimatedSubtotal)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE AJUSTE MANUAL DE INVENTARIO (MOTIVO OBLIGATORIO)             */}
      {/* ===================================================================== */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-extrabold">Ajuste Manual de Inventario</h3>
                <p className="text-xs text-zinc-500">
                  Registra mermas, producto caducado, robo o consumo propio con motivo obligatorio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {adjError && (
              <div className="mb-4 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-600">
                {adjError}
              </div>
            )}

            <form onSubmit={handleManualAdjustmentSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold">Producto *</label>
                <select
                  value={adjProductId}
                  onChange={(e) => setAdjProductId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock actual: {p.stock_current} {p.sale_unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">Tipo de Ajuste *</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as InventoryMovementType)}
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="ajuste_merma">Baja por Merma / Producto Dañado (-)</option>
                  <option value="ajuste_caducado">Baja por Producto Caducado (-)</option>
                  <option value="ajuste_consumo_propio">Consumo Propio / Uso en Tienda (-)</option>
                  <option value="ajuste_robo">Baja por Robo / Faltante (-)</option>
                  <option value="entrada_compra">Entrada Directa de Mercancía (+)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">Cantidad a Ajustar *</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  value={adjQuantity}
                  onChange={(e) => setAdjQuantity(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm font-bold dark:border-zinc-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">
                  Motivo Detallado (Obligatorio para Bitácora) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="Ej. Envase roto al acomodar refrigerador o cambio con proveedor..."
                  className="w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="h-11 rounded-xl border border-zinc-300 px-4 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-10 rounded-md bg-[#0066cc] px-5 text-xs font-bold text-white hover:bg-[#0055b3]"
                >
                  Aplicar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Escáner de Cámara para Modo Conteo Rápido */}
      <CameraScannerModal
        isOpen={isCountScannerOpen}
        onClose={() => setIsCountScannerOpen(false)}
        onScanSuccess={handleQuickCountBarcode}
        title="Conteo Rápido de Inventario"
        subtitle="Escanea el producto para capturar su existencia física"
      />
    </div>
  );
}

export default function InventarioPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Cargando inventario...</div>}>
      <InventarioContent />
    </Suspense>
  );
}
