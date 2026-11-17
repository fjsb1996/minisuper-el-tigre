'use client';

import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Barcode, Plus, Printer, Sparkles, Tag, Trash2 } from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import { Product } from '@/types/database';
import { formatMXN, generateInternalBarcode } from '@/lib/utils/formatters';
import { toast } from 'sonner';

interface LabelItem {
  product: Product;
  codeToPrint: string;
  copies: number;
}

function BarcodeCanvas({ code }: { code: string }) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !code) return;
    try {
      JsBarcode(svgRef.current, code, {
        format: 'CODE128',
        width: 1.5,
        height: 36,
        displayValue: true,
        fontSize: 11,
        margin: 2,
      });
    } catch {
      // Fallback if code format has special chars
    }
  }, [code]);

  return <svg ref={svgRef} className="mx-auto max-w-full" />;
}

export default function EtiquetasPage() {
  const { products, saveProduct } = useTiendaStore();

  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [copiesInput, setCopiesInput] = useState<number>(2);
  const [labelSize, setLabelSize] = useState<'small' | 'shelf'>('shelf');
  const [labelQueue, setLabelQueue] = useState<LabelItem[]>(() => {
    return products.slice(0, 4).map((p) => ({
      product: p,
      codeToPrint: p.barcode || p.sku,
      copies: 1,
    }));
  });

  const handleAddToQueue = () => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    setLabelQueue((prev) => [
      ...prev,
      {
        product: prod,
        codeToPrint: prod.barcode || prod.sku,
        copies: Math.max(1, copiesInput),
      },
    ]);
  };

  const handleAssignInternalCodeToNoBarcodeProducts = async () => {
    const withoutCode = products.filter((p) => !p.barcode);
    if (withoutCode.length === 0) {
      toast.info('Todos los productos ya cuentan con código de barras.');
      return;
    }

    const newLabels: LabelItem[] = [];
    for (let i = 0; i < withoutCode.length; i++) {
      const p = withoutCode[i];
      const generated = generateInternalBarcode(i + 101);
      const updated = await saveProduct(
        {
          ...p,
          barcode: generated,
        },
        undefined,
        'Asignación de código de barras interno para etiqueta'
      );
      newLabels.push({
        product: updated,
        codeToPrint: generated,
        copies: 1,
      });
    }

    setLabelQueue((prev) => [...newLabels, ...prev]);
    toast.success(
      `Se generaron y asignaron códigos EAN-13 internos a ${newLabels.length} productos sin código.`
    );
  };

  const expandedLabels = labelQueue.flatMap((item) =>
    Array.from({ length: item.copies }, (_, idx) => ({
      key: `${item.product.id}-${idx}`,
      product: item.product,
      code: item.codeToPrint,
    }))
  );

  return (
    <div className="space-y-6">
      {/* Encabezado Minimalista */}
      <div className="no-print flex flex-col gap-3 rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0066cc]">
            Generador e Impresión de Etiquetas y Códigos de Barras
          </h1>
          <p className="text-xs text-[#666]">
            Imprime etiquetas de precio para anaquel/refrigerador y genera códigos internos para productos a granel.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleAssignInternalCodeToNoBarcodeProducts}
            className="flex h-9 items-center gap-1.5 rounded-md border border-[#0066cc] bg-white px-3.5 text-xs font-bold text-[#0066cc] hover:bg-[#e8f0f8]"
          >
            <Sparkles className="h-4 w-4" />
            Generar Códigos Internos
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-9 items-center gap-1.5 rounded-md bg-[#0066cc] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
          >
            <Printer className="h-4 w-4" />
            Imprimir Etiquetas ({expandedLabels.length})
          </button>
        </div>
      </div>

      {/* Controles de Selección de Productos para Etiquetas */}
      <div className="no-print grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-12">
        <div className="sm:col-span-5">
          <label className="mb-1 block text-xs font-bold">Seleccionar Producto</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-950"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatMXN(p.sale_price)} ({p.barcode || p.sku})
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-bold">Copias</label>
          <input
            type="number"
            min="1"
            max="50"
            value={copiesInput}
            onChange={(e) => setCopiesInput(Number(e.target.value) || 1)}
            className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm font-bold dark:border-zinc-700"
          />
        </div>

        <div className="sm:col-span-3">
          <label className="mb-1 block text-xs font-bold">Formato de Etiqueta</label>
          <select
            value={labelSize}
            onChange={(e) => setLabelSize(e.target.value as 'small' | 'shelf')}
            className="h-11 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="shelf">Cenefa de Anaquel / Precio Grande</option>
            <option value="small">Etiqueta Adhesiva Compacta</option>
          </select>
        </div>

        <div className="flex items-end gap-2 sm:col-span-2">
          <button
            type="button"
            onClick={handleAddToQueue}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> Agregar
          </button>
          <button
            type="button"
            onClick={() => setLabelQueue([])}
            className="flex h-11 items-center justify-center rounded-xl border border-zinc-300 px-3 text-zinc-500 hover:text-red-600 dark:border-zinc-700"
            title="Limpiar plantilla"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Vista Previa de Impresión de Etiquetas */}
      <div className="printable-area rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div
          className={`grid gap-4 ${
            labelSize === 'shelf'
              ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
          }`}
        >
          {expandedLabels.map((item) => (
            <div
              key={item.key}
              className="flex flex-col justify-between rounded-xl border-2 border-dashed border-zinc-800 bg-white p-3 text-center text-black"
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                  Mini-Súper EL TIGRE • {item.product.brand}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs font-black leading-tight text-black">
                  {item.product.name}
                </p>
              </div>

              <div className="my-2 rounded-lg bg-amber-300/90 py-1.5">
                <span className="text-2xl font-black tracking-tight text-black">
                  {formatMXN(item.product.sale_price)}
                </span>
                <span className="ml-1 text-[11px] font-bold text-zinc-800">
                  /{item.product.sale_unit}
                </span>
              </div>

              <div className="bg-white pt-1">
                <BarcodeCanvas code={item.code} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
