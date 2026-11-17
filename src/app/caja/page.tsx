'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
  Unlock,
  X,
} from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import { formatDateTimeMX, formatMXN, roundCurrency } from '@/lib/utils/formatters';
import { toast } from 'sonner';

function CajaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    cashShifts,
    cashMovements,
    openCashShift,
    registerCashMovement,
    closeCashShift,
    currentUser,
  } = useTiendaStore();

  const activeShift = cashShifts.find((s) => s.status === 'abierta');

  // Formulario Apertura de Caja
  const [openingAmount, setOpeningAmount] = useState('1500');
  const [openingNotes, setOpeningNotes] = useState('Fondo inicial de cambio en mostrador');

  // Formulario Movimiento de Efectivo (Ingreso / Egreso)
  const [isMovModalOpen, setIsMovModalOpen] = useState(false);
  const [movType, setMovType] = useState<'ingreso' | 'egreso'>('egreso');
  const [movAmount, setMovAmount] = useState('');
  const [movConcept, setMovConcept] = useState('');

  // Formulario Corte de Caja
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  // Escuchar acciones desde la barra superior (Alt+R -> ?accion=retiro, Alt+T -> ?accion=corte)
  useEffect(() => {
    const accion = searchParams.get('accion');
    if (accion === 'retiro' && activeShift) {
      setMovType('egreso');
      setIsMovModalOpen(true);
      router.replace('/caja');
    } else if (accion === 'corte' && activeShift) {
      setCountedCashInput(String(activeShift.expected_cash));
      setCloseNotes('');
      setIsCloseModalOpen(true);
      router.replace('/caja');
    }
  }, [searchParams, activeShift, router]);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(openingAmount) || 0;
    await openCashShift(amt, openingNotes);
    toast.success(`Turno de caja abierto con fondo inicial de ${formatMXN(amt)}`);
  };

  const handleRegisterMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(movAmount) || 0;
    if (amt <= 0 || !movConcept.trim()) {
      toast.error('Ingresa un monto mayor a $0 y el concepto del movimiento.');
      return;
    }
    await registerCashMovement({
      type: movType,
      amount: amt,
      concept: movConcept,
    });
    toast.success(
      movType === 'ingreso'
        ? `Ingreso de efectivo (${formatMXN(amt)}) registrado en caja`
        : `Retiro de efectivo (${formatMXN(amt)}) registrado en caja`
    );
    setIsMovModalOpen(false);
    setMovAmount('');
    setMovConcept('');
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const counted = Number(countedCashInput) || 0;
    const closed = await closeCashShift(counted, closeNotes);
    toast.success(
      `Corte de caja finalizado. Diferencia: ${formatMXN(closed.difference || 0)}`
    );
    setIsCloseModalOpen(false);
  };

  const shiftMovements = activeShift
    ? cashMovements.filter((m) => m.shift_id === activeShift.id)
    : [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#e0e4e8] bg-white p-5 shadow-sm">
        {/* Encabezado Minimalista */}
        <div className="mb-5 flex flex-col gap-3 border-b border-[#e6e8eb] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#0066cc]">
              Control de Caja y Turnos (CAJA-01)
            </h1>
            <p className="text-xs text-[#666]">
              Apertura de turno, entradas y retiros de efectivo (Alt+R) y corte de caja (Alt+T).
            </p>
          </div>

          {activeShift && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMovType('ingreso');
                  setIsMovModalOpen(true);
                }}
                className="flex h-9 items-center gap-1.5 rounded-md border border-[#0066cc] bg-white px-3.5 text-xs font-bold text-[#0066cc] hover:bg-[#e8f0f8]"
              >
                <ArrowUpCircle className="h-4 w-4" />
                Entrada de Efectivo
              </button>

              <button
                type="button"
                onClick={() => {
                  setMovType('egreso');
                  setIsMovModalOpen(true);
                }}
                className="flex h-9 items-center gap-1.5 rounded-md border border-[#0066cc] bg-white px-3.5 text-xs font-bold text-[#0066cc] hover:bg-[#e8f0f8]"
              >
                <ArrowDownCircle className="h-4 w-4" />
                Retirar Efectivo (Alt+R)
              </button>

              <button
                type="button"
                onClick={() => {
                  setCountedCashInput(String(activeShift.expected_cash));
                  setCloseNotes('');
                  setIsCloseModalOpen(true);
                }}
                className="flex h-9 items-center gap-1.5 rounded-md bg-[#0066cc] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
              >
                <Lock className="h-4 w-4" />
                Nuevo Corte (Alt+T)
              </button>
            </div>
          )}
        </div>

        {/* Estado de Turno Actual */}
        {!activeShift ? (
          <div className="mx-auto my-6 max-w-md rounded-xl border border-[#d0d5dd] bg-[#f4f6f8] p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0066cc] text-white">
                <Unlock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#222]">Abrir Turno en CAJA-01</h2>
                <p className="text-xs text-[#666]">
                  Captura el fondo inicial en efectivo para comenzar a cobrar.
                </p>
              </div>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#d95c38]">
                  Fondo Inicial en Efectivo ($ MXN) *
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  required
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  className="h-10 w-full rounded-md border border-[#ccc] bg-white px-3 text-base font-bold text-[#222] focus:border-[#0066cc] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#333]">
                  Observaciones de Apertura
                </label>
                <input
                  type="text"
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  className="h-9 w-full rounded-md border border-[#ccc] bg-white px-3 text-xs text-[#222] focus:border-[#0066cc] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#0066cc] text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
              >
                <Unlock className="h-4 w-4" />
                Abrir Caja ({currentUser.full_name})
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Indicadores del Turno Activo */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[#e0e4e8] bg-[#f8f9fa] p-4">
                <span className="text-[11px] font-bold uppercase text-[#666]">
                  Fondo Inicial + Ventas Efectivo
                </span>
                <p className="mt-1 text-xl font-black text-[#222]">
                  {formatMXN(activeShift.opening_amount + activeShift.cash_sales_total)}
                </p>
                <p className="mt-0.5 text-[11px] text-[#666]">
                  Fondo: {formatMXN(activeShift.opening_amount)} • Ventas:{' '}
                  {formatMXN(activeShift.cash_sales_total)}
                </p>
              </div>

              <div className="rounded-lg border border-[#e0e4e8] bg-[#f8f9fa] p-4">
                <span className="text-[11px] font-bold uppercase text-[#666]">
                  Entradas / Retiros de Caja
                </span>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-base font-black text-[#2e7d32]">
                    +{formatMXN(activeShift.cash_in_total)}
                  </span>
                  <span className="text-base font-black text-[#d9534f]">
                    -{formatMXN(activeShift.cash_out_total)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#666]">
                  Movimientos manuales del turno
                </p>
              </div>

              <div className="rounded-lg border-2 border-[#0066cc] bg-[#e8f0f8]/50 p-4">
                <span className="text-[11px] font-bold uppercase text-[#0066cc]">
                  Efectivo Esperado en Cajón
                </span>
                <p className="mt-1 text-2xl font-black text-[#0066cc]">
                  {formatMXN(activeShift.expected_cash)}
                </p>
                <p className="mt-0.5 text-[11px] text-[#555]">
                  Fondo + Ventas Efec. + Entradas - Retiros
                </p>
              </div>

              <div className="rounded-lg border border-[#e0e4e8] bg-[#f8f9fa] p-4">
                <span className="text-[11px] font-bold uppercase text-[#666]">
                  Otros Métodos de Pago
                </span>
                <div className="mt-1 space-y-0.5 text-xs">
                  <p>
                    Tarjeta: <strong>{formatMXN(activeShift.card_sales_total)}</strong>
                  </p>
                  <p>
                    Vales / Transf.: <strong>{formatMXN(activeShift.transfer_sales_total)}</strong>
                  </p>
                  <p className="text-[#d95c38]">
                    Fiado: <strong>{formatMXN(activeShift.credit_sales_total)}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Movimientos del Turno */}
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase text-[#555]">
                Movimientos de Efectivo en este Turno ({shiftMovements.length})
              </h3>
              <div className="overflow-hidden rounded-lg border border-[#d5d8dc] bg-[#e6e8eb]">
                {shiftMovements.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#666]">
                    Sin retiros ni entradas manuales registrados en este turno.
                  </p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#d0d4d9] bg-[#eef0f3] text-[11px] font-bold text-[#555]">
                      <tr>
                        <th className="px-3.5 py-2">Tipo</th>
                        <th className="px-3.5 py-2">Concepto</th>
                        <th className="px-3.5 py-2">Fecha / Hora</th>
                        <th className="px-3.5 py-2 text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftMovements.map((m, idx) => (
                        <tr
                          key={m.id}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f4f6f8]'}
                        >
                          <td className="px-3.5 py-2 font-bold uppercase">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] ${
                                m.type === 'ingreso'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {m.type}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 font-medium text-[#222]">{m.concept}</td>
                          <td className="px-3.5 py-2 text-[#666]">
                            {formatDateTimeMX(m.created_at)}
                          </td>
                          <td
                            className={`px-3.5 py-2 text-right font-bold ${
                              m.type === 'ingreso' ? 'text-[#2e7d32]' : 'text-[#d9534f]'
                            }`}
                          >
                            {m.type === 'ingreso' ? '+' : '-'}
                            {formatMXN(m.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historial de Cortes de Caja */}
      <div className="rounded-xl border border-[#e0e4e8] bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-[#0066cc]">
          Historial de Cortes de Caja ({cashShifts.length})
        </h3>
        <div className="overflow-hidden rounded-lg border border-[#d5d8dc] bg-[#e6e8eb]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#d0d4d9] bg-[#eef0f3] text-[11px] font-bold text-[#555]">
                <tr>
                  <th className="px-3.5 py-2.5">Apertura / Cierre</th>
                  <th className="px-3.5 py-2.5">Cajero</th>
                  <th className="px-3.5 py-2.5 text-right">Fondo</th>
                  <th className="px-3.5 py-2.5 text-right">Ventas Efectivo</th>
                  <th className="px-3.5 py-2.5 text-right">Esperado</th>
                  <th className="px-3.5 py-2.5 text-right">Contado</th>
                  <th className="px-3.5 py-2.5 text-right">Diferencia</th>
                  <th className="px-3.5 py-2.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cashShifts.map((shift, idx) => (
                  <tr
                    key={shift.id}
                    className={`border-b border-[#dcdcdc] ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-[#f4f6f8]'
                    }`}
                  >
                    <td className="px-3.5 py-2.5">
                      <div className="font-medium text-[#222]">
                        Abrió: {formatDateTimeMX(shift.opened_at)}
                      </div>
                      {shift.closed_at && (
                        <div className="text-[11px] text-[#666]">
                          Cerró: {formatDateTimeMX(shift.closed_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 font-bold uppercase text-[#333]">
                      {shift.opened_by_name}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">{formatMXN(shift.opening_amount)}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold">
                      {formatMXN(shift.cash_sales_total)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-[#0066cc]">
                      {formatMXN(shift.expected_cash)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold">
                      {shift.counted_cash !== null && shift.counted_cash !== undefined
                        ? formatMXN(shift.counted_cash)
                        : '—'}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-extrabold">
                      {shift.difference !== null && shift.difference !== undefined ? (
                        <span
                          className={
                            shift.difference === 0
                              ? 'text-[#2e7d32]'
                              : shift.difference > 0
                              ? 'text-[#0066cc]'
                              : 'text-[#d9534f]'
                          }
                        >
                          {shift.difference > 0 ? '+' : ''}
                          {formatMXN(shift.difference)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          shift.status === 'abierta'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-[#e0e4e8] text-[#555]'
                        }`}
                      >
                        {shift.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Retiro / Entrada de Efectivo */}
      {isMovModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-lg border border-[#b0b8c1] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e0e4e8] bg-[#f4f6f8] px-4 py-2.5">
              <span className="text-xs font-bold text-[#333]">
                Tienda Tigre | {movType === 'ingreso' ? 'Entrada de Efectivo' : 'Retirar Efectivo'}
              </span>
              <button
                type="button"
                onClick={() => setIsMovModalOpen(false)}
                className="rounded p-1 text-[#555] hover:bg-[#e6e8eb]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterMovement} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#d95c38]">
                  Monto en Efectivo ($ MXN) *
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0.50"
                  required
                  autoFocus
                  value={movAmount}
                  onChange={(e) => setMovAmount(e.target.value)}
                  className="h-9 w-full rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-sm font-bold text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#d95c38]">
                  Concepto / Motivo *
                </label>
                <input
                  type="text"
                  required
                  value={movConcept}
                  onChange={(e) => setMovConcept(e.target.value)}
                  placeholder="Ej. Pago proveedor o retiro de seguridad..."
                  className="h-9 w-full rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMovModalOpen(false)}
                  className="h-9 rounded-md border border-[#b0b8c1] bg-white px-4 text-xs font-bold text-[#555] hover:bg-[#f4f6f8]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 rounded-md bg-[#0066cc] px-5 text-xs font-bold text-white hover:bg-[#0055b3]"
                >
                  Aceptar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Corte de Caja */}
      {isCloseModalOpen && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-lg border border-[#b0b8c1] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e0e4e8] bg-[#f4f6f8] px-4 py-2.5">
              <span className="text-xs font-bold text-[#333]">
                Tienda Tigre | Nuevo Corte de Caja
              </span>
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                className="rounded p-1 text-[#555] hover:bg-[#e6e8eb]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4 p-5">
              <div className="space-y-1.5 rounded-lg border border-[#e0e4e8] bg-[#f4f6f8] p-3.5 text-xs">
                <div className="flex justify-between">
                  <span>Fondo Inicial:</span>
                  <strong>{formatMXN(activeShift.opening_amount)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>+ Ventas en Efectivo:</span>
                  <strong>{formatMXN(activeShift.cash_sales_total)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>+ Entradas de Efectivo:</span>
                  <strong>{formatMXN(activeShift.cash_in_total)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>- Retiros de Efectivo:</span>
                  <strong>-{formatMXN(activeShift.cash_out_total)}</strong>
                </div>
                <div className="flex justify-between border-t border-[#ccc] pt-1.5 text-sm font-black">
                  <span>Efectivo Esperado:</span>
                  <span className="text-[#0066cc]">
                    {formatMXN(activeShift.expected_cash)}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#d95c38]">
                  Efectivo Físico Contado en Cajón ($ MXN) *
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  required
                  autoFocus
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(e.target.value)}
                  className="h-11 w-full rounded-md border-2 border-[#0066cc] bg-white px-3 text-center text-xl font-black text-[#0066cc] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg bg-[#f4f6f8] px-4 py-2 text-xs">
                <span className="font-bold text-[#555]">Diferencia:</span>
                <span
                  className={`text-base font-black ${
                    roundCurrency((Number(countedCashInput) || 0) - activeShift.expected_cash) < 0
                      ? 'text-[#d9534f]'
                      : 'text-[#2e7d32]'
                  }`}
                >
                  {formatMXN((Number(countedCashInput) || 0) - activeShift.expected_cash)}
                </span>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#333]">
                  Observaciones del Corte
                </label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Notas opcionales del cierre..."
                  className="h-9 w-full rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs focus:border-[#0066cc] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(false)}
                  className="h-9 rounded-md border border-[#b0b8c1] bg-white px-4 text-xs font-bold text-[#555] hover:bg-[#f4f6f8]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex h-9 items-center gap-1.5 rounded-md bg-[#0066cc] px-5 text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Finalizar Corte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CajaPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-[#666]">Cargando caja...</div>}>
      <CajaContent />
    </Suspense>
  );
}
