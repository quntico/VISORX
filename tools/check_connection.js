
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uufffrsgpdcocosfukjm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1ZmZmcnNncGRjb2Nvc2Z1a2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMzY5NjQsImV4cCI6MjA4MjcxMjk2NH0.V9RowV3qG8Kv9cDBTXMJsL3NkHNSUhiKvZAVBOcgcs4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkConnection() {
    console.log("--- Supabase Connection Check ---");
    console.log("URL:", SUPABASE_URL);

    const start = Date.now();
    try {
        const { data, error } = await supabase.from('projects').select('count', { count: 'exact', head: true });
        const latency = Date.now() - start;

        if (error) {
            console.error("❌ ERROR DETECTED:", error.message);
            console.error("Code:", error.code);
            console.error("Details:", error.details);
            console.error("Hint:", error.hint);
        } else {
            console.log("✅ Connection Successful!");
            console.log(`Latency: ${latency}ms`);
            console.log("Status: Active/Resolvable");
        }
    } catch (e) {
        console.error("❌ CRITICAL NETWORK ERROR:", e.message);
    }
}

checkConnection();
