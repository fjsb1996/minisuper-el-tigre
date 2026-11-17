'use client';

import React, { useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  PackagePlus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import {
  calculateUnitCostFromBox,
  formatDateTimeMX,
  formatMXN,
  roundCurrency,
} from '@/lib/utils/formatters';
import { CameraScannerModal } from '@/components/scanner/CameraScannerModal';
import { toast } from 'sonner';

interface PurchaseRowDraft {
  productId: string;
  presentationId: string;
  conversionFactor: number;
  quantity: number;
  unitCost: number;
  updateProductCost: boolean;
  newSalePrice: string;
  expiryDate: string;
  batchNumber: string;
}

export default function ComprasPage() {
  const {
    suppliers,
    products,
    presentations,
    purchases,
    registerPurchase,
  } = useTiendaStore();

  const [isNewPurchaseOpen, setIsNewPurchaseOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Encabezado de la compra
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [folioInvoice, setFolioInvoice] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pagada' | 'pendiente' | 'parcial'>('pagada');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [payFromCurrentShift, setPayFromCurrentShift] = useState(false);
  const [notes, setNotes] = useState('');

  // Renglones de productos comprados
  const [rows, setRows] = useState<PurchaseRowDraft[]>([]);

  const addProductRow = (prodId?: string) => {
    const targetProd = products.find((p) => p.id === (prodId || products[0]?.id));
    if (!targetProd) return;

    setRows((prev) => [
      ...prev,
      {
        productId: targetProd.id,
        presentationId: '',
        conversionFactor: 1,
        quantity: 10,
        unitCost: targetProd.cost_price,
        updateProductCost: true,
        newSalePrice: String(targetProd.sale_price),
        expiryDate: targetProd.expiry_date || '',
        batchNumber: '',
      },
    ]);
  };

  const handleScanForPurchase = (barcode: string) => {
    const clean = barcode.trim();
    const found = products.find((p) => p.barcode === clean || p.sku === clean);
    if (!found) {
      toast.error(`Código ${clean} no encontrado en catálogo.`);
      return;
    }
    addProductRow(found.id);
    toast.success(`${found.name} agregado a la orden de compra`);
  };

  const totalPurchaseAmount = useMemo(() => {
    return roundCurrency(
      rows.reduce((acc, r) => acc + r.quantity * r.conversionFactor * r.unitCost, 0)
    );
  }, [rows]);

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error('Selecciona un proveedor.');
      return;
    }
    if (rows.length === 0) {
      toast.error('Agrega al menos un producto a la compra.');
      return;
    }

    const paid =
      paymentStatus === 'pagada'
        ? totalPurchaseAmount
        : paymentStatus === 'pendiente'
          ? 0
          : Number(paidAmountInput) || 0;

    await registerPurchase({
      supplierId,
      folioInvoice: folioInvoice || `FAC-${Date.now().toString().slice(-5)}`,
      paymentStatus,
      paidAmount: paid,
      dueDate: dueDate || null,
      payFromCurrentShift,
      notes,
      items: rows.map((r) => ({
        productId: r.productId,
        presentationId: r.presentationId || null,
        conversionFactor: r.conversionFactor,
        quantity: r.quantity,
        unitCost: r.unitCost,
        updateProductCost: r.updateProductCost,
        newSalePrice: r.newSalePrice ? Number(r.newSalePrice) : null,
        expiryDate: r.expiryDate || null,
        batchNumber: r.batchNumber || null,
      })),
    });

    toast.success(
      'Compra registrada: Stock actualizado, Kardex generado y costos actualizados.'
    );
    setIsNewPurchaseOpen(false);
    setRows([]);
    setFolioInvoice('');
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Minimalista */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0066cc]">
            Registro de Compras y Entradas de Mercancía
          </h1>
          <p className="text-xs text-[#666]">
            Al guardar una compra se incrementa el stock automáticamente y actualiza opcionalmente el costo y precio de venta.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSupplierId(suppliers[0]?.id || '');
            setRows([]);
            addProductRow(products[0]?.id);
            setIsNewPurchaseOpen(true);
          }}
          className="flex h-9 items-center gap-1.5 rounded-md bg-[#0066cc] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
        >
          <PackagePlus className="h-4 w-4" />
          Registrar Nueva Compra / Factura
        </button>
      </div>

      {/* Formulario de Nueva Compra */}
      {isNewPurchaseOpen && (
        <div className="rounded-3xl border-2 border-orange-500/40 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-black">Nueva Entrada de Mercancía por Compra</h2>
              <p className="text-xs text-zinc-500">
                Puedes capturar por unidad o seleccionar presentación por caja (calcula costo unitario).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsNewPurchaseOpen(false)}
              className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmitPurchase} className="space-y-5">
            {/* Datos de Factura y Proveedor */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <label className="mb-1 block text-xs font-bold">Proveedor *</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-950"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-bold">Folio Factura / Nota *</label>
                <input
                  type="text"
                  required
                  value={folioInvoice}
                  onChange={(e) => setFolioInvoice(e.target.value)}
                  placeholder="Ej. FEMSA-88412"
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-bold">Estado de Pago</label>
                <select
                  value={paymentStatus}
                  onChange={(e) =>
                    setPaymentStatus(e.target.value as 'pagada' | 'pendiente' | 'parcial')
                  }
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="pagada">Pagada de Contado</option>
                  <option value="pendiente">A Crédito (Por Pagar)</option>
                  <option value="parcial">Pago Parcial (Abono)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                {paymentStatus === 'parcial' ? (
                  <>
                    <label className="mb-1 block text-xs font-bold">Monto Abonado</label>
                    <input
                      type="number"
                      step="0.50"
                      value={paidAmountInput}
                      onChange={(e) => setPaidAmountInput(e.target.value)}
                      className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm font-bold dark:border-zinc-700"
                    />
                  </>
                ) : (
                  <>
                    <label className="mb-1 block text-xs font-bold">Vencimiento</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-2 text-xs dark:border-zinc-700"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Renglones de Productos */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
                  Productos Surtidos en esta Compra ({rows.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-600"
                  >
                    <Camera className="h-3.5 w-3.5" /> Escanear Producto
                  </button>
                  <button
                    type="button"
                    onClick={() => addProductRow()}
                    className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white dark:bg-zinc-800"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agregar Renglón
                  </button>
                </div>
              </div>

              {rows.map((row, idx) => {
                const prodPresentations = presentations.filter(
                  (p) => p.product_id === row.productId
                );
                const unitsTotal = row.quantity * row.conversionFactor;
                const rowSubtotal = roundCurrency(unitsTotal * row.unitCost);

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-1 items-end gap-2.5 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-3">
                      <label className="text-[11px] font-bold">Producto</label>
                      <select
                        value={row.productId}
                        onChange={(e) => {
                          const p = products.find((item) => item.id === e.target.value);
                          if (!p) return;
                          const copy = [...rows];
                          copy[idx] = {
                            ...copy[idx],
                            productId: p.id,
                            presentationId: '',
                            conversionFactor: 1,
                            unitCost: p.cost_price,
                            newSalePrice: String(p.sale_price),
                          };
                          setRows(copy);
                        }}
                        className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-2 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold">Unidad / Caja</label>
                      <select
                        value={row.presentationId}
                        onChange={(e) => {
                          const pres = prodPresentations.find((p) => p.id === e.target.value);
                          const copy = [...rows];
                          if (pres) {
                            copy[idx].presentationId = pres.id;
                            copy[idx].conversionFactor = pres.conversion_factor;
                            copy[idx].unitCost = calculateUnitCostFromBox(
                              pres.box_cost_price,
                              pres.conversion_factor
                            );
                          } else {
                            copy[idx].presentationId = '';
                            copy[idx].conversionFactor = 1;
                          }
                          setRows(copy);
                        }}
                        className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="">Unidad Suelta (x1)</option>
                        {prodPresentations.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            {pr.name} (x{pr.conversion_factor})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-1">
                      <label className="text-[11px] font-bold">Cant.</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.1"
                        value={row.quantity}
                        onChange={(e) => {
                          const copy = [...rows];
                          copy[idx].quantity = Number(e.target.value) || 0;
                          setRows(copy);
                        }}
                        className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-2 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold">Costo Unit. ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.unitCost}
                        onChange={(e) => {
                          const copy = [...rows];
                          copy[idx].unitCost = Number(e.target.value) || 0;
                          setRows(copy);
                        }}
                        className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-2 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold">Nuevo P. Venta</label>
                      <input
                        type="number"
                        step="0.01"
                        value={row.newSalePrice}
                        onChange={(e) => {
                          const copy = [...rows];
                          copy[idx].newSalePrice = e.target.value;
                          setRows(copy);
                        }}
                        className="h-10 w-full rounded-xl border border-emerald-500/50 bg-white px-2 text-xs font-bold text-emerald-700 dark:bg-zinc-900 dark:text-emerald-400"
                      />
                    </div>

                    <div className="flex items-center justify-between sm:col-span-2">
                      <div>
                        <span className="block text-[10px] text-zinc-400">
                          +{unitsTotal} al stock
                        </span>
                        <span className="text-xs font-black">{formatMXN(rowSubtotal)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pie de Compra */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={payFromCurrentShift}
                  onChange={(e) => setPayFromCurrentShift(e.target.checked)}
                  className="h-4 w-4 accent-orange-600"
                />
                Descontar pago en efectivo del turno de caja actual
              </label>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs text-zinc-500">Total Factura Compra:</span>
                  <p className="text-2xl font-black text-zinc-900 dark:text-white">
                    {formatMXN(totalPurchaseAmount)}
                  </p>
                </div>

                <button
                  type="submit"
                  className="flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-black text-white shadow-md hover:bg-emerald-500"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Guardar Compra y Actualizar Stock
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Historial de Compras Registradas */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-base font-extrabold">
          Historial de Compras a Proveedores ({purchases.length})
        </h3>
        <div className="space-y-3">
          {purchases.map((pur) => (
            <div
              key={pur.id}
              className="rounded-2xl border border-zinc-200 p-4 text-xs dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-sm font-black">{pur.folio_invoice}</span>
                  <span className="ml-2 font-bold text-orange-600">{pur.supplier_name}</span>
                  <span
                    className={`ml-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      pur.payment_status === 'pagada'
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : 'bg-amber-500/15 text-amber-600'
                    }`}
                  >
                    {pur.payment_status}
                  </span>
                  <p className="mt-0.5 text-zinc-500">
                    Fecha: {formatDateTimeMX(pur.purchased_at)} • Registró: {pur.user_name}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-base font-black">{formatMXN(pur.total_amount)}</span>
                  <span className="block text-[11px] text-zinc-500">
                    Pagado: {formatMXN(pur.paid_amount)}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                {pur.items.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] dark:bg-zinc-800"
                  >
                    +{item.units_added_to_stock} {item.product_name_snapshot} ({formatMXN(item.unit_cost)} c/u)
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanForPurchase}
        title="Escanear Producto para Compra"
        subtitle="Agrega el producto escaneado a la factura de compra"
      />
    </div>
  );
}
