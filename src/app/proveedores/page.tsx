'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Banknote,
  Calendar,
  CheckCircle2,
  Edit3,
  MessageCircle,
  Phone,
  Plus,
  Scale,
  Truck,
  X,
} from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import { Supplier } from '@/types/database';
import {
  buildWhatsAppUrl,
  formatDateShortMX,
  formatMXN,
} from '@/lib/utils/formatters';
import { supplierFormSchema } from '@/lib/validations/schemas';
import { toast } from 'sonner';

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function ProveedoresPage() {
  const {
    suppliers,
    supplierQuotes,
    products,
    saveSupplier,
    saveSupplierQuote,
    paySupplierBalance,
  } = useTiendaStore();

  const [activeTab, setActiveTab] = useState<'catalogo' | 'comparador'>('catalogo');

  // Modal Proveedor
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [visitDays, setVisitDays] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Modal Pago a Proveedor (Cuentas por Pagar)
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payFromCash, setPayFromCash] = useState(true);
  const [payNotes, setPayNotes] = useState('');

  // Modal Nueva Cotización en Comparador
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteSupplierId, setQuoteSupplierId] = useState('');
  const [quoteProductId, setQuoteProductId] = useState('');
  const [quoteCostPrice, setQuoteCostPrice] = useState('');
  const [quoteIsPreferred, setQuoteIsPreferred] = useState(false);

  const openCreateSupplier = () => {
    setEditingSupplier(null);
    setName('');
    setContactName('');
    setPhone('');
    setEmail('');
    setVisitDays(['Lunes', 'Jueves']);
    setNotes('');
    setFormError(null);
    setIsSupplierModalOpen(true);
  };

  const openEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setName(sup.name);
    setContactName(sup.contact_name);
    setPhone(sup.phone);
    setEmail(sup.email || '');
    setVisitDays(sup.visit_days || []);
    setNotes(sup.notes || '');
    setFormError(null);
    setIsSupplierModalOpen(true);
  };

  const toggleDay = (day: string) => {
    setVisitDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsed = supplierFormSchema.safeParse({
      name,
      contact_name: contactName,
      phone,
      email,
      visit_days: visitDays,
      notes,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Verifica los campos');
      return;
    }

    await saveSupplier({
      id: editingSupplier?.id,
      ...parsed.data,
    });

    toast.success(
      editingSupplier
        ? `Proveedor "${parsed.data.name}" actualizado`
        : `Proveedor "${parsed.data.name}" registrado`
    );
    setIsSupplierModalOpen(false);
  };

  const handlePaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier) return;
    const amt = Number(payAmount) || 0;
    if (amt <= 0) return;

    await paySupplierBalance({
      supplierId: payingSupplier.id,
      amount: amt,
      fromCashShift: payFromCash,
      notes: payNotes,
    });

    toast.success(`Abono de ${formatMXN(amt)} registrado a ${payingSupplier.name}`);
    setPayingSupplier(null);
  };

  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = Number(quoteCostPrice) || 0;
    if (!quoteSupplierId || !quoteProductId || cost <= 0) {
      toast.error('Selecciona proveedor, producto y un costo mayor a $0');
      return;
    }

    await saveSupplierQuote({
      supplier_id: quoteSupplierId,
      product_id: quoteProductId,
      last_cost_price: cost,
      is_preferred: quoteIsPreferred,
    });

    toast.success('Costo de proveedor actualizado en el comparador');
    setIsQuoteModalOpen(false);
  };

  // Agrupación de productos con sus cotizaciones ordenadas de más barato a más caro
  const productComparisonGroups = useMemo(() => {
    const map: Record<
      string,
      {
        productId: string;
        productName: string;
        salePrice: number;
        quotes: typeof supplierQuotes;
      }
    > = {};

    for (const q of supplierQuotes) {
      const prod = products.find((p) => p.id === q.product_id);
      if (!prod) continue;
      if (!map[prod.id]) {
        map[prod.id] = {
          productId: prod.id,
          productName: prod.name,
          salePrice: prod.sale_price,
          quotes: [],
        };
      }
      map[prod.id].quotes.push(q);
    }

    return Object.values(map).map((g) => ({
      ...g,
      quotes: g.quotes.sort((a, b) => a.last_cost_price - b.last_cost_price),
    }));
  }, [supplierQuotes, products]);

  const totalPayables = suppliers.reduce((acc, s) => acc + s.payable_balance, 0);

  return (
    <div className="space-y-6">
      {/* Encabezado Minimalista */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0066cc]">
            Proveedores, Cuentas por Pagar y Comparador de Costos
          </h1>
          <p className="text-xs text-[#666]">
            Agenda de visitas de preventistas, liquidación de facturas y comparativa de precios de compra.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setQuoteSupplierId(suppliers[0]?.id || '');
              setQuoteProductId(products[0]?.id || '');
              setQuoteCostPrice('');
              setQuoteIsPreferred(false);
              setIsQuoteModalOpen(true);
            }}
            className="flex h-9 items-center gap-1.5 rounded-md border border-[#0066cc] bg-white px-3 text-xs font-bold text-[#0066cc] hover:bg-[#e8f0f8]"
          >
            <ArrowDownUp className="h-4 w-4" />
            Cotizar Producto
          </button>

          <button
            type="button"
            onClick={openCreateSupplier}
            className="flex h-9 items-center gap-1.5 rounded-md bg-[#0066cc] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
          >
            <Plus className="h-4 w-4" />
            Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* Pestañas estilo Carpeta */}
      <div className="flex items-center justify-between border-b border-[#d0d5dd] bg-[#e2e5e9] px-2 pt-2 rounded-t-lg">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('catalogo')}
            className={`rounded-t-lg px-4 py-2 text-xs font-bold ${
              activeTab === 'catalogo'
                ? 'bg-[#0066cc] text-white shadow-sm'
                : 'bg-[#d4d8dd] text-[#444] hover:bg-[#dcdfe4]'
            }`}
          >
            Directorio y Cuentas por Pagar ({suppliers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('comparador')}
            className={`rounded-t-lg px-4 py-2 text-xs font-bold ${
              activeTab === 'comparador'
                ? 'bg-[#0066cc] text-white shadow-sm'
                : 'bg-[#d4d8dd] text-[#444] hover:bg-[#dcdfe4]'
            }`}
          >
            Comparador de Costos entre Proveedores
          </button>
        </div>

        <div className="hidden pb-1.5 pr-3 text-right sm:block">
          <span className="text-xs text-[#555]">Total Cuentas por Pagar: </span>
          <strong className="text-sm font-black text-[#d95c38]">
            {formatMXN(totalPayables)}
          </strong>
        </div>
      </div>

      {activeTab === 'catalogo' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {suppliers.map((sup) => {
            const suppliedQuotes = supplierQuotes.filter((q) => q.supplier_id === sup.id);
            return (
              <div
                key={sup.id}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-black">
                        <Truck className="h-5 w-5 text-orange-500" />
                        {sup.name}
                      </h3>
                      <p className="text-xs font-semibold text-zinc-500">
                        Contacto: {sup.contact_name} • Tel: {sup.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditSupplier(sup)}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Días de visita */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 text-[11px] font-bold text-zinc-400">
                      <Calendar className="h-3.5 w-3.5" /> Visita:
                    </span>
                    {sup.visit_days.map((day) => (
                      <span
                        key={day}
                        className="rounded-lg bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400"
                      >
                        {day}
                      </span>
                    ))}
                  </div>

                  {sup.notes && (
                    <p className="mt-2.5 rounded-xl bg-zinc-50 p-2.5 text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                      {sup.notes}
                    </p>
                  )}

                  {suppliedQuotes.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-[11px] font-bold uppercase text-zinc-400">
                        Productos que surte ({suppliedQuotes.length}):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {suppliedQuotes.slice(0, 5).map((q) => (
                          <span
                            key={q.id}
                            className="rounded-lg border border-zinc-200 px-2 py-0.5 text-[11px] dark:border-zinc-800"
                          >
                            {q.product_name}: <strong>{formatMXN(q.last_cost_price)}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <div>
                    <span className="text-[11px] text-zinc-400">Saldo por pagar:</span>
                    <p
                      className={`text-lg font-black ${
                        sup.payable_balance > 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      {formatMXN(sup.payable_balance)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={buildWhatsAppUrl(
                        sup.phone,
                        `Hola ${sup.contact_name} (${sup.name}), le escribimos de Abarrotes El Tigre para confirmar pedido de visita.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600/10 px-3 text-xs font-bold text-emerald-600 hover:bg-emerald-600/20"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>

                    {sup.payable_balance > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayingSupplier(sup);
                          setPayAmount(String(sup.payable_balance));
                          setPayNotes('');
                        }}
                        className="flex h-9 items-center gap-1.5 rounded-md bg-[#0066cc] px-3.5 text-xs font-bold text-white hover:bg-[#0055b3]"
                      >
                        <Banknote className="h-4 w-4" />
                        Liquidar / Abonar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* PESTAÑA COMPARADOR DE COSTOS ENTRE PROVEEDORES */
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4">
            <h3 className="text-sm font-extrabold text-blue-700 dark:text-blue-300">
              Comparativa de Costo del Mismo Producto entre Proveedores
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Compara quién te da mejor costo unitario y mayor margen de ganancia antes de levantar pedido.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {productComparisonGroups.map((group) => {
              const cheapest = group.quotes[0]?.last_cost_price || 0;
              return (
                <div
                  key={group.productId}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="mb-3 flex items-center justify-between border-b border-zinc-200 pb-2.5 dark:border-zinc-800">
                    <div>
                      <h4 className="text-sm font-black">{group.productName}</h4>
                      <p className="text-xs text-zinc-500">
                        Precio Venta Público: <strong>{formatMXN(group.salePrice)}</strong>
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                      Mejor Costo: {formatMXN(cheapest)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.quotes.map((q, idx) => {
                      const diff = q.last_cost_price - cheapest;
                      const marginPct =
                        q.last_cost_price > 0
                          ? (((group.salePrice - q.last_cost_price) / q.last_cost_price) * 100).toFixed(1)
                          : '0';

                      return (
                        <div
                          key={q.id}
                          className={`flex items-center justify-between rounded-xl p-2.5 text-xs ${
                            idx === 0
                              ? 'border border-emerald-500/40 bg-emerald-500/5'
                              : 'bg-zinc-50 dark:bg-zinc-950'
                          }`}
                        >
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-white">
                              {idx === 0 && '🏆 '}
                              {q.supplier_name}
                            </p>
                            <p className="text-[11px] text-zinc-500">
                              Última compra: {formatDateShortMX(q.last_purchase_at)} • Margen:{' '}
                              {marginPct}%
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black">
                              {formatMXN(q.last_cost_price)}
                            </span>
                            {diff > 0 && (
                              <span className="block text-[10px] font-bold text-red-500">
                                +{formatMXN(diff)} más caro
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Alta/Edición Proveedor */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <h3 className="text-base font-extrabold">
                {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h3>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="rounded-xl p-1.5 text-zinc-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-3 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-600">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveSupplier} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold">Empresa / Proveedor *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Coca-Cola FEMSA, Bimbo, Lala..."
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-bold">Nombre Preventista *</label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">Teléfono / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold">Días de Visita</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((day) => {
                    const selected = visitDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                          selected
                            ? 'bg-orange-600 text-white'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">Notas</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Horarios de entrega, condiciones..."
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="h-11 rounded-xl border border-zinc-300 px-4 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-orange-600 px-5 text-xs font-bold text-white"
                >
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Abono a Cuenta por Pagar a Proveedor */}
      {payingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="mb-1 text-base font-extrabold">
              Pagar a Proveedor: {payingSupplier.name}
            </h3>
            <p className="mb-4 text-xs text-zinc-500">
              Saldo pendiente actual: <strong>{formatMXN(payingSupplier.payable_balance)}</strong>
            </p>

            <form onSubmit={handlePaySupplier} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold">Monto a Pagar ($ MXN) *</label>
                <input
                  type="number"
                  step="0.50"
                  min="1"
                  max={payingSupplier.payable_balance}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-base font-black dark:border-zinc-700"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={payFromCash}
                  onChange={(e) => setPayFromCash(e.target.checked)}
                  className="h-4 w-4 accent-orange-600"
                />
                Tomar efectivo del turno de caja actual (registrar como egreso de caja)
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingSupplier(null)}
                  className="h-11 rounded-xl border border-zinc-300 px-4 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-emerald-600 px-5 text-xs font-bold text-white"
                >
                  Registrar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Agregar Cotización de Proveedor */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="mb-3 text-base font-extrabold">
              Registrar Costo de Producto por Proveedor
            </h3>
            <form onSubmit={handleSaveQuote} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold">Proveedor *</label>
                <select
                  value={quoteSupplierId}
                  onChange={(e) => setQuoteSupplierId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">Producto *</label>
                <select
                  value={quoteProductId}
                  onChange={(e) => setQuoteProductId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Costo actual: {formatMXN(p.cost_price)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">
                  Costo Unitario Ofrecido ($ MXN) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  required
                  value={quoteCostPrice}
                  onChange={(e) => setQuoteCostPrice(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm font-bold dark:border-zinc-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="h-11 rounded-xl border border-zinc-300 px-4 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-orange-600 px-5 text-xs font-bold text-white"
                >
                  Guardar Cotización
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
