'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  Barcode,
  Camera,
  Coins,
  CreditCard,
  Edit2,
  Printer,
  RotateCcw,
  Scale,
  Store,
  Ticket,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import { PaymentMethodType, Product, Sale } from '@/types/database';
import {
  formatDateTimeMX,
  formatMXN,
  roundCurrency,
  roundQuantity,
} from '@/lib/utils/formatters';
import { CameraScannerModal } from '@/components/scanner/CameraScannerModal';
import { UsbBarcodeListener } from '@/components/scanner/UsbBarcodeListener';
import { WeighableItemModal } from '@/components/pos/WeighableItemModal';
import { ThermalTicketModal } from '@/components/pos/ThermalTicketModal';
import { toast } from 'sonner';

export default function PosPage() {
  const {
    branch,
    products,
    customers,
    cart,
    heldSales,
    sales,
    selectedCustomerId,
    globalDiscount,
    addToCart,
    updateCartItemQuantity,
    removeFromCart,
    clearCart,
    setSelectedCustomer,
    setGlobalDiscount,
    holdCurrentSale,
    resumeHeldSale,
    deleteHeldSale,
    processCheckout,
    cancelOrReturnSale,
  } = useTiendaStore();

  // Controles superiores minimalistas (Código de barras | Nombre | Cantidad)
  const [barcodeInput, setBarcodeInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [qtyInput, setQtyInput] = useState('1.0');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const barcodeRef = useRef<HTMLInputElement | null>(null);

  // Modales
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [weighableProduct, setWeighableProduct] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHeldSalesOpen, setIsHeldSalesOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isRecentSalesOpen, setIsRecentSalesOpen] = useState(false);
  const [completedSaleTicket, setCompletedSaleTicket] = useState<Sale | null>(null);

  // Modal de Cobro minimalista (Imagen 1: Efectivo | Tarjeta | Vales/Transferencia/Fiado)
  const [applyDiscountCheck, setApplyDiscountCheck] = useState(false);
  const [discountModalInput, setDiscountModalInput] = useState('0');
  const [cashInput, setCashInput] = useState('0.00');
  const [cardInput, setCardInput] = useState('0.00');
  const [voucherOrCreditInput, setVoucherOrCreditInput] = useState('0.00');
  const [paymentRef, setPaymentRef] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Devolución
  const [cancellingSaleId, setCancellingSaleId] = useState<string | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');

  // Selección automática del primer renglón de la tabla
  useEffect(() => {
    if (cart.length > 0 && (!selectedRowId || !cart.some((i) => i.product_id === selectedRowId))) {
      setSelectedRowId(cart[0].product_id);
    } else if (cart.length === 0) {
      setSelectedRowId(null);
    }
  }, [cart, selectedRowId]);

  // Totales
  const cartSubtotal = useMemo(
    () => roundCurrency(cart.reduce((acc, item) => acc + item.subtotal, 0)),
    [cart]
  );

  const effectiveDiscount = applyDiscountCheck
    ? roundCurrency(Number(discountModalInput) || 0)
    : globalDiscount;

  const cartTotal = useMemo(
    () => roundCurrency(Math.max(0, cartSubtotal - effectiveDiscount)),
    [cartSubtotal, effectiveDiscount]
  );

  const totalArticlesCount = useMemo(
    () => roundQuantity(cart.reduce((acc, item) => acc + item.quantity, 0)),
    [cart]
  );

  // Sugerencias del buscador por nombre
  const matchingProducts = useMemo(() => {
    const q = nameInput.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.is_active &&
          (p.name.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q))
      )
      .slice(0, 7);
  }, [products, nameInput]);

  // Atajos de teclado F3, F4, F5, F6, F7, F8, F12
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCheckoutOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsCheckoutOpen(false);
        } else if (e.key === 'F12') {
          e.preventDefault();
          document.getElementById('btn-submit-checkout')?.click();
        } else if (e.key === 'F11') {
          e.preventDefault();
          setApplyDiscountCheck((prev) => !prev);
        }
        return;
      }

      if (e.key === 'F3') {
        e.preventDefault();
        setIsCustomerModalOpen(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) {
          clearCart();
          toast.info('Venta cancelada (F4)');
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleHoldSale();
      } else if (e.key === 'F6') {
        e.preventDefault();
        setIsHeldSalesOpen(true);
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleWeighAction();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (sales.length > 0) {
          setCompletedSaleTicket(sales[0]);
        } else {
          toast.info('No hay tickets previos para reimprimir');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckoutOpen, cart, sales, selectedRowId]);

  const addProductWithQty = (prod: Product, customQty?: number) => {
    const qty = customQty ?? Math.max(0.001, Number(qtyInput) || 1);
    addToCart(prod, qty);
    setSelectedRowId(prod.id);
    setBarcodeInput('');
    setNameInput('');
    setQtyInput('1.0');
    setShowSuggestions(false);
    barcodeRef.current?.focus();
  };

  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const found = products.find(
      (p) =>
        p.is_active &&
        (p.barcode === code || p.sku.toLowerCase() === code.toLowerCase())
    );

    if (!found) {
      toast.error(`Código "${code}" no encontrado.`);
      return;
    }

    addProductWithQty(found);
  };

  const handleAddButton = () => {
    if (barcodeInput.trim()) {
      handleBarcodeSubmit();
      return;
    }
    if (matchingProducts.length > 0) {
      addProductWithQty(matchingProducts[0]);
      return;
    }
    toast.info('Escribe o escanea un código de barras o nombre de artículo');
  };

  const handleWeighAction = () => {
    const currentSelectedProd = selectedRowId
      ? products.find((p) => p.id === selectedRowId)
      : products.find((p) => p.is_weighable);
    if (currentSelectedProd) {
      setWeighableProduct(currentSelectedProd);
    } else {
      toast.info('Selecciona un producto a granel para pesar');
    }
  };

  const handleHoldSale = async () => {
    if (cart.length === 0) {
      toast.info('No hay artículos en la lista para poner en espera');
      return;
    }
    const note = `Espera ${new Date().toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    await holdCurrentSale(note);
    toast.success('Venta puesta en espera (F5)');
  };

  const openCheckoutModal = () => {
    if (cart.length === 0) {
      toast.error('Agrega al menos un artículo para cobrar.');
      return;
    }
    setApplyDiscountCheck(globalDiscount > 0);
    setDiscountModalInput(String(globalDiscount || 0));
    setCashInput(cartTotal.toFixed(2));
    setCardInput('0.00');
    setVoucherOrCreditInput('0.00');
    setPaymentRef('');
    setCheckoutError(null);
    setIsCheckoutOpen(true);
  };

  const totalTendered = useMemo(() => {
    return roundCurrency(
      (Number(cashInput) || 0) +
        (Number(cardInput) || 0) +
        (Number(voucherOrCreditInput) || 0)
    );
  }, [cashInput, cardInput, voucherOrCreditInput]);

  const changeCalculated = useMemo(() => {
    return roundCurrency(Math.max(0, totalTendered - cartTotal));
  }, [totalTendered, cartTotal]);

  const handleConfirmCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    const disc = applyDiscountCheck ? Number(discountModalInput) || 0 : 0;
    setGlobalDiscount(disc);

    const cashVal = Number(cashInput) || 0;
    const cardVal = Number(cardInput) || 0;
    const voucherVal = Number(voucherOrCreditInput) || 0;

    let method: PaymentMethodType = 'efectivo';
    if (selectedCustomerId && voucherVal >= cartTotal) {
      method = 'fiado';
    } else if (cardVal >= cartTotal && cashVal === 0) {
      method = 'tarjeta';
    } else if (voucherVal >= cartTotal && cashVal === 0) {
      method = 'transferencia';
    } else if (
      (cashVal > 0 && cardVal > 0) ||
      (cashVal > 0 && voucherVal > 0)
    ) {
      method = 'efectivo';
    }

    if (method !== 'fiado' && totalTendered < cartTotal) {
      setCheckoutError(
        `Faltan ${formatMXN(cartTotal - totalTendered)} por cubrir del total.`
      );
      return;
    }

    const res = await processCheckout({
      paymentMethod: method,
      cashReceived: totalTendered,
      customerId: selectedCustomerId,
    });

    if (!res.ok || !res.sale) {
      setCheckoutError(res.error || 'Error al cobrar la venta.');
      return;
    }

    setIsCheckoutOpen(false);
    setCompletedSaleTicket(res.sale);
    toast.success(`Venta ${res.sale.folio} cobrada correctamente`);
  };

  const activeCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="mx-auto max-w-7xl">
      <UsbBarcodeListener
        onBarcodeDetected={(code) => {
          const found = products.find(
            (p) => p.is_active && (p.barcode === code || p.sku === code)
          );
          if (found) {
            addProductWithQty(found, 1);
            toast.success(`${found.name} agregado`);
          } else {
            toast.error(`Código ${code} no registrado`);
          }
        }}
      />

      {/* =================================================================== */}
      {/* CONTENEDOR MINIMALISTA BLANCO ESTILO ZINDEY (Imágenes 2 y 4)        */}
      {/* =================================================================== */}
      <div className="flex min-h-[calc(100vh-7.5rem)] flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="space-y-4">
          {/* 1. FILA DE CAPTURA SUPERIOR: Cód. de barras | Nombre | + Agregar | Cantidad | Pesar (F7) | Imprimir (F8) */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Icono Código + Input Código de Barras */}
            <form
              onSubmit={handleBarcodeSubmit}
              className="flex flex-1 items-center gap-2 sm:flex-initial"
            >
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                title="Abrir cámara lectora de código"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#0066cc] hover:bg-sky-50 dark:hover:bg-zinc-800"
              >
                <Barcode className="h-6 w-6" />
              </button>
              <input
                ref={barcodeRef}
                type="text"
                data-allow-barcode-burst="true"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Cód. de barras"
                className="h-10 w-full rounded-md border border-slate-300 bg-[#e9ecef] px-3 text-xs font-semibold text-slate-800 placeholder-slate-500 focus:border-[#0066cc] focus:bg-white focus:outline-none sm:w-44 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </form>

            <span className="hidden h-6 w-px bg-slate-300 sm:inline-block dark:bg-zinc-700" />

            {/* Input Nombre con Autocompletado */}
            <div className="relative flex-1 sm:max-w-xs">
              <input
                type="text"
                value={nameInput}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && matchingProducts.length > 0) {
                    e.preventDefault();
                    addProductWithQty(matchingProducts[0]);
                  }
                }}
                placeholder="Nombre"
                className="h-10 w-full rounded-md border border-slate-300 bg-[#e9ecef] px-3 text-xs font-semibold text-slate-800 placeholder-slate-500 focus:border-[#0066cc] focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />

              {/* Desplegable de coincidencias */}
              {showSuggestions && matchingProducts.length > 0 && (
                <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                  {matchingProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProductWithQty(p)}
                      className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-[#0066cc] hover:text-white dark:border-zinc-800"
                    >
                      <span className="font-bold uppercase">{p.name}</span>
                      <span className="font-extrabold">{formatMXN(p.sale_price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Botón + Agregar */}
            <button
              type="button"
              onClick={handleAddButton}
              className="h-10 rounded-md bg-[#8ab8e6] px-4 text-xs font-extrabold text-white shadow-xs transition hover:bg-[#0066cc] active:scale-95"
            >
              + Agregar
            </button>

            {/* Input Cantidad */}
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value)}
              aria-label="Cantidad a agregar"
              className="h-10 w-20 rounded-md border border-slate-300 bg-[#e9ecef] px-2.5 text-center text-xs font-extrabold text-slate-800 focus:border-[#0066cc] focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />

            {/* Botón Pesar (F7) */}
            <button
              type="button"
              onClick={handleWeighAction}
              className="flex h-10 items-center gap-1.5 rounded-md bg-[#8ab8e6] px-3.5 text-xs font-extrabold text-white transition hover:bg-[#0066cc]"
            >
              <Scale className="h-3.5 w-3.5" />
              Pesar (F7)
            </button>

            {/* Botón Imprimir (F8) alineado a la derecha */}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRecentSalesOpen(true)}
                className="flex h-10 items-center gap-1.5 rounded-md border border-[#0066cc] bg-white px-3.5 text-xs font-extrabold text-[#005bb5] transition hover:bg-sky-50 dark:bg-zinc-900 dark:text-sky-400"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir (F8)
              </button>
            </div>
          </div>

          {/* Acceso rápido minimalista para celulares o productos sin código */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-slate-400">Rápidos:</span>
            {products
              .filter((p) => p.is_active && p.is_favorite)
              .slice(0, 10)
              .map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => {
                    if (prod.is_weighable) {
                      setWeighableProduct(prod);
                    } else {
                      addProductWithQty(prod, 1);
                    }
                  }}
                  className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase text-slate-700 hover:border-[#0066cc] hover:bg-sky-50 hover:text-[#005bb5] dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {prod.name} ({formatMXN(prod.sale_price)})
                </button>
              ))}
          </div>

          {/* 2. TABLA CENTRAL MINIMALISTA (Descripción | Precio unitario | Cantidad | Unidad | Importe | Acciones) */}
          <div className="min-h-[340px] overflow-hidden rounded-lg border border-slate-200 bg-[#e6e8eb] dark:border-zinc-800 dark:bg-zinc-950">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-300 bg-[#f4f6f8] text-[11px] font-bold text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    <th className="px-4 py-2.5">Descripción</th>
                    <th className="px-4 py-2.5">Precio unitario</th>
                    <th className="px-4 py-2.5">Cantidad</th>
                    <th className="px-4 py-2.5">Unidad</th>
                    <th className="px-4 py-2.5">Importe</th>
                    <th className="w-24 px-4 py-2.5 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => {
                    const isSelected = selectedRowId === item.product_id;
                    const unitLabel =
                      item.sale_unit === 'pieza'
                        ? 'PZ'
                        : item.sale_unit === 'kg'
                          ? 'KG'
                          : item.sale_unit.toUpperCase();

                    return (
                      <tr
                        key={item.product_id}
                        onClick={() => setSelectedRowId(item.product_id)}
                        className={`cursor-pointer border-b border-slate-200/80 font-extrabold transition-colors dark:border-zinc-800 ${
                          isSelected
                            ? 'bg-[#0066cc] text-white'
                            : idx % 2 === 0
                              ? 'bg-white text-slate-800 dark:bg-zinc-900 dark:text-zinc-100'
                              : 'bg-[#f4f6f9] text-slate-800 dark:bg-zinc-900/60 dark:text-zinc-100'
                        }`}
                      >
                        <td className="px-4 py-3 uppercase">
                          {item.name}
                          {item.is_wholesale && (
                            <span
                              className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-sky-100 text-[#005bb5]'
                              }`}
                            >
                              MAYOREO
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{formatMXN(item.unit_price)}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step={item.is_weighable ? '0.001' : '1'}
                            min="0.001"
                            value={item.quantity}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              updateCartItemQuantity(
                                item.product_id,
                                Number(e.target.value) || 0
                              )
                            }
                            className={`w-16 rounded px-1.5 py-0.5 font-extrabold focus:outline-none ${
                              isSelected
                                ? 'bg-white/15 text-white'
                                : 'bg-transparent text-slate-900 dark:text-white'
                            }`}
                          />
                        </td>
                        <td className="px-4 py-3 uppercase">{unitLabel}</td>
                        <td className="px-4 py-3">{formatMXN(item.subtotal)}</td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.is_weighable) {
                                  const p = products.find(
                                    (prod) => prod.id === item.product_id
                                  );
                                  if (p) setWeighableProduct(p);
                                  return;
                                }
                                const nextQty = window.prompt(
                                  `Modificar cantidad para ${item.name}:`,
                                  String(item.quantity)
                                );
                                if (nextQty !== null) {
                                  updateCartItemQuantity(
                                    item.product_id,
                                    Number(nextQty) || 1
                                  );
                                }
                              }}
                              title="Editar cantidad"
                              className={
                                isSelected
                                  ? 'text-white hover:text-sky-200'
                                  : 'text-slate-600 hover:text-[#0066cc] dark:text-zinc-400'
                              }
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.product_id)}
                              title="Eliminar renglón"
                              className={
                                isSelected
                                  ? 'text-white hover:text-red-200'
                                  : 'text-slate-600 hover:text-red-600 dark:text-zinc-400'
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 3. PIE DE PÁGINA MINIMALISTA: Badges Amarillos + Total Naranja Grande + Botones F4, F5, F6, ESC */}
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Badges informativos con borde dorado/ámbar como en la imagen */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-700 shadow-2xs dark:border-amber-500/40 dark:bg-zinc-900 dark:text-zinc-200">
                <Store className="h-4 w-4 text-amber-500" />
                <span>CAJA-01</span>
              </div>

              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-700 shadow-2xs dark:border-amber-500/40 dark:bg-zinc-900 dark:text-zinc-200">
                <Coins className="h-4 w-4 text-amber-500" />
                <span>{totalArticlesCount} Artículos</span>
              </div>

              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className="flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-700 shadow-2xs transition hover:bg-amber-50 dark:border-amber-500/40 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <User className="h-4 w-4 text-amber-500" />
                <span>
                  {activeCustomer ? activeCustomer.name : 'Cliente (F3)'}
                </span>
              </button>
            </div>

            {/* Gran Total Naranja */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black tracking-tight text-[#d9531e]">
                Total
              </span>
              <span className="text-4xl font-black tracking-tight text-[#d9531e]">
                {formatMXN(cartTotal)}
              </span>
            </div>
          </div>

          {/* Botonera Inferior Derecha: Cancelar (F4) | Poner en espera (F5) | Lista de espera (F6) | $ Cobrar (ESC) */}
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (cart.length > 0) {
                  clearCart();
                  toast.info('Venta actual limpiada');
                }
              }}
              className="h-10 rounded-md border border-slate-300 bg-white px-4 text-xs font-bold text-slate-600 shadow-2xs hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Cancelar (F4)
            </button>

            <button
              type="button"
              onClick={handleHoldSale}
              className="h-10 rounded-md border border-[#0066cc] bg-white px-4 text-xs font-extrabold text-[#005bb5] shadow-2xs hover:bg-sky-50 dark:bg-zinc-900 dark:text-sky-400"
            >
              Poner en espera (F5)
            </button>

            <button
              type="button"
              onClick={() => setIsHeldSalesOpen(true)}
              className="h-10 rounded-md bg-[#0066cc] px-4 text-xs font-extrabold text-white shadow-sm hover:bg-[#0055b3]"
            >
              Lista de espera (F6){heldSales.length > 0 ? ` [${heldSales.length}]` : ''}
            </button>

            <button
              type="button"
              onClick={openCheckoutModal}
              className="flex h-10 items-center gap-1.5 rounded-md bg-[#005bb5] px-6 text-xs font-extrabold text-white shadow-md hover:bg-[#004999] active:scale-95"
            >
              <span>$ Cobrar (ESC)</span>
            </button>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL DE COBRO MINIMALISTA IDÉNTICO A LA IMAGEN 1                   */}
      {/* =================================================================== */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            {/* Barra de título estilo ventana */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <div className="flex items-center gap-2">
                <img
                  src="/logo-icono-tigre.png"
                  alt="El Tigre"
                  className="h-5 w-5 object-contain"
                />
                <span>Mini-Súper EL TIGRE | Cobrar venta</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="rounded p-1 hover:bg-slate-200 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCheckout} className="p-6 sm:p-8">
              {/* Fila superior: Métodos de pago + Aplicar descuento (F11) */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <h2 className="text-xl font-extrabold text-[#1976d2]">
                  Métodos de pago
                </h2>

                <div className="flex flex-col items-end gap-1.5">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={applyDiscountCheck}
                      onChange={(e) => setApplyDiscountCheck(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-400 accent-[#1976d2]"
                    />
                    Aplicar descuento (F11)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-[#6495ed]">$</span>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      disabled={!applyDiscountCheck}
                      value={discountModalInput}
                      onChange={(e) => setDiscountModalInput(e.target.value)}
                      className="h-8 w-36 rounded-md border border-slate-300 bg-slate-100 px-2.5 text-sm font-bold text-slate-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Total a pagar centrado en azul grande */}
              <div className="my-5 border-b border-slate-200 pb-5 text-center dark:border-zinc-800">
                <p className="text-sm font-bold text-[#1976d2]">Total a pagar</p>
                <p className="mt-0.5 text-4xl font-black tracking-tight text-[#1565c0]">
                  {formatMXN(cartTotal)}
                </p>
              </div>

              {checkoutError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-center text-xs font-bold text-red-600">
                  {checkoutError}
                </div>
              )}

              {/* Tres Columnas: Efectivo | Tarjeta | Vales / Fiado */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {/* Columna 1: Efectivo */}
                <div className="flex flex-col items-center">
                  <div className="flex h-9 w-12 items-center justify-center rounded border-2 border-emerald-500 bg-emerald-50 text-emerald-600">
                    <Banknote className="h-6 w-6" />
                  </div>
                  <span className="mt-1.5 text-xs font-extrabold text-emerald-600">
                    Efectivo
                  </span>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-base font-extrabold text-emerald-600">$</span>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      autoFocus
                      value={cashInput}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setCashInput(e.target.value)}
                      className="h-9 w-32 rounded-md border-2 border-[#6495ed] bg-white px-2.5 text-sm font-extrabold text-slate-900 shadow-xs focus:outline-none dark:bg-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Columna 2: Tarjeta */}
                <div className="flex flex-col items-center">
                  <div className="flex h-9 w-12 items-center justify-center rounded bg-[#1976d2] text-white">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <span className="mt-1.5 text-xs font-extrabold text-[#1976d2]">
                    Tarjeta
                  </span>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-base font-extrabold text-[#1976d2]">$</span>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={cardInput}
                      onFocus={(e) => {
                        if (Number(cardInput) === 0) {
                          setCashInput('0.00');
                          setCardInput(cartTotal.toFixed(2));
                        }
                        e.target.select();
                      }}
                      onChange={(e) => setCardInput(e.target.value)}
                      className="h-9 w-32 rounded-md border border-slate-300 bg-slate-200/80 px-2.5 text-sm font-extrabold text-slate-800 focus:border-[#1976d2] focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Columna 3: Vales / Transferencia / Fiado */}
                <div className="flex flex-col items-center">
                  <div className="flex h-9 w-12 items-center justify-center rounded bg-amber-400/20 text-amber-600">
                    <Ticket className="h-6 w-6" />
                  </div>
                  <span className="mt-1.5 text-xs font-extrabold text-amber-600">
                    {selectedCustomerId ? 'Fiado / Vales' : 'Vales / Transf.'}
                  </span>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-base font-extrabold text-amber-600">$</span>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={voucherOrCreditInput}
                      onFocus={(e) => {
                        if (Number(voucherOrCreditInput) === 0) {
                          setCashInput('0.00');
                          setVoucherOrCreditInput(cartTotal.toFixed(2));
                        }
                        e.target.select();
                      }}
                      onChange={(e) => setVoucherOrCreditInput(e.target.value)}
                      className="h-9 w-32 rounded-md border border-slate-300 bg-slate-200/80 px-2.5 text-sm font-extrabold text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Campo Referencia */}
              <div className="mt-5 flex flex-col items-center border-b border-slate-200 pb-5 dark:border-zinc-800">
                <label className="mb-1 text-xs font-bold text-slate-400">
                  Referencia
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Folio voucher o nota opcional"
                  className="h-8 w-44 rounded-md border border-slate-200 bg-slate-100 px-2.5 text-center text-xs focus:border-[#1976d2] focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>

              {/* Su cambio en Verde Gigante */}
              <div className="my-5 text-center">
                <p className="text-sm font-extrabold text-[#4caf50]">Su cambio</p>
                <p className="text-5xl font-black tracking-tight text-[#43a047]">
                  {formatMXN(changeCalculated)}
                </p>
              </div>

              {/* Botones Inferiores: Cancelar (ESC) | Imprimir ticket (F12) */}
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="h-10 rounded-md border border-slate-400 bg-white px-5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  Cancelar (ESC)
                </button>
                <button
                  id="btn-submit-checkout"
                  type="submit"
                  className="flex h-10 items-center gap-2 rounded-md bg-[#1976d2] px-5 text-xs font-extrabold text-white shadow-md hover:bg-[#1565c0]"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir ticket (F12)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Seleccionar Cliente (F3) */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-zinc-800">
              <h3 className="text-base font-extrabold text-[#005bb5]">
                Asignar Cliente a la Venta (F3)
              </h3>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="rounded p-1 text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setIsCustomerModalOpen(false);
                }}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-left text-xs font-bold hover:bg-slate-50 dark:border-zinc-800"
              >
                Público en General (Contado)
              </button>
              {customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(c.id);
                    setIsCustomerModalOpen(false);
                    toast.success(`Cliente asignado: ${c.name}`);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-2.5 text-left text-xs hover:border-[#0066cc] hover:bg-sky-50 dark:border-zinc-800"
                >
                  <div>
                    <p className="font-bold">{c.name}</p>
                    <p className="text-[11px] text-slate-500">Tel: {c.phone}</p>
                  </div>
                  <span className="font-bold text-amber-600">
                    Saldo: {formatMXN(c.current_balance)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Lista de Espera (F6) */}
      {isHeldSalesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-zinc-800">
              <h3 className="text-base font-extrabold text-[#005bb5]">
                Lista de Ventas en Espera ({heldSales.length})
              </h3>
              <button
                type="button"
                onClick={() => setIsHeldSalesOpen(false)}
                className="rounded p-1 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {heldSales.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No hay ventas en espera.
              </p>
            ) : (
              <div className="space-y-2">
                {heldSales.map((h) => {
                  const sum = h.cart_items.reduce((acc, i) => acc + i.subtotal, 0);
                  return (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs dark:border-zinc-800"
                    >
                      <div>
                        <p className="font-bold">{h.customer_note}</p>
                        <p className="text-slate-500">
                          {h.cart_items.length} artículos • {formatMXN(sum)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await resumeHeldSale(h.id);
                            setIsHeldSalesOpen(false);
                          }}
                          className="rounded-md bg-[#0066cc] px-3 py-1.5 font-bold text-white"
                        >
                          Recuperar
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteHeldSale(h.id)}
                          className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Reimpresión de Tickets y Cancelación (F8) */}
      {isRecentSalesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-zinc-800">
              <h3 className="text-base font-extrabold text-[#005bb5]">
                Tickets Recientes y Devoluciones (F8)
              </h3>
              <button
                type="button"
                onClick={() => setIsRecentSalesOpen(false)}
                className="rounded p-1 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[65vh] space-y-2 overflow-y-auto p-4">
              {sales.slice(0, 15).map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-slate-200 p-3 text-xs dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-extrabold">{s.folio}</span>
                      <span className="ml-2 text-slate-500">
                        {formatDateTimeMX(s.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black">{formatMXN(s.total)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRecentSalesOpen(false);
                          setCompletedSaleTicket(s);
                        }}
                        className="rounded border border-slate-300 px-2.5 py-1 font-bold hover:bg-slate-100"
                      >
                        Imprimir
                      </button>
                      {s.status === 'completada' && (
                        <button
                          type="button"
                          onClick={() => {
                            setCancellingSaleId(s.id);
                            setCancelReasonInput('');
                          }}
                          className="flex items-center gap-1 rounded bg-red-50 px-2.5 py-1 font-bold text-red-600"
                        >
                          <RotateCcw className="h-3 w-3" /> Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                  {cancellingSaleId === s.id && (
                    <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2">
                      <input
                        type="text"
                        value={cancelReasonInput}
                        onChange={(e) => setCancelReasonInput(e.target.value)}
                        placeholder="Motivo de cancelación..."
                        className="h-8 flex-1 rounded border border-slate-300 px-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (cancelReasonInput.trim().length < 3) return;
                          await cancelOrReturnSale({
                            saleId: s.id,
                            reason: cancelReasonInput,
                          });
                          setCancellingSaleId(null);
                          toast.success('Venta cancelada y stock reintegrado');
                        }}
                        className="rounded bg-red-600 px-3 text-xs font-bold text-white"
                      >
                        Confirmar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Báscula / Venta por Peso (F7) */}
      <WeighableItemModal
        product={weighableProduct}
        onClose={() => setWeighableProduct(null)}
        onConfirm={(prod, qtyKg, subtotalMXN) => {
          addToCart(prod, qtyKg, subtotalMXN);
          setSelectedRowId(prod.id);
        }}
      />

      {/* Modal Ticket Térmico 58/80mm */}
      <ThermalTicketModal
        sale={completedSaleTicket}
        branch={branch}
        onClose={() => setCompletedSaleTicket(null)}
      />

      {/* Modal Cámara Escáner */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(code) => {
          const found = products.find(
            (p) => p.is_active && (p.barcode === code || p.sku === code)
          );
          if (found) addProductWithQty(found, 1);
        }}
        continuousMode={true}
      />
    </div>
  );
}
