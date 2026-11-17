'use client';

import React, { useState } from 'react';
import { Scale, ShoppingCart, X } from 'lucide-react';
import { Product } from '@/types/database';
import { calculateWeighableSale, formatMXN } from '@/lib/utils/formatters';

interface WeighableItemModalProps {
  product: Product | null;
  onClose: () => void;
  onConfirm: (product: Product, quantityKg: number, subtotalMXN: number) => void;
}

export function WeighableItemModal({
  product,
  onClose,
  onConfirm,
}: WeighableItemModalProps) {
  const [inputMode, setInputMode] = useState<'weight' | 'amount'>('weight');
  const [weightKgInput, setWeightKgInput] = useState<string>('0.500');
  const [amountMXNInput, setAmountMXNInput] = useState<string>('25');

  if (!product) return null;

  const calculation =
    inputMode === 'weight'
      ? calculateWeighableSale({
          pricePerKg: product.sale_price,
          weightKg: Number(weightKgInput) || 0,
        })
      : calculateWeighableSale({
          pricePerKg: product.sale_price,
          requestedAmountMXN: Number(amountMXNInput) || 0,
        });

  const quickWeights = [
    { label: '100 g (1/10)', kg: 0.1 },
    { label: '250 g (1/4 kg)', kg: 0.25 },
    { label: '500 g (1/2 kg)', kg: 0.5 },
    { label: '750 g (3/4 kg)', kg: 0.75 },
    { label: '1 Kg', kg: 1.0 },
    { label: '2 Kg', kg: 2.0 },
  ];

  const quickAmountsMXN = [15, 20, 25, 30, 50, 100];

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (calculation.weightKg <= 0 || calculation.subtotalMXN <= 0) return;
    onConfirm(product, calculation.weightKg, calculation.subtotalMXN);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-emerald-600 px-5 py-4 text-white dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                Venta a Granel / Báscula
              </span>
              <h3 className="text-base font-black leading-tight">{product.name}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="space-y-4 p-5">
          <div className="flex items-center justify-between rounded-xl bg-zinc-100 px-4 py-2.5 text-xs dark:bg-zinc-900">
            <span className="font-semibold text-zinc-500">Precio por {product.sale_unit}:</span>
            <span className="text-base font-black text-zinc-900 dark:text-white">
              {formatMXN(product.sale_price)} / {product.sale_unit}
            </span>
          </div>

          {/* Selector de Modo: Por Peso vs Por Importe en Pesos */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1.5 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setInputMode('weight')}
              className={`rounded-xl py-2.5 text-xs font-extrabold transition ${
                inputMode === 'weight'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500'
              }`}
            >
              Capturar Peso (Kg / g)
            </button>
            <button
              type="button"
              onClick={() => setInputMode('amount')}
              className={`rounded-xl py-2.5 text-xs font-extrabold transition ${
                inputMode === 'amount'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500'
              }`}
            >
              Pedir por Importe ($ MXN)
            </button>
          </div>

          {inputMode === 'weight' ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold">
                  Peso en Kilogramos (ej. 0.250 = 250 gramos)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.005"
                  autoFocus
                  value={weightKgInput}
                  onChange={(e) => setWeightKgInput(e.target.value)}
                  className="h-14 w-full rounded-2xl border-2 border-emerald-500 bg-transparent px-4 text-center text-2xl font-black focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {quickWeights.map((w) => (
                  <button
                    key={w.kg}
                    type="button"
                    onClick={() => setWeightKgInput(String(w.kg))}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 py-2 text-xs font-bold hover:border-emerald-500 hover:bg-emerald-500/10 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold">
                  Importe Solicitado en Pesos MXN (Ej. &quot;Deme $25 de jamón&quot;)
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="1"
                  autoFocus
                  value={amountMXNInput}
                  onChange={(e) => setAmountMXNInput(e.target.value)}
                  className="h-14 w-full rounded-2xl border-2 border-orange-500 bg-transparent px-4 text-center text-2xl font-black focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {quickAmountsMXN.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountMXNInput(String(amt))}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 py-2 text-xs font-bold hover:border-orange-500 hover:bg-orange-500/10 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    ${amt} MXN
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resumen Calculado */}
          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div>
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                Peso a despachar:
              </span>
              <p className="text-lg font-black text-zinc-900 dark:text-white">
                {calculation.weightKg} kg ({calculation.weightGrams} g)
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                Total a cobrar:
              </span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatMXN(calculation.subtotalMXN)}
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 active:scale-[0.99]"
          >
            <ShoppingCart className="h-5 w-5" />
            Agregar al Carrito ({formatMXN(calculation.subtotalMXN)})
          </button>
        </form>
      </div>
    </div>
  );
}
