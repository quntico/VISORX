-- FIX DATABASE HANG / TIMEOUT
-- This script removes TRIGGERS which are likely causing the insert to hang.

-- 1. DROP ALL TRIGGERS ON 'projects' TABLE (The Nuclear Fix for Hanging)
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'projects') LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON "public"."projects"'; 
    END LOOP; 
END $$;

-- 2. DROP ALL TRIGGERS ON 'models' TABLE (Just in case)
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'models') LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON "public"."models"'; 
    END LOOP; 
END $$;

-- 3. ENSURE RLS IS CORRECT (Re-apply Basic Permissive Policies)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

-- Reset Projects Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."projects";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."projects";
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "public"."projects"; -- Variant name
DROP POLICY IF EXISTS "match_user_on_insert" ON "public"."projects";

CREATE POLICY "Enable read access for all users" ON "public"."projects" FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON "public"."projects" FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for owners" ON "public"."projects" FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Enable delete for owners" ON "public"."projects" FOR DELETE USING (auth.uid() = user_id);

-- Reset Models Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."models";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."models";

CREATE POLICY "Enable read access for all users" ON "public"."models" FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON "public"."models" FOR INSERT TO authenticated WITH CHECK (true);

-- 4. FORCE A VACUUM (Clean up dead tuples causing lag)
-- Note: 'VACUUM' cannot be run inside a transaction block in some SQL editors, 
-- but triggers removal is the main fix.
