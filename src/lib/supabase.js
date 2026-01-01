
import { supabase as customSupabase } from './customSupabaseClient';

// Re-export the pre-configured client
export const supabase = customSupabase;

// Helper to check if Supabase is configured
// Since we are using the integrated client, it should always be available if the environment is correct.
export const isSupabaseConfigured = () => {
  return !!supabase;
};
