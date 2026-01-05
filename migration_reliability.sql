-- ==========================================
-- MIGRACIÓN DE CONFIABILIDAD (RELIABILITY)
-- ==========================================

-- 1. Actualizar tabla projects
-- Agregar estado para tracking de errores y progreso
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- 2. Estandarizar tabla 'assets' (usaremos 'models' existente pero adaptada)
-- Si ya existe 'models', nos aseguramos que tenga las columnas necesarias.
ALTER TABLE models
ADD COLUMN IF NOT EXISTS file_path TEXT, -- Ruta en Storage (user_id/project_id/...)
ADD COLUMN IF NOT EXISTS mime_type TEXT, -- Tipo de archivo (model/gltf-binary, application/zip)
ADD COLUMN IF NOT EXISTS size BIGINT;    -- Tamaño en bytes

-- Indexar para búsquedas rápidas en librería
CREATE INDEX IF NOT EXISTS idx_models_user_project ON models(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- 3. Políticas de Seguridad (RLS) - "Solo el dueño toca lo suyo"
-- Asegurar que RLS esté activo
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas viejas (opcional, para evitar duplicados si se corre varias veces)
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;
-- (Repetir para models)

-- Nuevas Políticas Unificadas (Projects)
CREATE POLICY "Projects Owner Access" ON projects
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Nuevas Políticas Unificadas (Models)
CREATE POLICY "Models Owner Access" ON models
FOR ALL
USING (
    auth.uid() = (SELECT user_id FROM projects WHERE id = models.project_id)
    -- O directamente si models tiene user_id (recomendado agregar user_id a models para RLS más rápido)
    -- Si models TIENE user_id:
    -- auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = (SELECT user_id FROM projects WHERE id = models.project_id)
);

-- NOTA: Si models no tiene user_id, es mejor agregarlo para eficiencia.
ALTER TABLE models ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Actualizar user_id en models basado en projects (si estaba vacío)
UPDATE models SET user_id = projects.user_id
FROM projects
WHERE models.project_id = projects.id AND models.user_id IS NULL;

-- Ahora sí, policy eficiente:
DROP POLICY IF EXISTS "Models Owner Access" ON models;
CREATE POLICY "Models Owner Access" ON models
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Storage (Bucket 'models')
-- Crear bucket si no existe (no se puede en SQL estándar de Supabase, hacer en Dashboard)
-- Policy para Storage (copiar en Dashboard > Storage > Policies):
-- (bucket_id = 'models' AND auth.uid()::text = (storage.foldername(name))[1])
-- Esto asume estructura: user_id/project_id/filename
