'use client';

import React, { useState } from 'react';
import {
  Database,
  Download,
  FileText,
  Printer,
  RotateCcw,
  ShieldAlert,
  Store,
  UserPlus,
  Users,
} from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import { UserRole } from '@/types/database';
import { formatDateTimeMX } from '@/lib/utils/formatters';
import { toast } from 'sonner';

export default function ConfiguracionPage() {
  const {
    branch,
    users,
    auditLogs,
    products,
    categories,
    sales,
    customers,
    suppliers,
    purchases,
    expenses,
    inventoryMovements,
    updateBranchConfig,
    createUserProfile,
    resetDemoDatabase,
    currentUser,
  } = useTiendaStore();

  const [activeTab, setActiveTab] = useState<'usuarios' | 'bitacora' | 'sucursal' | 'respaldo'>(
    'usuarios'
  );

  // Nuevo Usuario
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('cajero');
  const [pinCode, setPinCode] = useState('');

  // Datos Sucursal
  const [branchName, setBranchName] = useState(branch.name);
  const [branchAddress, setBranchAddress] = useState(branch.address);
  const [branchPhone, setBranchPhone] = useState(branch.phone);
  const [ticketHeader, setTicketHeader] = useState(branch.ticket_header);
  const [ticketFooter, setTicketFooter] = useState(branch.ticket_footer);
  const [printerWidth, setPrinterWidth] = useState<58 | 80>(branch.printer_width_mm);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;
    await createUserProfile({
      full_name: fullName.trim(),
      email: email.trim(),
      role,
      pin_code: pinCode.trim() || '0000',
      is_active: true,
    });
    toast.success(`Usuario "${fullName}" creado con rol ${role.toUpperCase()}`);
    setFullName('');
    setEmail('');
    setPinCode('');
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBranchConfig({
      name: branchName,
      address: branchAddress,
      phone: branchPhone,
      ticket_header: ticketHeader,
      ticket_footer: ticketFooter,
      printer_width_mm: printerWidth,
    });
    toast.success('Configuración de sucursal e impresora térmica guardada');
  };

  const handleFullBackupDownload = () => {
    const backupPayload = {
      exported_at: new Date().toISOString(),
      store: branch,
      counts: {
        products: products.length,
        categories: categories.length,
        sales: sales.length,
        customers: customers.length,
        suppliers: suppliers.length,
      },
      data: {
        branch,
        users,
        categories,
        products,
        sales,
        customers,
        suppliers,
        purchases,
        expenses,
        inventoryMovements,
        auditLogs,
      },
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo-completo-tienda-tigre-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast.success('Respaldo completo JSON descargado exitosamente');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm">
        <h1 className="text-lg font-bold text-[#0066cc]">
          Usuarios, Seguridad RLS, Bitácora y Respaldos
        </h1>
        <p className="text-xs text-[#666]">
          Gestión de roles (Dueño/Admin, Encargado, Cajero), datos de sucursal para el ticket e impresora 58/80mm.
        </p>
      </div>

      {/* Pestañas estilo Carpeta */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#d0d5dd] bg-[#e2e5e9] px-2 pt-2 rounded-t-lg">
        {[
          { id: 'usuarios', label: 'Usuarios y Roles', icon: Users },
          { id: 'bitacora', label: `Bitácora de Auditoría (${auditLogs.length})`, icon: ShieldAlert },
          { id: 'sucursal', label: 'Sucursal e Impresora 58/80mm', icon: Store },
          { id: 'respaldo', label: 'Respaldos y Exportación Total', icon: Database },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold ${
                activeTab === t.id
                  ? 'bg-[#0066cc] text-white shadow-sm'
                  : 'bg-[#d4d8dd] text-[#444] hover:bg-[#dcdfe4]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* PESTAÑA 1: USUARIOS Y ROLES */}
      {activeTab === 'usuarios' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-extrabold">
              <UserPlus className="h-5 w-5 text-orange-500" />
              Registrar Nuevo Usuario
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Ana López (Cajera Vespertina)"
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ana@tiendatigre.mx"
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">Rol y Permisos RLS *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="admin">Dueño / Admin (Acceso total + Seguridad)</option>
                  <option value="encargado">
                    Encargado (Inventario, Compras, Proveedores y Reportes)
                  </option>
                  <option value="cajero">Cajero (Solo Punto de Venta POS y Consulta)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">PIN Rápido Mostrador</label>
                <input
                  type="text"
                  maxLength={6}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="1234"
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 font-mono text-sm dark:border-zinc-700"
                />
              </div>

              <button
                type="submit"
                disabled={currentUser.role !== 'admin'}
                className="h-10 w-full rounded-md bg-[#0066cc] text-xs font-bold text-white hover:bg-[#0055b3] disabled:opacity-40"
              >
                Crear Usuario
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-7">
            <h3 className="mb-3 text-base font-extrabold">
              Plantilla de Usuarios Activos ({users.length})
            </h3>
            <div className="space-y-2.5">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 p-3.5 text-xs dark:border-zinc-800"
                >
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">
                      {u.full_name}
                    </p>
                    <p className="text-zinc-500">{u.email}</p>
                  </div>
                  <span className="rounded-full bg-orange-500/15 px-3 py-1 font-extrabold uppercase text-orange-600 dark:text-orange-400">
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: BITÁCORA DE ACCIONES SENSIBLES */}
      {activeTab === 'bitacora' && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-1 text-base font-extrabold">
            Bitácora de Seguridad y Acciones Sensibles
          </h3>
          <p className="mb-4 text-xs text-zinc-500">
            Registro inmutable de cambios de precio, ajustes manuales de inventario, cancelaciones de venta y diferencias de caja.
          </p>

          <div className="space-y-2.5">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-red-500/15 px-2.5 py-0.5 font-extrabold text-red-600 dark:text-red-400">
                      {log.action}
                    </span>
                    <span className="font-bold">{log.user_name}</span>
                  </div>
                  <span className="text-zinc-500">{formatDateTimeMX(log.created_at)}</span>
                </div>
                <p className="mt-1.5 text-zinc-700 dark:text-zinc-300">
                  Motivo: <strong>{log.reason || 'Sin motivo especificado'}</strong>
                </p>
                {(log.old_data || log.new_data) && (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-900 p-2 font-mono text-[11px] text-zinc-200">
                    Antes: {JSON.stringify(log.old_data)} | Nuevo: {JSON.stringify(log.new_data)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: SUCURSAL E IMPRESORA TÉRMICA */}
      {activeTab === 'sucursal' && (
        <div className="max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-4 text-base font-extrabold">
            Datos de la Sucursal y Formato de Ticket Térmico
          </h3>
          <form onSubmit={handleSaveBranch} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold">Nombre de la Tienda / Sucursal</label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold">Dirección en Ticket</label>
              <input
                type="text"
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold">Teléfono</label>
                <input
                  type="text"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Ancho Impresora Térmica</label>
                <select
                  value={printerWidth}
                  onChange={(e) => setPrinterWidth(Number(e.target.value) as 58 | 80)}
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value={58}>58 mm (Mini Impresora Portátil / USB)</option>
                  <option value={80}>80 mm (Impresora Estándar de Mostrador)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold">Encabezado del Ticket</label>
              <input
                type="text"
                value={ticketHeader}
                onChange={(e) => setTicketHeader(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold">Pie de Página del Ticket</label>
              <input
                type="text"
                value={ticketFooter}
                onChange={(e) => setTicketFooter(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
              />
            </div>

            <button
              type="submit"
              className="h-10 rounded-md bg-[#0066cc] px-6 text-xs font-bold text-white hover:bg-[#0055b3]"
            >
              Guardar Configuración
            </button>
          </form>
        </div>
      )}

      {/* PESTAÑA 4: RESPALDOS Y EXPORTACIÓN COMPLETA */}
      {activeTab === 'respaldo' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-extrabold">
              Exportación Completa de Datos (Respaldo Local + Nube)
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Descarga una copia íntegra de tus productos, inventario, ventas, fiado de clientes, proveedores y bitácora en formato JSON.
            </p>
            <button
              type="button"
              onClick={handleFullBackupDownload}
              className="mt-4 flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-500"
            >
              <Download className="h-4 w-4" />
              Descargar Respaldo Completo (.JSON)
            </button>
          </div>

          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
            <h3 className="text-base font-extrabold text-red-600 dark:text-red-400">
              Restaurar Datos Semilla de Demostración
            </h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Reinicia la base de datos local IndexedDB a su estado inicial con los 31 productos mexicanos de ejemplo.
            </p>
            <button
              type="button"
              onClick={async () => {
                if (
                  window.confirm(
                    '¿Deseas restaurar la base de datos de demostración a sus valores iniciales?'
                  )
                ) {
                  await resetDemoDatabase();
                  toast.success('Datos semilla restaurados correctamente');
                }
              }}
              className="mt-4 flex h-12 items-center gap-2 rounded-xl bg-red-600 px-5 text-xs font-extrabold text-white hover:bg-red-500"
            >
              <RotateCcw className="h-4 w-4" />
              Restaurar Datos Semilla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
