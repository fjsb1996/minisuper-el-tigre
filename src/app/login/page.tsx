'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock, Mail, ShieldCheck, Store, UserCheck } from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const { users, loginWithEmail, switchUserRole } = useTiendaStore();

  const [email, setEmail] = useState('admin@tiendatigre.mx');
  const [password, setPassword] = useState('tigre2026');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Ingresa tu correo electrónico y contraseña.');
      return;
    }

    setLoading(true);
    const res = await loginWithEmail(email, password);
    setLoading(false);

    if (!res.ok) {
      setError(res.error || 'No fue posible iniciar sesión.');
      return;
    }

    toast.success('¡Bienvenido a Tienda Tigre!');
    router.push('/pos');
  };

  const handleQuickRoleSelect = async (userId: string) => {
    await switchUserRole(userId);
    const selected = users.find((u) => u.id === userId);
    toast.success(`Sesión iniciada como ${selected?.full_name} (${selected?.role.toUpperCase()})`);
    router.push('/pos');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-orange-950 p-4 text-white">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur md:grid-cols-2">
        {/* Columna Izquierda: Identidad de la Tienda */}
        <div className="flex flex-col justify-between bg-gradient-to-br from-orange-600 to-amber-700 p-8 text-white">
          <div>
            <div className="mb-6 inline-block rounded-2xl bg-white/95 px-4 py-2.5 shadow-xl">
              <img
                src="/logo-el-tigre.png"
                alt="Mini-Súper EL TIGRE"
                className="h-16 w-auto object-contain"
              />
            </div>

            <h2 className="mb-3 text-xl font-bold leading-snug">
              Diseñado para vender rápido desde tu celular o PC en mostrador.
            </h2>
            <ul className="space-y-2.5 text-sm text-orange-50">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white" />
                Escáner de cámara con sonido/vibración y lector USB/Bluetooth.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white" />
                Venta a granel por peso (kg/g) o pidiendo importe en pesos MXN.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white" />
                Control de fiado con recordatorios por WhatsApp e impresora 58/80mm.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white" />
                Funciona con y sin internet (Modo Offline-First + Supabase RLS).
              </li>
            </ul>
          </div>

          <div className="mt-8 rounded-2xl bg-black/25 p-4 text-xs">
            <p className="font-bold uppercase tracking-wider text-orange-200">
              Sucursal Activa
            </p>
            <p className="mt-0.5 text-sm font-semibold">
              Abarrotes y Cremería El Tigre - Matriz (MXN)
            </p>
          </div>
        </div>

        {/* Columna Derecha: Formulario y Acceso Rápido por Rol */}
        <div className="p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Iniciar Sesión</h2>
            <p className="text-xs text-zinc-400">
              Ingresa con tu correo y contraseña o elige un perfil rápido abajo.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/60 p-3 text-xs font-medium text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-10 pr-4 text-sm text-white focus:border-orange-500 focus:outline-none"
                  placeholder="admin@tiendatigre.mx"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-10 pr-4 text-sm text-white focus:border-orange-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 font-bold text-white shadow-lg shadow-orange-600/30 hover:bg-orange-500 active:scale-[0.99]"
            >
              <KeyRound className="h-4 w-4" />
              {loading ? 'Verificando acceso...' : 'Entrar al Sistema'}
            </button>
          </form>

          {/* Acceso Rápido por Rol */}
          <div className="mt-7 border-t border-zinc-800 pt-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
              <ShieldCheck className="h-4 w-4 text-orange-500" />
              Acceso Rápido por Rol (Demostración de Permisos):
            </p>
            <div className="space-y-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickRoleSelect(u.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/80 px-3.5 py-2.5 text-left transition hover:border-orange-500/60 hover:bg-zinc-800"
                >
                  <div className="flex items-center gap-2.5">
                    <UserCheck className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="text-xs font-bold text-white">{u.full_name}</p>
                      <p className="text-[11px] text-zinc-400">{u.email}</p>
                    </div>
                  </div>
                  <span className="rounded-lg bg-orange-500/15 px-2.5 py-1 text-[10px] font-extrabold uppercase text-orange-400">
                    {u.role === 'admin'
                      ? 'Dueño / Admin (Todo)'
                      : u.role === 'encargado'
                        ? 'Encargado (Inv/Compras)'
                        : 'Cajero (Solo POS)'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
