-- EMERGENCY DEBUG: DISABLE SECURITY TO TEST CONNECTION
-- Use this ONLY to verify if the database is reachable and writable.

-- 1. DISABLE RLS COMPLETELY (If this doesn't fix it, the DB is frozen/unreachable)
ALTER TABLE "public"."projects" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."models" DISABLE ROW LEVEL SECURITY;

-- 2. GRANT ALL PERMISSIONS TO EVERYONE
GRANT ALL ON TABLE "public"."projects" TO anon, authenticated, service_role;
GRANT ALL ON TABLE "public"."models" TO anon, authenticated, service_role;

-- 3. CHECK FOR LOCKS (Just for your info, look at the results)
SELECT relation::regclass, mode, granted, pid 
FROM pg_locks 
WHERE relation = 'projects'::regclass;

-- 4. INSERT A TEST ROW MANUALLY (To see if it works from here)
INSERT INTO projects (name, description, user_id, status)
VALUES ('Test SQL Insert', 'Debug', auth.uid(), 'pending');
