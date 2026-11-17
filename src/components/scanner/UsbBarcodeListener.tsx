'use client';

import { useEffect, useRef } from 'react';
import { playScannerBeep } from '@/lib/services/scanner-feedback';

interface UsbBarcodeListenerProps {
  onBarcodeDetected: (barcode: string) => void;
  enabled?: boolean;
}

/**
 * Escucha ráfagas de teclado de lectores de código de barras USB o Bluetooth (modo HID).
 * Los lectores láser envían dígitos a alta velocidad (< 45 ms entre teclas) y terminan en Enter.
 */
export function UsbBarcodeListener({
  onBarcodeDetected,
  enabled = true,
}: UsbBarcodeListenerProps) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si se presionan teclas con modificadores (Ctrl+K, Alt, etc.)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // Si el usuario está escribiendo normalmente en un input que NO tiene data-allow-scanner, ignorar
      if (isInputFocused && !target?.hasAttribute('data-allow-barcode-burst')) {
        return;
      }

      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;

      if (elapsed > 85) {
        // Si pasó más de 85ms desde la última tecla, reiniciar el buffer (fue escritura humana)
        bufferRef.current = '';
      }

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 6) {
          e.preventDefault();
          const code = bufferRef.current.trim();
          bufferRef.current = '';
          playScannerBeep('success');
          onBarcodeDetected(code);
        } else {
          bufferRef.current = '';
        }
        return;
      }

      if (e.key.length === 1 && /[0-9A-Za-z\-]/.test(e.key)) {
        bufferRef.current += e.key;
        lastKeyTimeRef.current = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onBarcodeDetected]);

  return null;
}
