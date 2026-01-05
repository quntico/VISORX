
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLibrary() {
    console.log("--- DEBUGGING LIBRARY VISIBILITY ---");

    // 1. Check Auth (Likely null context here, but lets see public access)
    // In a node script without signing in, we are 'anon'. 
    // If RLS is ON, we shouldn't see anything unless we sign in.
    // BUT, we can't easily sign in as the user here without their password.
    // We can only check if the tables are PUBLICLY readable (which they shouldn't be).

    // However, if the user is experiencing this IN APP, they are auth'd.
    // The issue might be that the 'models' table doesn't have the policy applied correctly.

    // Let's try to fetch models as ANON. If we get 0, that's expected (RLS working).
    // If we get error, that's useful info.

    const { data: models, error: modelsError } = await supabase.from('models').select('*').limit(5);

    console.log("\n[ANON] Query 'models':");
    if (modelsError) console.error("Error:", modelsError.message);
    else console.log(`Count: ${models.length} (Expected 0 if RLS is on and secure)`);

    // 2. Check Projects
    const { data: projects, error: projectsError } = await supabase.from('projects').select('*').limit(5);
    console.log("\n[ANON] Query 'projects':");
    if (projectsError) console.error("Error:", projectsError.message);
    else console.log(`Count: ${projects.length}`);

    // 3. Check for specific user data if we could... 
    // Since we can't login as the user, we can't verify their specific rows.
    // But we can verify if the TABLE exists and structure is okay.
}

checkLibrary();
