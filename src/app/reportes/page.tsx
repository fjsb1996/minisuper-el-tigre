'use client';

import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Filter,
  Printer,
  TrendingUp,
} from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import { formatDateTimeMX, formatMXN, roundCurrency } from '@/lib/utils/formatters';
import { toast } from 'sonner';

export default function ReportesPage() {
  const {
    sales,
    products,
    categories,
    suppliers,
    customers,
    users,
    expenses,
    purchases,
  } = useTiendaStore();

  const [reportTab, setReportTab] = useState<
    'utilidad' | 'por_producto' | 'por_categoria' | 'por_usuario' | 'por_cliente' | 'por_proveedor'
  >('utilidad');

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (s.status !== 'completada') return false;
      const day = s.created_at.slice(0, 10);
      return day >= dateFrom && day <= dateTo;
    });
  }, [sales, dateFrom, dateTo]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(
      (e) => e.expense_date >= dateFrom && e.expense_date <= dateTo
    );
  }, [expenses, dateFrom, dateTo]);

  // Estado de Resultados: Utilidad = Ventas - Costo de lo Vendido - Gastos
  const financialStatement = useMemo(() => {
    const totalSales = roundCurrency(
      filteredSales.reduce((acc, s) => acc + s.total, 0)
    );
    const totalCostOfGoodsSold = roundCurrency(
      filteredSales.reduce((acc, s) => acc + s.total_cost, 0)
    );
    const grossProfit = roundCurrency(totalSales - totalCostOfGoodsSold);
    const grossMarginPct =
      totalSales > 0 ? roundCurrency((grossProfit / totalSales) * 100) : 0;

    const totalExpenses = roundCurrency(
      filteredExpenses.reduce((acc, e) => acc + e.amount, 0)
    );
    const netProfit = roundCurrency(grossProfit - totalExpenses);
    const netMarginPct =
      totalSales > 0 ? roundCurrency((netProfit / totalSales) * 100) : 0;

    return {
      totalSales,
      totalCostOfGoodsSold,
      grossProfit,
      grossMarginPct,
      totalExpenses,
      netProfit,
      netMarginPct,
      ticketsCount: filteredSales.length,
    };
  }, [filteredSales, filteredExpenses]);

  // Reporte por Producto
  const reportByProduct = useMemo(() => {
    const map: Record<
      string,
      {
        productId: string;
        name: string;
        sku: string;
        unitsSold: number;
        revenue: number;
        cost: number;
        profit: number;
      }
    > = {};

    for (const sale of filteredSales) {
      for (const item of sale.items) {
        if (!map[item.product_id]) {
          map[item.product_id] = {
            productId: item.product_id,
            name: item.product_name_snapshot,
            sku: products.find((p) => p.id === item.product_id)?.sku || '—',
            unitsSold: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
          };
        }
        const entry = map[item.product_id];
        entry.unitsSold += item.quantity;
        entry.revenue = roundCurrency(entry.revenue + item.subtotal);
        entry.cost = roundCurrency(entry.cost + item.quantity * item.unit_cost);
        entry.profit = roundCurrency(entry.revenue - entry.cost);
      }
    }

    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, products]);

  // Reporte por Categoría
  const reportByCategory = useMemo(() => {
    const map: Record<
      string,
      { categoryName: string; revenue: number; cost: number; profit: number }
    > = {};

    for (const sale of filteredSales) {
      for (const item of sale.items) {
        const prod = products.find((p) => p.id === item.product_id);
        const cat = categories.find((c) => c.id === prod?.category_id);
        const catName = cat?.name || 'Otros';

        if (!map[catName]) {
          map[catName] = { categoryName: catName, revenue: 0, cost: 0, profit: 0 };
        }
        map[catName].revenue = roundCurrency(map[catName].revenue + item.subtotal);
        map[catName].cost = roundCurrency(
          map[catName].cost + item.quantity * item.unit_cost
        );
        map[catName].profit = roundCurrency(map[catName].revenue - map[catName].cost);
      }
    }

    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, products, categories]);

  // Reporte por Usuario (Cajero / Encargado / Admin)
  const reportByUser = useMemo(() => {
    const map: Record<
      string,
      { userName: string; ticketsCount: number; revenue: number; profit: number }
    > = {};

    for (const sale of filteredSales) {
      const key = sale.user_name || 'Sistema';
      if (!map[key]) {
        map[key] = { userName: key, ticketsCount: 0, revenue: 0, profit: 0 };
      }
      map[key].ticketsCount += 1;
      map[key].revenue = roundCurrency(map[key].revenue + sale.total);
      map[key].profit = roundCurrency(
        map[key].profit + (sale.total - sale.total_cost)
      );
    }

    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  const handleExportReportCSV = () => {
    const headers = ['Producto', 'SKU', 'Unidades_Vendidas', 'Ventas_MXN', 'Costo_Vendido_MXN', 'Utilidad_Bruta_MXN'];
    const rows = reportByProduct.map((r) => [
      `"${r.name.replace(/"/g, '""')}"`,
      r.sku,
      r.unitsSold,
      r.revenue.toFixed(2),
      r.cost.toFixed(2),
      r.profit.toFixed(2),
    ]);

    const csv =
      '\uFEFF' +
      [
        `REPORTE FINANCIERO TIENDA TIGRE (${dateFrom} a ${dateTo})`,
        `Ventas Totales,${financialStatement.totalSales}`,
        `Costo de lo Vendido,${financialStatement.totalCostOfGoodsSold}`,
        `Utilidad Bruta,${financialStatement.grossProfit}`,
        `Gastos Operativos,${financialStatement.totalExpenses}`,
        `Utilidad Neta Real,${financialStatement.netProfit}`,
        '',
        headers.join(','),
        ...rows.map((r) => r.join(',')),
      ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-utilidad-tienda-tigre-${dateTo}.csv`;
    a.click();
    toast.success('Reporte exportado en formato CSV / Excel');
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Minimalista y Controles de Exportación */}
      <div className="no-print flex flex-col gap-3 rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0066cc]">
            Reportes Ejecutivos y Estado de Resultados
          </h1>
          <p className="text-xs text-[#666]">
            Fórmula exacta: <strong>Utilidad Neta = Ventas − Costo de lo Vendido − Gastos</strong>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportReportCSV}
            className="flex h-9 items-center gap-1.5 rounded-md border border-[#b0bec5] bg-white px-3.5 text-xs font-bold text-[#455a64] hover:bg-[#f4f6f8]"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#2e7d32]" />
            Exportar a Excel (CSV)
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-9 items-center gap-1.5 rounded-md bg-[#0066cc] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
          >
            <Printer className="h-4 w-4" />
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* Filtro de Rango de Fechas y Pestañas */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e0e4e8] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'utilidad', label: 'Utilidad Real (P&L)' },
            { id: 'por_producto', label: 'Por Artículo' },
            { id: 'por_categoria', label: 'Por Categoría' },
            { id: 'por_usuario', label: 'Por Cajero/Usuario' },
            { id: 'por_cliente', label: 'Por Cliente' },
            { id: 'por_proveedor', label: 'Por Proveedor' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setReportTab(t.id as typeof reportTab)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                reportTab === t.id
                  ? 'bg-[#0066cc] text-white shadow-sm'
                  : 'bg-[#e6e8eb] text-[#555] hover:text-[#111]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs font-bold">
          <span>Desde:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-zinc-300 bg-transparent px-2 dark:border-zinc-700"
          />
          <span>Hasta:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg border border-zinc-300 bg-transparent px-2 dark:border-zinc-700"
          />
        </div>
      </div>

      {/* Área Imprimible */}
      <div className="printable-area space-y-6">
        {/* Resumen de Utilidad Real siempre visible arriba */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-bold uppercase text-zinc-400">
              1. Ventas Brutas (+)
            </span>
            <p className="mt-1 text-xl font-black text-zinc-900 dark:text-white">
              {formatMXN(financialStatement.totalSales)}
            </p>
            <span className="text-[11px] text-zinc-500">
              {financialStatement.ticketsCount} tickets cobrados
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-bold uppercase text-zinc-400">
              2. Costo de lo Vendido (−)
            </span>
            <p className="mt-1 text-xl font-black text-zinc-700 dark:text-zinc-300">
              -{formatMXN(financialStatement.totalCostOfGoodsSold)}
            </p>
            <span className="text-[11px] text-zinc-500">Costo compra de mercancía</span>
          </div>

          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4">
            <span className="text-[11px] font-bold uppercase text-blue-600 dark:text-blue-400">
              3. Utilidad Bruta (=)
            </span>
            <p className="mt-1 text-xl font-black text-blue-600 dark:text-blue-400">
              {formatMXN(financialStatement.grossProfit)}
            </p>
            <span className="text-[11px] text-zinc-500">
              Margen bruto: {financialStatement.grossMarginPct}%
            </span>
          </div>

          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
            <span className="text-[11px] font-bold uppercase text-red-600 dark:text-red-400">
              4. Gastos Operativos (−)
            </span>
            <p className="mt-1 text-xl font-black text-red-600 dark:text-red-400">
              -{formatMXN(financialStatement.totalExpenses)}
            </p>
            <span className="text-[11px] text-zinc-500">Luz, renta, insumos, etc.</span>
          </div>

          <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-500/10 p-4">
            <span className="text-[11px] font-extrabold uppercase text-emerald-700 dark:text-emerald-300">
              5. Utilidad Neta Real (=)
            </span>
            <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatMXN(financialStatement.netProfit)}
            </p>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              Margen neto libre: {financialStatement.netMarginPct}%
            </span>
          </div>
        </div>

        {/* Tabla Dinámica según Pestaña Seleccionada */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {reportTab === 'por_producto' || reportTab === 'utilidad' ? (
            <>
              <h3 className="mb-3 text-base font-extrabold">
                Rentabilidad Desglosada por Producto
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 bg-zinc-50 font-bold uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                    <tr>
                      <th className="px-3 py-2.5">Producto</th>
                      <th className="px-3 py-2.5">SKU</th>
                      <th className="px-3 py-2.5 text-right">Cant. Vendida</th>
                      <th className="px-3 py-2.5 text-right">Ventas ($ MXN)</th>
                      <th className="px-3 py-2.5 text-right">Costo Mercancía</th>
                      <th className="px-3 py-2.5 text-right">Utilidad Generada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {reportByProduct.map((row) => (
                      <tr key={row.productId}>
                        <td className="px-3 py-2.5 font-bold">{row.name}</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-500">{row.sku}</td>
                        <td className="px-3 py-2.5 text-right font-bold">{row.unitsSold}</td>
                        <td className="px-3 py-2.5 text-right font-bold">
                          {formatMXN(row.revenue)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-zinc-500">
                          {formatMXN(row.cost)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-extrabold text-emerald-600">
                          +{formatMXN(row.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : reportTab === 'por_categoria' ? (
            <>
              <h3 className="mb-3 text-base font-extrabold">
                Ventas y Utilidad por Categoría
              </h3>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-200 bg-zinc-50 font-bold uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                  <tr>
                    <th className="px-3 py-2.5">Categoría</th>
                    <th className="px-3 py-2.5 text-right">Ventas Totales</th>
                    <th className="px-3 py-2.5 text-right">Costo de lo Vendido</th>
                    <th className="px-3 py-2.5 text-right">Utilidad Bruta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {reportByCategory.map((c) => (
                    <tr key={c.categoryName}>
                      <td className="px-3 py-2.5 font-bold">{c.categoryName}</td>
                      <td className="px-3 py-2.5 text-right font-bold">{formatMXN(c.revenue)}</td>
                      <td className="px-3 py-2.5 text-right">{formatMXN(c.cost)}</td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-emerald-600">
                        +{formatMXN(c.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : reportTab === 'por_usuario' ? (
            <>
              <h3 className="mb-3 text-base font-extrabold">
                Desempeño de Ventas por Cajero / Usuario
              </h3>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-200 bg-zinc-50 font-bold uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                  <tr>
                    <th className="px-3 py-2.5">Usuario</th>
                    <th className="px-3 py-2.5 text-right">Tickets Cobrados</th>
                    <th className="px-3 py-2.5 text-right">Total Cobrado</th>
                    <th className="px-3 py-2.5 text-right">Utilidad Generada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {reportByUser.map((u) => (
                    <tr key={u.userName}>
                      <td className="px-3 py-2.5 font-bold">{u.userName}</td>
                      <td className="px-3 py-2.5 text-right">{u.ticketsCount}</td>
                      <td className="px-3 py-2.5 text-right font-bold">{formatMXN(u.revenue)}</td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-emerald-600">
                        +{formatMXN(u.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : reportTab === 'por_cliente' ? (
            <>
              <h3 className="mb-3 text-base font-extrabold">
                Estado de Cartera de Clientes y Fiado
              </h3>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-200 bg-zinc-50 font-bold uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                  <tr>
                    <th className="px-3 py-2.5">Cliente</th>
                    <th className="px-3 py-2.5">Teléfono</th>
                    <th className="px-3 py-2.5 text-right">Límite de Crédito</th>
                    <th className="px-3 py-2.5 text-right">Saldo Fiado Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2.5 font-bold">{c.name}</td>
                      <td className="px-3 py-2.5">{c.phone}</td>
                      <td className="px-3 py-2.5 text-right">{formatMXN(c.credit_limit)}</td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-amber-600">
                        {formatMXN(c.current_balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <>
              <h3 className="mb-3 text-base font-extrabold">
                Compras y Cuentas por Pagar por Proveedor
              </h3>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-200 bg-zinc-50 font-bold uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                  <tr>
                    <th className="px-3 py-2.5">Proveedor</th>
                    <th className="px-3 py-2.5">Contacto</th>
                    <th className="px-3 py-2.5">Días de Visita</th>
                    <th className="px-3 py-2.5 text-right">Saldo por Pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {suppliers.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2.5 font-bold">{s.name}</td>
                      <td className="px-3 py-2.5">{s.contact_name}</td>
                      <td className="px-3 py-2.5">{s.visit_days.join(', ')}</td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-red-600">
                        {formatMXN(s.payable_balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
