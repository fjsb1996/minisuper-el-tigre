'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  DollarSign,
  Plus,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import {
  formatDateShortMX,
  formatMXN,
  getDaysUntilExpiry,
  roundCurrency,
} from '@/lib/utils/formatters';

const PIE_COLORS = ['#0066cc', '#2e7d32', '#d95c38', '#f59e0b', '#6366f1', '#0891b2'];

export default function DashboardPage() {
  const { sales, products, categories, customers, expenses, cashShifts } =
    useTiendaStore();

  const [period, setPeriod] = useState<'hoy' | 'semana' | 'mes'>('hoy');

  const completedSales = useMemo(
    () => sales.filter((s) => s.status === 'completada'),
    [sales]
  );

  // Filtrar ventas según periodo
  const periodSales = useMemo(() => {
    if (completedSales.length === 0) return [];
    const latestSaleMs = Math.max(
      ...completedSales.map((s) => new Date(s.created_at).getTime())
    );
    const maxHours = period === 'hoy' ? 24 : period === 'semana' ? 24 * 7 : 24 * 30;
    return completedSales.filter((s) => {
      const hoursDiff =
        Math.abs(latestSaleMs - new Date(s.created_at).getTime()) / (1000 * 60 * 60);
      return hoursDiff <= maxHours;
    });
  }, [completedSales, period]);

  const kpis = useMemo(() => {
    const totalRevenue = roundCurrency(
      periodSales.reduce((acc, s) => acc + s.total, 0)
    );
    const totalCostOfGoods = roundCurrency(
      periodSales.reduce((acc, s) => acc + s.total_cost, 0)
    );
    const grossProfit = roundCurrency(totalRevenue - totalCostOfGoods);
    const totalExpenses = roundCurrency(
      expenses.reduce((acc, e) => acc + e.amount, 0)
    );
    const netProfit = roundCurrency(grossProfit - totalExpenses);
    const avgTicket =
      periodSales.length > 0 ? roundCurrency(totalRevenue / periodSales.length) : 0;
    const totalPendingFiado = roundCurrency(
      customers.reduce((acc, c) => acc + c.current_balance, 0)
    );

    return {
      totalRevenue,
      totalCostOfGoods,
      grossProfit,
      totalExpenses,
      netProfit,
      avgTicket,
      salesCount: periodSales.length,
      totalPendingFiado,
    };
  }, [periodSales, expenses, customers]);

  // Top Productos Más Vendidos
  const topProductsData = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; qty: number }> = {};
    for (const sale of completedSales) {
      for (const item of sale.items) {
        if (!map[item.product_id]) {
          map[item.product_id] = {
            name: item.product_name_snapshot.slice(0, 22).toUpperCase(),
            revenue: 0,
            qty: 0,
          };
        }
        map[item.product_id].revenue = roundCurrency(
          map[item.product_id].revenue + item.subtotal
        );
        map[item.product_id].qty += item.quantity;
      }
    }
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [completedSales]);

  // Ventas por Categoría
  const salesByCategoryData = useMemo(() => {
    const map: Record<string, { name: string; value: number }> = {};
    for (const sale of completedSales) {
      for (const item of sale.items) {
        const prod = products.find((p) => p.id === item.product_id);
        const cat = categories.find((c) => c.id === prod?.category_id);
        const catName = cat?.name || 'Otros';
        if (!map[catName]) {
          map[catName] = { name: catName, value: 0 };
        }
        map[catName].value = roundCurrency(map[catName].value + item.subtotal);
      }
    }
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [completedSales, products, categories]);

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.is_active && p.stock_current <= p.stock_min),
    [products]
  );

  const expiringProducts = useMemo(
    () =>
      products.filter((p) => {
        if (!p.is_active || !p.expiry_date) return false;
        const d = getDaysUntilExpiry(p.expiry_date);
        return d !== null && d <= 10;
      }),
    [products]
  );

  const activeShift = cashShifts.find((s) => s.status === 'abierta');

  return (
    <div className="space-y-4">
      {/* Encabezado Minimalista */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0066cc]">
            Resumen Operativo — Tienda Tigre
          </h1>
          <p className="text-xs text-[#666]">
            Indicadores de ventas, utilidad neta, caja activa y alertas de inventario.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md bg-[#e6e8eb] p-1">
            {[
              { id: 'hoy', label: 'Hoy' },
              { id: 'semana', label: 'Semana' },
              { id: 'mes', label: 'Mes' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPeriod(t.id as typeof period)}
                className={`rounded px-3 py-1 text-xs font-bold transition ${
                  period === t.id
                    ? 'bg-[#0066cc] text-white shadow-sm'
                    : 'text-[#555] hover:text-[#111]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Link
            href="/productos?nuevo=1"
            className="flex h-9 items-center gap-1.5 rounded-md border border-[#0066cc] bg-white px-3.5 text-xs font-bold text-[#0066cc] hover:bg-[#e8f0f8]"
          >
            <Plus className="h-4 w-4" />
            Agregar Artículo (Alt+A)
          </Link>

          <Link
            href="/pos"
            className="flex h-9 items-center gap-1.5 rounded-md bg-[#0066cc] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
          >
            <ShoppingCart className="h-4 w-4" />
            Nueva Venta (Alt+V)
          </Link>
        </div>
      </div>

      {/* Tarjetas de KPIs Minimalistas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-[#666]">
              Ventas ({period.toUpperCase()})
            </span>
            <DollarSign className="h-4 w-4 text-[#0066cc]" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-[#0066cc]">
            {formatMXN(kpis.totalRevenue)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#666]">
            {kpis.salesCount} tickets • Promedio: <strong>{formatMXN(kpis.avgTicket)}</strong>
          </p>
        </div>

        <div className="rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-[#666]">
              Utilidad Neta Real
            </span>
            <TrendingUp className="h-4 w-4 text-[#2e7d32]" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-[#2e7d32]">
            {formatMXN(kpis.netProfit)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#666]">
            Bruta: {formatMXN(kpis.grossProfit)} − Gastos: {formatMXN(kpis.totalExpenses)}
          </p>
        </div>

        <div className="rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-[#666]">
              Fiado Pendiente
            </span>
            <Users className="h-4 w-4 text-[#d95c38]" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-[#d95c38]">
            {formatMXN(kpis.totalPendingFiado)}
          </p>
          <Link
            href="/clientes"
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#0066cc] hover:underline"
          >
            Ver cuentas por cobrar <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-[#666]">
              Efectivo en CAJA-01
            </span>
            <Wallet className="h-4 w-4 text-[#0066cc]" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-[#222]">
            {activeShift ? formatMXN(activeShift.expected_cash) : '$0.00'}
          </p>
          <Link
            href="/caja"
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#0066cc] hover:underline"
          >
            {activeShift ? 'Turno Abierto • Ver Corte' : 'Abrir Turno de Caja'}
          </Link>
        </div>
      </div>

      {/* Gráficas Recharts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-[#e0e4e8] bg-white p-5 shadow-sm lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0066cc]">
                Artículos Más Vendidos (MXN)
              </h2>
              <p className="text-[11px] text-[#666]">
                Productos con mayor desplazamiento en mostrador
              </p>
            </div>
            <Link
              href="/reportes"
              className="text-xs font-bold text-[#0066cc] hover:underline"
            >
              Ver reportes →
            </Link>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductsData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis type="number" tickFormatter={(v) => `$${v}`} fontSize={11} />
                <YAxis type="category" dataKey="name" width={140} fontSize={10} />
                <Tooltip
                  formatter={(value: number) => [formatMXN(value), 'Ventas']}
                />
                <Bar dataKey="revenue" fill="#0066cc" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-[#e0e4e8] bg-white p-5 shadow-sm lg:col-span-5">
          <h2 className="text-sm font-bold text-[#0066cc]">Ventas por Categoría</h2>
          <p className="mb-3 text-[11px] text-[#666]">
            Participación por departamento
          </p>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salesByCategoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  label={({ name }) => name}
                >
                  {salesByCategoryData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => formatMXN(val)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alertas Operativas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase text-[#d95c38]">
              <AlertTriangle className="h-4 w-4" />
              Artículos con Stock Bajo ({lowStockProducts.length})
            </h3>
            <Link
              href="/inventario"
              className="text-xs font-bold text-[#0066cc] hover:underline"
            >
              Reabastecer →
            </Link>
          </div>
          <div className="overflow-hidden rounded-lg border border-[#d5d8dc] bg-[#e6e8eb]">
            {lowStockProducts.slice(0, 5).map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center justify-between border-b border-[#dcdcdc] px-3 py-2 text-xs last:border-0 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-[#f4f6f8]'
                }`}
              >
                <div>
                  <span className="font-bold uppercase text-[#222]">{p.name}</span>
                  <span className="ml-2 text-[11px] text-[#666]">Mín: {p.stock_min}</span>
                </div>
                <span className="font-extrabold text-[#d95c38]">
                  {p.stock_current} {p.sale_unit === 'pieza' ? 'PZ' : p.sale_unit.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase text-[#0066cc]">
              <Calendar className="h-4 w-4" />
              Perecederos Próximos a Caducar ({expiringProducts.length})
            </h3>
            <Link
              href="/inventario"
              className="text-xs font-bold text-[#0066cc] hover:underline"
            >
              Ver lotes →
            </Link>
          </div>
          <div className="overflow-hidden rounded-lg border border-[#d5d8dc] bg-[#e6e8eb]">
            {expiringProducts.slice(0, 5).map((p, idx) => {
              const days = getDaysUntilExpiry(p.expiry_date);
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between border-b border-[#dcdcdc] px-3 py-2 text-xs last:border-0 ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-[#f4f6f8]'
                  }`}
                >
                  <div>
                    <span className="font-bold uppercase text-[#222]">{p.name}</span>
                    <span className="ml-2 text-[11px] text-[#666]">
                      Cad: {formatDateShortMX(p.expiry_date)}
                    </span>
                  </div>
                  <span className="font-extrabold text-[#d95c38]">
                    {days !== null && days <= 0 ? '¡Vencido!' : `${days} días`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
