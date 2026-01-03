import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://uufffrsgpdcocosfukjm.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1ZmZmcnNncGRjb2Nvc2Z1a2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMzY5NjQsImV4cCI6MjA4MjcxMjk2NH0.V9RowV3qG8Kv9cDBTXMJsL3NkHNSUhiKvZAVBOcgcs4';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false // Disable to allow manual handling in AuthContext
    }
});

export default customSupabaseClient;

export {
    customSupabaseClient,
    customSupabaseClient as supabase,
};
