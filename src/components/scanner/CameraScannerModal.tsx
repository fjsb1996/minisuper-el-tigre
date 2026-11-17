'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, FlashlightOff, Flashlight, Keyboard, RefreshCw, X } from 'lucide-react';
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';
import { playScannerBeep } from '@/lib/services/scanner-feedback';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcode: string) => void;
  title?: string;
  subtitle?: string;
  continuousMode?: boolean;
}

export function CameraScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Escanear Código de Barras',
  subtitle = 'Apunta la cámara al código EAN-13, EAN-8, UPC o Code128',
  continuousMode = false,
}: CameraScannerModalProps) {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const scannerRef = useRef< unknown >(null);
  const lastScanTimestampRef = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    let html5QrCodeInstance: Html5QrcodeType | null = null;

    async function initScanner() {
      setCameraError(null);
      try {
        const mod = await import('html5-qrcode');
        if (!isMounted) return;

        const Html5Qrcode = mod.Html5Qrcode;
        const containerId = 'tigre-camera-reader';
        const el = document.getElementById(containerId);
        if (!el) return;

        html5QrCodeInstance = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCodeInstance;

        await html5QrCodeInstance.start(
          { facingMode },
          {
            fps: 15,
            qrbox: { width: 260, height: 140 },
            aspectRatio: 1.333,
          },
          (decodedText: string) => {
            const now = Date.now();
            // Evitar lecturas duplicadas en menos de 1.2 segundos
            if (now - lastScanTimestampRef.current < 1200) return;
            lastScanTimestampRef.current = now;

            const clean = decodedText.trim();
            if (!clean) return;

            playScannerBeep('success');
            setLastScanned(clean);
            onScanSuccess(clean);

            if (!continuousMode) {
              onClose();
            }
          },
          () => {
            // Frame scan error normal mientras enfoca
          }
        );
      } catch (err) {
        if (!isMounted) return;
        setCameraError(
          'No se pudo acceder a la cámara. Verifica los permisos del navegador o ingresa el código manualmente abajo.'
        );
      }
    }

    const timer = setTimeout(initScanner, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrCodeInstance) {
        html5QrCodeInstance
          .stop()
          .then(() => html5QrCodeInstance?.clear())
          .catch(() => {});
      }
    };
  }, [isOpen, facingMode, continuousMode, onClose, onScanSuccess]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim();
    if (!clean) return;
    playScannerBeep('success');
    setLastScanned(clean);
    onScanSuccess(clean);
    setManualCode('');
    if (!continuousMode) {
      onClose();
    }
  };

  // Códigos rápidos de prueba para probar en PC o sin producto físico a la mano
  const demoBarcodes = [
    { label: 'Coca-Cola 600ml', code: '7501055300075' },
    { label: 'Leche Alpura 1L', code: '7501055900039' },
    { label: 'Sabritas 45g', code: '7501011115590' },
    { label: 'Gansito 50g', code: '7501000153107' },
    { label: 'Sopa Maruchan', code: '041789001956' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600/20 text-orange-500">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">{title}</h3>
              <p className="text-xs text-zinc-400">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Cerrar escáner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Visor de Cámara */}
        <div className="relative bg-black">
          <div id="tigre-camera-reader" className="min-h-[240px] w-full overflow-hidden" />

          {/* Guía láser visual */}
          {!cameraError && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-36 w-64 rounded-xl border-2 border-orange-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                <div className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-red-500 shadow-[0_0_8px_#ef4444]" />
              </div>
            </div>
          )}

          {cameraError && (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
              <FlashlightOff className="h-8 w-8 text-amber-400" />
              <p className="text-sm text-zinc-300">{cameraError}</p>
            </div>
          )}

          {/* Controles flotantes de cámara */}
          <div className="absolute bottom-3 right-3 flex gap-2">
            <button
              type="button"
              onClick={() =>
                setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
              }
              className="flex items-center gap-1.5 rounded-xl bg-zinc-900/90 px-3 py-2 text-xs font-medium text-zinc-200 backdrop-blur hover:bg-zinc-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Cambiar cámara
            </button>
          </div>
        </div>

        {/* Último código leído en modo continuo */}
        {lastScanned && (
          <div className="bg-emerald-950/60 px-4 py-2 text-center text-xs font-medium text-emerald-300">
            Último código leído: <span className="font-mono font-bold">{lastScanned}</span>
          </div>
        )}

        {/* Entrada manual o simulador rápido */}
        <div className="space-y-3 p-4">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Keyboard className=" absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Escribir o pegar código EAN / UPC..."
                className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="h-11 rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-500 active:scale-95"
            >
              Leer
            </button>
          </form>

          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Simular lectura rápida (Pruebas):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {demoBarcodes.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    playScannerBeep('success');
                    setLastScanned(item.code);
                    onScanSuccess(item.code);
                    if (!continuousMode) onClose();
                  }}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-orange-500/50 hover:bg-zinc-800 hover:text-white"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
