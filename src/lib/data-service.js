
import { supabase } from './supabase';
import { isSupabaseConfigured } from './supabase';
import { supabaseAnonKey, supabaseUrl } from './customSupabaseClient';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// MOCK DATABASE ENGINE (LOCAL STORAGE)
// ==========================================
const MOCK_DELAY = 600;

const getMockDB = () => {
  const stored = localStorage.getItem('visorx_db');
  if (stored) return JSON.parse(stored);
  return { projects: [], models: [] };
};

const saveMockDB = (db) => {
  localStorage.setItem('visorx_db', JSON.stringify(db));
};

// HELPER: Determine if we should use Mock
const useMock = () => {
  const mode = localStorage.getItem('visorx_mode');
  if (mode === 'simulation') return true;

  const storedUser = localStorage.getItem('visorx_user');
  if (storedUser) {
    try {
      const u = JSON.parse(storedUser);
      if (u.id === 'dev_user') return true;
    } catch (e) { }
  }

  return !isSupabaseConfigured();
};

// ==========================================
// RECOVERY CLIENT (Fallback for broken persist)
// ==========================================
let recoveryClient = null;

export const setRecoveryToken = (token) => {
  console.log("[DataService] Recovery Token Set. Switching to non-persistent client.");
  try {
    recoveryClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false, // Critical: Do not touch localStorage
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    // Set the session immediately on this new isolated client
    recoveryClient.auth.setSession({ access_token: token, refresh_token: '' });
  } catch (e) {
    console.error("Failed to init recovery client", e);
  }
};

const getClient = () => {
  if (recoveryClient) return recoveryClient;
  return supabase;
};

/**
 * Projects Service
 */
export const projectsService = {
  async getAll() {
    if (useMock()) {
      await new Promise(r => setTimeout(r, MOCK_DELAY));
      return getMockDB().projects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    const { data, error } = await getClient()
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    if (useMock()) {
      await new Promise(r => setTimeout(r, MOCK_DELAY));
      const p = getMockDB().projects.find(p => p.id === id);
      if (!p) throw new Error('Project not found (Mock)');
      return p;
    }

    const { data, error } = await getClient()
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(project) {
    if (useMock()) {
      return createMockProject(project);
    }

    // Use recovery client session or global session
    const client = getClient();
    const { data: { session } } = await client.auth.getSession();
    const user = session?.user;

    if (!user) {
      console.error("No authenticated session found for project creation.");
      throw new Error("Sesión expirada. Por favor recarga la página o inicia sesión.");
    }

    const { data, error } = await client
      .from('projects')
      .insert([{ ...project, user_id: user.id }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    if (useMock()) {
      deleteMockProject(id);
      return;
    }

    const { error } = await getClient()
      .from('projects')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// --- MOCK HELPERS (Internal) ---
const createMockProject = async (project) => {
  await new Promise(r => setTimeout(r, MOCK_DELAY));
  const db = getMockDB();
  const newProject = {
    id: 'proj_' + Date.now(),
    user_id: 'sim_user',
    name: project.name,
    description: project.description,
    created_at: new Date().toISOString()
  };
  db.projects.push(newProject);
  saveMockDB(db);
  return newProject;
};

const deleteMockProject = async (id) => {
  await new Promise(r => setTimeout(r, MOCK_DELAY));
  const db = getMockDB();
  db.projects = db.projects.filter(p => p.id !== id);
  db.models = db.models.filter(m => m.project_id !== id);
  saveMockDB(db);
};

/**
 * Models Service
 */
export const modelsService = {
  async getByProject(projectId) {
    if (useMock()) {
      await new Promise(r => setTimeout(r, MOCK_DELAY));
      return getMockDB().models
        .filter(m => m.project_id === projectId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    const { data, error } = await getClient()
      .from('models')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getAll() {
    if (useMock()) {
      await new Promise(r => setTimeout(r, MOCK_DELAY));
      return getMockDB().models.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    const { data, error } = await getClient()
      .from('models')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getById(id) {
    if (useMock()) {
      await new Promise(r => setTimeout(r, MOCK_DELAY));
      const m = getMockDB().models.find(m => m.id === id);
      if (!m) throw new Error("Model not found (Mock)");
      const p = getMockDB().projects.find(p => p.id === m.project_id);
      return { ...m, projects: p || {} };
    }

    const { data, error } = await getClient()
      .from('models')
      .select('*, projects(name, description)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(model) {
    const runMock = async () => {
      await new Promise(r => setTimeout(r, MOCK_DELAY));
      const db = getMockDB();
      const newModel = {
        id: 'model_' + Date.now(),
        ...model,
        created_at: new Date().toISOString()
      };
      db.models.push(newModel);
      saveMockDB(db);
      return newModel;
    };

    if (useMock()) return runMock();

    const { data, error } = await getClient()
      .from('models')
      .insert([model])
      .select()
      .single();

    if (error) {
      console.error("Real DB insert failed:", error);
      throw error;
    }
    return data;
  },

  async delete(id) {
    if (useMock()) {
      await new Promise(r => setTimeout(r, MOCK_DELAY));
      const db = getMockDB();
      db.models = db.models.filter(m => m.id !== id);
      saveMockDB(db);
      return;
    }

    const { error } = await getClient()
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
    if (useMock()) return null;

    const { data, error } = await getClient()
      .from('public_links')
      .select('*, models(*)')
      .eq('token', token)
      .single();
    if (error) throw error;
    return data;
  },

  async create(modelId) {
    if (useMock()) {
      return { token: 'mock_token_' + modelId };
    }

    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const { data, error } = await getClient()
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
  async uploadFile(bucket, path, file, onProgress) {
    const runMockObj = () => {
      return new Promise((resolve) => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          if (onProgress) onProgress(progress);
          if (progress >= 100) {
            clearInterval(interval);
            const blobUrl = URL.createObjectURL(file);
            resolve(blobUrl);
          }
        }, 100);
      });
    };

    if (useMock()) return runMockObj();

    try {
      if (onProgress) {
        // Use getClient() to get the correct client (recovery or default)
        const client = getClient();
        const { data: { session } } = await client.auth.getSession();

        const token = session?.access_token || supabaseAnonKey;

        if (!token) throw new Error("No token available for upload (User or Anon)");

        const projectUrl = supabaseUrl;
        const url = `${projectUrl}/storage/v1/object/${bucket}/${path}`;

        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', url);

          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.setRequestHeader('x-upsert', 'false');

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percentComplete = (e.loaded / e.total) * 100;
              onProgress(percentComplete);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const { data: { publicUrl } } = client.storage.from(bucket).getPublicUrl(path);
              resolve(publicUrl);
            } else {
              reject(new Error(`Upload failed: ${xhr.statusText} (${xhr.responseText})`));
            }
          };

          xhr.onerror = () => reject(new Error('Network Error during upload'));
          xhr.send(file);
        });
      }

      const { data, error } = await getClient().storage
        .from(bucket)
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data: { publicUrl } } = getClient().storage
        .from(bucket)
        .getPublicUrl(path);

      return publicUrl;
    } catch (err) {
      console.log("Storage upload failed, falling back to mock.", err);
      if (file.size > 50 * 1024 * 1024) throw err;
      return runMockObj();
    }
  }
};
