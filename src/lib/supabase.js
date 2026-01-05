import { createClient } from '@supabase/supabase-js';

// 1. Configuración (Prioridad a ENV, Fallback a hardcoded si falla)
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fallbacks (Solo para emergencia/debug)
const fallbackUrl = 'https://uufffrsgpdcocosfukjm.supabase.co';
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1ZmZmcnNncGRjb2Nvc2Z1a2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMzY5NjQsImV4cCI6MjA4MjcxMjk2NH0.V9RowV3qG8Kv9cDBTXMJsL3NkHNSUhiKvZAVBOcgcs4';

export const supabaseUrl = envUrl || fallbackUrl;
export const supabaseAnonKey = envKey || fallbackKey;

console.log("🔌 [Supabase] Iniciando...", {
  url: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : 'MISSING',
  usingEnv: !!envUrl
});

// 2. Crear Cliente Único
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// 3. Helper de verificación
export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey;
};
