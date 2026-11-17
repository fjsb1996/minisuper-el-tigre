'use client';

import React, { useMemo, useState } from 'react';
import {
  Banknote,
  Edit3,
  History,
  MessageCircle,
  Phone,
  Plus,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import { Customer } from '@/types/database';
import {
  buildWhatsAppUrl,
  formatDateTimeMX,
  formatMXN,
  roundCurrency,
} from '@/lib/utils/formatters';
import { customerFormSchema } from '@/lib/validations/schemas';
import { toast } from 'sonner';

export default function ClientesPage() {
  const {
    branch,
    customers,
    customerLedger,
    saveCustomer,
    registerCustomerPayment,
  } = useTiendaStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Modal Crear / Editar Cliente
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [creditLimit, setCreditLimit] = useState('1000');
  const [formError, setFormError] = useState<string | null>(null);

  // Modal Registrar Abono
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transferencia' | 'tarjeta'>(
    'efectivo'
  );
  const [paymentNotes, setPaymentNotes] = useState('');

  const totalPendingFiado = useMemo(
    () => roundCurrency(customers.reduce((acc, c) => acc + c.current_balance, 0)),
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [customers, searchQuery]);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('5255');
    setAddress('');
    setNotes('');
    setCreditLimit('1000');
    setFormError(null);
    setIsCustomerModalOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setName(cust.name);
    setPhone(cust.phone);
    setAddress(cust.address || '');
    setNotes(cust.notes || '');
    setCreditLimit(String(cust.credit_limit));
    setFormError(null);
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsed = customerFormSchema.safeParse({
      name,
      phone,
      address,
      notes,
      credit_limit: creditLimit,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Verifica los datos del cliente');
      return;
    }

    await saveCustomer({
      id: editingCustomer?.id,
      ...parsed.data,
    });

    toast.success(
      editingCustomer
        ? `Cliente "${parsed.data.name}" actualizado`
        : `Cliente "${parsed.data.name}" registrado`
    );
    setIsCustomerModalOpen(false);
  };

  const handleRegisterAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCustomer) return;

    const amt = Number(paymentAmount) || 0;
    if (amt <= 0) {
      toast.error('Ingresa un abono mayor a $0.00 MXN');
      return;
    }

    await registerCustomerPayment({
      customerId: payingCustomer.id,
      amount: amt,
      paymentMethod,
      notes: paymentNotes,
    });

    toast.success(`Abono de ${formatMXN(amt)} registrado a la cuenta de ${payingCustomer.name}`);
    setPayingCustomer(null);
  };

  const buildCollectionWhatsAppLink = (cust: Customer) => {
    const msg = [
      `Hola *${cust.name}*, le saludamos cordialmente de *${branch.name}*.`,
      ``,
      `Le enviamos un recordatorio amigable del estado de su cuenta de fiado al día de hoy:`,
      `• *Saldo pendiente:* ${formatMXN(cust.current_balance)} MXN`,
      `• *Límite autorizado:* ${formatMXN(cust.credit_limit)} MXN`,
      ``,
      `Puede pasar a realizar su abono en mostrador en efectivo o por transferencia. ¡Muchas gracias por su preferencia!`,
    ].join('\n');

    return buildWhatsAppUrl(cust.phone, msg);
  };

  const activeLedgerCustomer = selectedCustomer || customers[0] || null;
  const activeCustomerEntries = useMemo(() => {
    if (!activeLedgerCustomer) return customerLedger;
    return customerLedger.filter((l) => l.customer_id === activeLedgerCustomer.id);
  }, [customerLedger, activeLedgerCustomer]);

  return (
    <div className="space-y-6">
      {/* Encabezado Minimalista */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0066cc]">
            Clientes y Cuentas de Fiado (Crédito)
          </h1>
          <p className="text-xs text-[#666]">
            Control de saldo pendiente, límite de crédito, abonos y recordatorios por WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-[#e0e4e8] bg-[#f4f6f8] px-3.5 py-1.5 text-right">
            <span className="text-[10px] font-bold uppercase text-[#666]">
              Total Fiado por Cobrar
            </span>
            <p className="text-base font-black text-[#d95c38]">
              {formatMXN(totalPendingFiado)}
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex h-9 items-center gap-1.5 rounded-md bg-[#0066cc] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar cliente por nombre, teléfono o dirección..."
          className="h-9 w-full rounded-md border border-[#ccc] bg-white pl-9 pr-4 text-xs font-medium text-[#222] focus:border-[#0066cc] focus:outline-none"
        />
      </div>

      {/* Layout Dividido: Cartera de Clientes + Estado de Cuenta */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Lista de Clientes */}
        <div className="space-y-3 lg:col-span-7">
          {filteredCustomers.map((cust) => {
            const isSelected = activeLedgerCustomer?.id === cust.id;
            const creditUsedPct =
              cust.credit_limit > 0
                ? Math.min(100, Math.round((cust.current_balance / cust.credit_limit) * 100))
                : 0;

            return (
              <div
                key={cust.id}
                onClick={() => setSelectedCustomer(cust)}
                className={`cursor-pointer rounded-xl border p-4 transition ${
                  isSelected
                    ? 'border-[#0066cc] bg-[#e8f0f8]/50 ring-1 ring-[#0066cc]'
                    : 'border-[#e0e4e8] bg-white hover:border-[#0066cc]/50'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-zinc-900 dark:text-white">
                      {cust.name}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Tel: {cust.phone} {cust.address ? `• ${cust.address}` : ''}
                    </p>
                    {cust.notes && (
                      <p className="mt-1 text-xs italic text-zinc-400">{cust.notes}</p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-bold uppercase text-zinc-400">
                      Saldo Pendiente
                    </span>
                    <p
                      className={`text-xl font-black ${
                        cust.current_balance > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {formatMXN(cust.current_balance)}
                    </p>
                    <span className="text-[11px] text-zinc-400">
                      Límite: {formatMXN(cust.credit_limit)} ({creditUsedPct}%)
                    </span>
                  </div>
                </div>

                {/* Barra de uso de crédito */}
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${
                      creditUsedPct > 85
                        ? 'bg-red-500'
                        : creditUsedPct > 50
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${creditUsedPct}%` }}
                  />
                </div>

                {/* Botones de Acción del Cliente */}
                <div
                  className="mt-3 flex flex-wrap items-center justify-end gap-2 pt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => openEditModal(cust)}
                    className="flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-bold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Editar
                  </button>

                  {cust.current_balance > 0 && (
                    <>
                      <a
                        href={buildCollectionWhatsAppLink(cust)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600/15 px-3 py-1.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-600/25 dark:text-emerald-300"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Recordatorio WhatsApp
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          setPayingCustomer(cust);
                          setPaymentAmount(String(cust.current_balance));
                          setPaymentNotes('');
                        }}
                        className="flex items-center gap-1.5 rounded-md bg-[#0066cc] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        Registrar Abono
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Estado de Cuenta e Historial de Cargos y Abonos */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-5">
          <div className="mb-4 border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <h3 className="flex items-center gap-2 text-base font-extrabold">
              <History className="h-4 w-4 text-orange-500" />
              Historial de Fiado y Abonos
            </h3>
            {activeLedgerCustomer && (
              <p className="text-xs text-zinc-500">
                Estado de cuenta de: <strong>{activeLedgerCustomer.name}</strong>
              </p>
            )}
          </div>

          <div className="max-h-[60vh] space-y-2.5 overflow-y-auto">
            {activeCustomerEntries.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-500">
                Sin movimientos de fiado o abonos registrados para este cliente.
              </p>
            ) : (
              activeCustomerEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        entry.entry_type === 'abono'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-amber-500/15 text-amber-600'
                      }`}
                    >
                      {entry.entry_type === 'abono'
                        ? `Abono (${entry.payment_method})`
                        : 'Cargo por Compra a Fiado'}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {formatDateTimeMX(entry.created_at)}
                    </span>
                  </div>

                  <p className="mt-1.5 font-semibold text-zinc-800 dark:text-zinc-200">
                    {entry.notes}
                  </p>

                  <div className="mt-2 flex items-center justify-between border-t border-zinc-200/70 pt-1.5 dark:border-zinc-800">
                    <span className="text-[11px] text-zinc-500">
                      Saldo: {formatMXN(entry.balance_before)} →{' '}
                      <strong>{formatMXN(entry.balance_after)}</strong>
                    </span>
                    <span
                      className={`text-sm font-black ${
                        entry.entry_type === 'abono' ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {entry.entry_type === 'abono' ? '-' : '+'}
                      {formatMXN(entry.amount)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Alta/Edición de Cliente */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <h3 className="text-base font-extrabold">
                {editingCustomer ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
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

            <form onSubmit={handleSaveCustomer} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold">Nombre Completo / Apodo *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Doña Martha Gómez (Depa 4B)"
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">
                  Teléfono Celular (Para Recordatorio WhatsApp) *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="525512345678"
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">Dirección / Referencia</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle, número interior o negocio..."
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">
                  Límite de Crédito Autorizado ($ MXN) *
                </label>
                <input
                  type="number"
                  step="50"
                  min="0"
                  required
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm font-bold dark:border-zinc-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">Notas</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Paga cada quincena..."
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="h-11 rounded-xl border border-zinc-300 px-4 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 rounded-md bg-[#0066cc] px-5 text-xs font-bold text-white hover:bg-[#0055b3]"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Abono */}
      {payingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-base font-extrabold">
              Registrar Abono de Fiado: {payingCustomer.name}
            </h3>
            <p className="mb-4 text-xs text-zinc-500">
              Saldo actual pendiente: <strong>{formatMXN(payingCustomer.current_balance)}</strong>
            </p>

            <form onSubmit={handleRegisterAbono} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold">Monto del Abono ($ MXN) *</label>
                <input
                  type="number"
                  step="0.50"
                  min="1"
                  max={payingCustomer.current_balance}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="h-12 w-full rounded-xl border-2 border-emerald-500 bg-transparent px-3 text-center text-xl font-black"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">Forma de Pago *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as 'efectivo' | 'transferencia' | 'tarjeta')
                  }
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="efectivo">Efectivo (Ingresa a la Caja Actual)</option>
                  <option value="transferencia">Transferencia SPEI</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">Nota del Abono</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Ej. Abono quincenal en mostrador"
                  className="h-10 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-xs dark:border-zinc-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingCustomer(null)}
                  className="h-11 rounded-xl border border-zinc-300 px-4 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-emerald-600 px-5 text-xs font-extrabold text-white"
                >
                  Confirmar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
