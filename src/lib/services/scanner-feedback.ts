// ============================================================================
// TIENDA TIGRE - SERVICIOS DE AUDIO/VIBRACIÓN Y OPEN FOOD FACTS API
// ============================================================================

/**
 * Reproduce un beep de confirmación usando Web Audio API (no requiere archivo MP3)
 * y activa la vibración del teléfono (si está disponible).
 */
export function playScannerBeep(type: 'success' | 'error' | 'warning' = 'success'): void {
  if (typeof window === 'undefined') return;

  // Vibración háptica en celular
  try {
    if ('vibrate' in navigator) {
      if (type === 'success') navigator.vibrate(70);
      else if (type === 'warning') navigator.vibrate([50, 40, 50]);
      else navigator.vibrate([120, 60, 120]);
    }
  } catch {
    // Ignore vibration errors on desktop browsers
  }

  // Síntesis de sonido con Web Audio API
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1480, ctx.currentTime); // Tono agudo tipo lector de supermercado
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.11);
    } else if (type === 'warning') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Ignore audio context restrictions
  }
}

export interface OpenFoodFactsSuggestion {
  found: boolean;
  name?: string;
  brand?: string;
  quantityText?: string;
  imageUrl?: string;
}

/**
 * Consulta la API pública de Open Food Facts para autocompletar nombre, marca y foto
 * cuando se escanea un código EAN-13 / EAN-8 / UPC nuevo en alta de producto.
 */
export async function fetchOpenFoodFactsProduct(
  barcode: string
): Promise<OpenFoodFactsSuggestion> {
  const cleanCode = barcode.trim();
  if (!cleanCode || cleanCode.length < 6) {
    return { found: false };
  }

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_OPEN_FOOD_FACTS_API ||
      'https://world.openfoodfacts.org/api/v2/product';
    const res = await fetch(
      `${baseUrl}/${encodeURIComponent(cleanCode)}.json?fields=product_name,product_name_es,brands,quantity,image_front_small_url`,
      { method: 'GET' }
    );
    if (!res.ok) return { found: false };

    const data = await res.json();
    if (data.status !== 1 || !data.product) {
      return { found: false };
    }

    const p = data.product;
    const rawName = (p.product_name_es || p.product_name || '').trim();
    const brand = (p.brands || '').split(',')[0]?.trim() || '';
    const qty = (p.quantity || '').trim();

    if (!rawName && !brand) return { found: false };

    const fullName = qty && !rawName.toLowerCase().includes(qty.toLowerCase())
      ? `${rawName} ${qty}`.trim()
      : rawName || `Producto ${brand}`;

    return {
      found: true,
      name: fullName,
      brand: brand || 'Genérico',
      quantityText: qty,
      imageUrl: p.image_front_small_url || '',
    };
  } catch {
    return { found: false };
  }
}
