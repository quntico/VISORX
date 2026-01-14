
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uufffrsgpdcocosfukjm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1ZmZmcnNncGRjb2Nvc2Z1a2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMzY5NjQsImV4cCI6MjA4MjcxMjk2NH0.V9RowV3qG8Kv9cDBTXMJsL3NkHNSUhiKvZAVBOcgcs4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    console.log("Testing Supabase Insert...");

    // 1. Get a user? No, I am anon. I probably can't insert due to policies?
    // Use login?
    // I need a valid session to insert usually.

    // Let's try to just select first.
    const { data: projects, error: listError } = await supabase.from('projects').select('*').limit(1);
    if (listError) {
        console.log("List Error (Expected if RLS implies auth):", listError.message);
    } else {
        console.log("Projects found:", projects.length);
    }

    // 2. Try to insert with BROKEN column "file_name"
    console.log("\nAttempting Insert with 'file_name'...");
    const { error: error1 } = await supabase.from('models').insert({
        name: 'Test',
        file_name: 'broken.glb', // THIS DOES NOT EXIST
        file_url: 'http://example.com'
    });

    if (error1) {
        console.log("Caught Error 1:", error1.message);
        if (error1.message.includes("Could not find the 'file_name' column")) {
            console.log("CONFIRMED: Sending 'file_name' triggers the error.");
        }
    } else {
        console.log("Success 1 (Unexpected)");
    }
}

test();
