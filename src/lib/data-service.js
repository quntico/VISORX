// src/lib/data-service.js
import { supabase } from './supabase';

const DEFAULT_BUCKETS = ['models', 'assets', 'uploads'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Helper to timeout promises (Extended to 20s for slow connections/cold starts)
const withTimeout = (promise, ms = 20000, label = 'operation') => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout in ${label} after ${ms}ms`));
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};
async function retry(fn, { retries = 3, baseDelayMs = 500, label = 'task' } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      if (i > 0) await sleep(baseDelayMs * Math.pow(2, i - 1));
      return await fn(i);
    } catch (e) {
      lastErr = e;
      console.error(`[retry] ${label} attempt ${i + 1}/${retries} failed:`, e);
    }
  }
  throw lastErr;
}

// Allow injecting 'authUser' to bypass async check if we already have it
export async function requireUser(authUser = null) {
  if (authUser) return authUser;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user) throw new Error('No estás loggeado. Inicia sesión para guardar en la nube.');
  return data.user;
}

export async function listProjects(authUser = null) {
  const user = await requireUser(authUser);
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// CREATE PROJECT
export async function createProject(projectData, authUser = null) {
  try {
    const user = await requireUser(authUser);

    // DEBUG ALERT
    console.log('Creating project for user:', user.id);

    const payload = {
      name: projectData.name,
      description: projectData.description,
      user_id: user.id,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const promise = supabase
      .from('projects')
      .insert(payload)
      .select()
      .single();

    const { data, error } = await withTimeout(promise, 25000, 'projects.insert');

    if (error) {
      alert(`DB Error (Projects): ${error.message} - Code: ${error.code}`);
      throw error;
    }

    return data;
  } catch (err) {
    alert(`Fatal Project Error: ${err.message}`);
    throw err;
  }
}

export async function markProjectError(projectId, message) {
  try {
    await supabase
      .from('projects')
      .update({ status: 'error', last_error: String(message || 'unknown error') })
      .eq('id', projectId);
  } catch (e) {
    console.warn('Failed to mark project error:', e);
  }
}

async function pickBucket() {
  // Try buckets in order; first that responds to list works.
  for (const b of DEFAULT_BUCKETS) {
    const { error } = await supabase.storage.from(b).list('', { limit: 1 });
    if (!error) return b;
  }
  // If all fail, just return first and let upload throw a useful error.
  return DEFAULT_BUCKETS[0];
}

function safeName(name = 'file') {
  return name.replace(/[^\w.\-]+/g, '_');
}

export async function uploadModelToCloud({ file, projectId, onStep, authUser }) {
  if (!file) throw new Error('No se recibió archivo.');
  const user = await requireUser(authUser);

  const bucket = await pickBucket();
  const fileName = safeName(file.name || 'model.glb');
  const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
  const ts = Date.now();
  const path = `${user.id}/${projectId}/${ts}-${fileName}`;

  // STEP 2: upload file (with retry + timeout)
  onStep?.({ step: 2, total: 3, message: `Subiendo archivo a la nube (${bucket})...` });

  await retry(async () => {
    const uploadPromise = supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert: true,
        cacheControl: '3600',
        contentType: file.type || undefined
      });

    const { data, error } = await withTimeout(uploadPromise, 20000, 'storage.upload');
    if (error) throw error;
    return data;
  }, { retries: 3, baseDelayMs: 500, label: 'storage.upload' });

  // STEP 3: insert DB record (with retry + timeout)
  onStep?.({ step: 3, total: 3, message: 'Registrando modelo en la base de datos...' });

  const record = await retry(async () => {
    // Get PUBLIC URL
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = publicUrlData.publicUrl;

    const payload = {
      project_id: projectId,
      user_id: user.id,
      file_path: `${bucket}:${path}`,
      file_url: publicUrl, // ESSENTIAL for the viewer
      file_name: fileName,
      mime_type: file.type || 'application/octet-stream',
      size: file.size || null
    };

    const insertPromise = supabase
      .from('models')
      .insert(payload)
      .select()
      .single();

    const { data, error } = await withTimeout(insertPromise, 5000, 'db.insert');
    if (error) throw error;
    return data;
  }, { retries: 3, baseDelayMs: 500, label: 'db.insert' });

  return record;
}

export async function saveModelFlow({ file, selectedProjectId, onStep, authUser }) {
  onStep?.({ step: 1, total: 3, message: 'Verificando sesión y proyecto...' });

  let projectId = selectedProjectId;

  // Ensure user exists
  await requireUser(authUser);

  // Ensure project exists
  if (!projectId) {
    const project = await createProject({ name: 'Nuevo Proyecto', description: 'Proyecto creado automáticamente' }, authUser);
    projectId = project.id;
  }

  try {
    const result = await uploadModelToCloud({ file, projectId, onStep, authUser });
    return { projectId, ...result };
  } catch (e) {
    await markProjectError(projectId, e?.message || e);
    throw e;
  }
}
