
import { supabase } from './supabase';

/**
 * Projects Service
 */
export const projectsService = {
  async getAll() {
    if (!supabase) throw new Error("Supabase not configured");
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    if (!supabase) throw new Error("Supabase not configured");
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(project) {
    if (!supabase) throw new Error("Supabase not configured");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('projects')
      .insert([{ ...project, user_id: user.id }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    if (!supabase) throw new Error("Supabase not configured");
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

/**
 * Models Service
 */
export const modelsService = {
  async getByProject(projectId) {
    if (!supabase) throw new Error("Supabase not configured");
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    if (!supabase) throw new Error("Supabase not configured");
    const { data, error } = await supabase
      .from('models')
      .select('*, projects(name, description)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(model) {
    if (!supabase) throw new Error("Supabase not configured");
    const { data, error } = await supabase
      .from('models')
      .insert([model])
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  
  async delete(id) {
    if (!supabase) throw new Error("Supabase not configured");
    const { error } = await supabase
      .from('models')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

/**
 * Public Links Service
 */
export const publicLinksService = {
  async getByToken(token) {
    if (!supabase) throw new Error("Supabase not configured");
    const { data, error } = await supabase
      .from('public_links')
      .select('*, models(*)')
      .eq('token', token)
      .single();
    if (error) throw error;
    return data;
  },

  async create(modelId) {
    if (!supabase) throw new Error("Supabase not configured");
    
    // Generate a secure random token
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const { data, error } = await supabase
      .from('public_links')
      .insert([{ model_id: modelId, token }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

/**
 * Storage Service
 */
export const storageService = {
  async uploadFile(bucket, path, file) {
    if (!supabase) throw new Error("Supabase not configured");
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });
      
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
      
    return publicUrl;
  }
};
