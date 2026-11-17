'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import { Expense, ExpenseCategoryType } from '@/types/database';
import { formatDateShortMX, formatMXN, roundCurrency } from '@/lib/utils/formatters';
import { expenseFormSchema } from '@/lib/validations/schemas';
import { toast } from 'sonner';

const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategoryType, string> = {
  luz: 'Luz / Recibo CFE (Refrigeradores)',
  renta: 'Renta del Local',
  sueldos: 'Sueldos y Ayudantes',
  transporte: 'Transporte / Gasolina / Fletes',
  mantenimiento: 'Mantenimiento y Equipo',
  bolsas_insumos: 'Bolsas, Papel Térmico e Insumos',
  impuestos: 'Impuestos / Contador / Permisos',
  otros: 'Otros Gastos Operativos',
};

export default function GastosPage() {
  const { expenses, registerExpense, deleteExpense } = useTiendaStore();

  const [category, setCategory] = useState<ExpenseCategoryType>('luz');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<Expense['payment_method']>('efectivo_caja');
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [formError, setFormError] = useState<string | null>(null);

  const totalExpenses = useMemo(
    () => roundCurrency(expenses.reduce((acc, e) => acc + e.amount, 0)),
    [expenses]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsed = expenseFormSchema.safeParse({
      category,
      description,
      amount,
      payment_method: paymentMethod,
      expense_date: expenseDate,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Verifica los campos del gasto');
      return;
    }

    await registerExpense(parsed.data);
    toast.success(`Gasto de ${formatMXN(parsed.data.amount)} registrado correctamente`);
    setDescription('');
    setAmount('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0066cc]">
            Gastos Operativos de la Tienda
          </h1>
          <p className="text-xs text-[#666]">
            Registra luz, renta, sueldos, bolsas y transporte para calcular la Utilidad Neta Real.
          </p>
        </div>

        <div className="rounded-lg border border-[#e0e4e8] bg-[#f4f6f8] px-4 py-2 text-right">
          <span className="text-[10px] font-bold uppercase text-[#666]">
            Total Gastos Registrados
          </span>
          <p className="text-base font-black text-[#d95c38]">
            {formatMXN(totalExpenses)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Formulario de Gasto */}
        <div className="rounded-xl border border-[#e0e4e8] bg-white p-5 shadow-sm lg:col-span-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#0066cc]">
            <Wallet className="h-4 w-4 text-[#0066cc]" />
            Registrar Nuevo Gasto
          </h2>

          {formError && (
            <div className="mb-4 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-600">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold">Categoría del Gasto *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategoryType)}
                className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold">Concepto / Descripción *</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Pago recibo CFE bimestral o rollos térmicos..."
                className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold">Monto ($ MXN) *</label>
                <input
                  type="number"
                  step="0.50"
                  min="0.50"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm font-black dark:border-zinc-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">Fecha *</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold">Origen de los Fondos *</label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as Expense['payment_method'])
                }
                className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="efectivo_caja">
                  Efectivo tomado de la Caja Actual (Descuenta en Corte)
                </option>
                <option value="efectivo_externo">Efectivo Externo / Administración</option>
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="tarjeta">Tarjeta de Débito / Crédito</option>
              </select>
            </div>

            <button
              type="submit"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#0066cc] text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
            >
              <Plus className="h-4 w-4" />
              Guardar Gasto
            </button>
          </form>
        </div>

        {/* Lista de Gastos */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-7">
          <h3 className="mb-3 text-base font-extrabold">
            Bitácora de Gastos ({expenses.length})
          </h3>

          <div className="space-y-2.5">
            {expenses.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 p-3.5 text-xs dark:border-zinc-800"
              >
                <div>
                  <span className="rounded bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-600 dark:text-orange-400">
                    {EXPENSE_CATEGORY_LABELS[exp.category] || exp.category}
                  </span>
                  <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-white">
                    {exp.description}
                  </p>
                  <p className="text-zinc-500">
                    Fecha: {formatDateShortMX(exp.expense_date)} • Pago: {exp.payment_method} •{' '}
                    {exp.user_name}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-base font-black text-red-600 dark:text-red-400">
                    -{formatMXN(exp.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteExpense(exp.id);
                      toast.info('Gasto eliminado');
                    }}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
