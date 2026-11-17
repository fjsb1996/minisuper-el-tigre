'use client';

import React, { useState } from 'react';
import { MessageCircle, Printer, Receipt, X } from 'lucide-react';
import { Branch, Sale } from '@/types/database';
import {
  buildWhatsAppUrl,
  formatDateTimeMX,
  formatMXN,
  formatQuantityWithUnit,
} from '@/lib/utils/formatters';

interface ThermalTicketModalProps {
  sale: Sale | null;
  branch: Branch;
  onClose: () => void;
}

export function ThermalTicketModal({
  sale,
  branch,
  onClose,
}: ThermalTicketModalProps) {
  const [paperWidth, setPaperWidth] = useState<58 | 80>(branch.printer_width_mm || 58);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const generateWhatsAppText = () => {
    const lines = [
      `*${branch.name}*`,
      `Folio: ${sale.folio}`,
      `Fecha: ${formatDateTimeMX(sale.created_at)}`,
      `Cliente: ${sale.customer_name || 'Público en General'}`,
      `--------------------------------`,
      ...sale.items.map(
        (i) =>
          `${formatQuantityWithUnit(i.quantity, i.sale_unit)} x ${i.product_name_snapshot} = *${formatMXN(i.subtotal)}*`
      ),
      `--------------------------------`,
      sale.discount_amount > 0 ? `Descuento: -${formatMXN(sale.discount_amount)}` : '',
      `*TOTAL: ${formatMXN(sale.total)} MXN*`,
      `Método de pago: ${sale.payment_method.toUpperCase()}`,
      sale.payment_method === 'efectivo'
        ? `Efectivo recibido: ${formatMXN(sale.cash_received)} | Su cambio: ${formatMXN(sale.change_given)}`
        : '',
      ``,
      branch.ticket_footer || '¡Gracias por su compra!',
    ].filter(Boolean);

    return lines.join('\n');
  };

  const handleSendWhatsApp = () => {
    const url = buildWhatsAppUrl(whatsAppPhone || '525500000000', generateWhatsAppText());
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Barra Superior (No se imprime) */}
        <div className="no-print flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-orange-500" />
            <h3 className="text-base font-extrabold">Ticket de Venta ({sale.folio})</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-zinc-100 p-1 text-xs font-bold dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setPaperWidth(58)}
                className={`rounded-lg px-2.5 py-1 ${
                  paperWidth === 58 ? 'bg-orange-600 text-white' : 'text-zinc-500'
                }`}
              >
                58 mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth(80)}
                className={`rounded-lg px-2.5 py-1 ${
                  paperWidth === 80 ? 'bg-orange-600 text-white' : 'text-zinc-500'
                }`}
              >
                80 mm
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Vista Previa del Ticket Térmico (Área Imprimible) */}
        <div className="flex-1 overflow-y-auto bg-zinc-100 p-4 dark:bg-zinc-900">
          <div
            className={`printable-area mx-auto rounded-lg bg-white p-4 font-mono text-xs text-black shadow-md ${
              paperWidth === 58 ? 'max-w-[260px]' : 'max-w-[340px]'
            }`}
          >
            <div className="text-center">
              <img
                src="/logo-el-tigre.png"
                alt="Mini-Súper EL TIGRE"
                className="mx-auto mb-1.5 h-12 w-auto object-contain"
              />
              <p className="text-sm font-black uppercase">{branch.name}</p>
              <p className="text-[11px]">{branch.address}</p>
              <p className="text-[11px]">Tel: {branch.phone}</p>
              {branch.rfc && <p className="text-[10px]">RFC: {branch.rfc}</p>}
              <p className="mt-1 text-[11px]">{branch.ticket_header}</p>
            </div>

            <div className="my-2 border-t border-dashed border-black pt-2 text-[11px]">
              <p>Folio: <strong>{sale.folio}</strong></p>
              <p>Fecha: {formatDateTimeMX(sale.created_at)}</p>
              <p>Atendió: {sale.user_name}</p>
              <p>Cliente: {sale.customer_name || 'Público en General'}</p>
            </div>

            <div className="my-2 border-y border-dashed border-black py-2">
              <div className="mb-1 flex justify-between text-[10px] font-bold">
                <span>CANT. DESCRIPCIÓN</span>
                <span>IMPORTE</span>
              </div>
              <div className="space-y-1.5">
                {sale.items.map((item) => (
                  <div key={item.id} className="text-[11px]">
                    <div className="font-bold">{item.product_name_snapshot}</div>
                    <div className="flex justify-between text-[10px]">
                      <span>
                        {formatQuantityWithUnit(item.quantity, item.sale_unit)} x{' '}
                        {formatMXN(item.unit_price)}
                        {item.is_wholesale ? ' (Mayoreo)' : ''}
                      </span>
                      <span className="font-bold">{formatMXN(item.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1 text-right text-xs">
              {sale.discount_amount > 0 && (
                <div className="flex justify-between">
                  <span>DESCUENTO:</span>
                  <span>-{formatMXN(sale.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black">
                <span>TOTAL MXN:</span>
                <span>{formatMXN(sale.total)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>PAGO ({sale.payment_method.toUpperCase()}):</span>
                <span>{formatMXN(sale.cash_received)}</span>
              </div>
              {sale.payment_method === 'efectivo' && (
                <div className="flex justify-between text-[11px] font-bold">
                  <span>SU CAMBIO:</span>
                  <span>{formatMXN(sale.change_given)}</span>
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-dashed border-black pt-2 text-center text-[10px]">
              <p>{branch.ticket_footer}</p>
              <p className="mt-1 font-bold">*** TIENDA TIGRE POS ***</p>
            </div>
          </div>
        </div>

        {/* Acciones de Impresión y WhatsApp */}
        <div className="no-print space-y-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex gap-2">
            <input
              type="tel"
              value={whatsAppPhone}
              onChange={(e) => setWhatsAppPhone(e.target.value)}
              placeholder="Teléfono WhatsApp cliente (10 dígitos)..."
              className="h-11 flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 text-xs focus:border-emerald-500 focus:outline-none dark:border-zinc-700"
            />
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white hover:bg-emerald-500"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar WhatsApp
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 text-xs font-extrabold text-white shadow-md hover:bg-orange-500"
            >
              <Printer className="h-4 w-4" />
              Imprimir Ticket ({paperWidth}mm / PDF)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-12 rounded-xl border border-zinc-300 text-xs font-extrabold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Nueva Venta (Cerrar)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
