-- RUN THIS IN SUPABASE SQL EDITOR TO FIX "TIMEOUT" ERRORS

-- 1. Reset Policies for Projects
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."projects";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."projects";
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON "public"."projects";
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON "public"."projects";

CREATE POLICY "Enable read access for all users" ON "public"."projects"
FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."projects"
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for users based on user_id" ON "public"."projects"
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for users based on user_id" ON "public"."projects"
FOR DELETE USING (auth.uid() = user_id);

-- 2. Reset Policies for Models
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."models";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."models";
DROP POLICY IF EXISTS "Enable all access for own models" ON "public"."models";

CREATE POLICY "Enable read access for all users" ON "public"."models"
FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."models"
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for own models" ON "public"."models"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM projects 
        WHERE projects.id = models.project_id 
        AND projects.user_id = auth.uid()
    )
);

-- 3. Ensure RLS is enabled
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

-- 4. Verify Storage Bucket Permissions (Optional but recommended)
-- Only needed if storage is also blocking, but let's fix DB first.
