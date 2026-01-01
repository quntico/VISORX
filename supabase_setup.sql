
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create models table
CREATE TABLE IF NOT EXISTS models (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  ios_url TEXT,
  thumbnail_url TEXT,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create public_links table
CREATE TABLE IF NOT EXISTS public_links (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  model_id UUID REFERENCES models(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_links ENABLE ROW LEVEL SECURITY;

-- Projects Policies
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- Models Policies (Cascading access through Project ownership)
CREATE POLICY "Users can view models in their projects"
  ON models FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = models.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create models in their projects"
  ON models FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = models.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update models in their projects"
  ON models FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = models.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete models in their projects"
  ON models FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = models.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Public Links Policies
CREATE POLICY "Public links are publicly viewable by anyone with token"
  ON public_links FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can create public links for their models"
  ON public_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM models
      JOIN projects ON projects.id = models.project_id
      WHERE models.id = public_links.model_id
      AND projects.user_id = auth.uid()
    )
  );

-- Storage Buckets (Must be created manually in dashboard usually, but here is SQL just in case extension allows)
-- Note: It is safer to create these via the Supabase Dashboard > Storage
-- Buckets needed: 'models', 'thumbnails'

-- Storage Policies (pseudo-code, apply in Storage > Policies in Dashboard)
-- Bucket: models
-- Policy: "Authenticated users can upload" -> (bucket_id = 'models' AND auth.role() = 'authenticated')
-- Policy: "Public Access" -> (bucket_id = 'models')

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_models_project_id ON models(project_id);
CREATE INDEX IF NOT EXISTS idx_public_links_token ON public_links(token);
