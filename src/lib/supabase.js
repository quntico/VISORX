import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("FATAL: Supabase environment variables missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

// Storage wrapper (evita crashes si algo bloquea localStorage)
const safeStorage = {
  getItem: (key) => {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key, value) => {
    try { window.localStorage.setItem(key, value); } catch { }
  },
  removeItem: (key) => {
    try { window.localStorage.removeItem(key); } catch { }
  },
};

export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // IMPORTANTÍSIMO si usas #access_token
    storage: safeStorage,
    flowType: "implicit", // si tu URL trae #access_token (si usas PKCE, cambia a "pkce")
  },
});
