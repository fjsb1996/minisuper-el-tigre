// ============================================================================
// TIENDA TIGRE - CLIENTE SUPABASE CON DETECCIÓN DE MODO OFFLINE / LOCAL
// ============================================================================

import { createBrowserClient } from '@supabase/ssr';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      key &&
      url.startsWith('https://') &&
      !url.includes('tu-proyecto-id') &&
      key.length > 30
  );
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
