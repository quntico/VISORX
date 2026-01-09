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

// CREATE PROJECT (RPC Strategy - Security Definer)
export async function createProject(projectData, authUser = null) {
  try {
    console.log("STEP 2a: createProject started (RPC Mode)");
    const user = await requireUser(authUser);

    const payload = {
      p_name: projectData.name,
      p_description: projectData.description,
      p_user_id: user.id
    };

    console.log("STEP 2b: Calling RPC create_project_safe...");

    // RPC Request - Bypasses Client RLS
    const { data, error } = await withTimeout(
      supabase.rpc('create_project_safe', payload),
      15000,
      'rpc.create_project_safe'
    );

    if (error) {
      console.error("STEP 2c: RPC Failed:", error);
      throw error;
    }

    // Normalize RPC response (it returns the object directly or inside data)
    // If returning jsonb, it might be data object itself
    const project = data;

    console.log("STEP 2d: Project created via RPC:", project);
    return project;
  } catch (err) {
    console.error("STEP 2e: Fatal Project Error:", err);
    throw new Error(`Error creando proyecto (RPC): ${err.message}`);
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
  // FAST TRACK: Always try 'models' first without listing (avoids RLS listing errors)
  return 'models';

  /* 
  // Old Logic (Too Fragile)
  for (const b of DEFAULT_BUCKETS) {
    const { error } = await supabase.storage.from(b).list('', { limit: 1 });
    if (!error) return b;
  }
  return DEFAULT_BUCKETS[0];
  */
}

function safeName(name = 'file') {
  return name.replace(/[^\w.\-]+/g, '_');
}

export async function uploadModelToCloud({ file, projectId, onStep, authUser, name }) {
  if (!file) throw new Error('No se recibió archivo.');
  if (!projectId) throw new Error('Project ID missing for upload.');

  // ... (lines 132-176 abbreviated in thought, but keeping full function context isn't possible with replace_file small chunk. I will use a larger chunk or targeted replacement)
  // Actually, I can just replace the signature and the payload construction.
  // Wait, I need to replace line 128 (signature) AND line 177 (payload). They are far apart.
  // I'll use multi_replace.


  console.log("STEP 4: uploadModelToCloud started");

  const user = await requireUser(authUser);

  console.log("STEP 5: Picking bucket...");
  const bucket = await pickBucket();
  console.log("STEP 5b: Bucket selected:", bucket);

  const fileName = safeName(file.name || 'model.glb');
  const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
  const ts = Date.now();
  const path = `${user.id}/${projectId}/${ts}-${fileName}`;

  // STEP 6: upload file (with retry + timeout)
  onStep?.({ step: 2, total: 3, message: `Subiendo archivo a la nube (${bucket})...` });
  console.log("STEP 6: Starting Storage Upload to:", path);

  const mimeType = file.type || (ext === 'glb' ? 'model/gltf-binary' : 'application/octet-stream');

  await retry(async (attempt) => {
    console.log(`STEP 6b: Upload attempt ${attempt + 1}`);
    const uploadPromise = supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert: true,
        cacheControl: '3600',
        contentType: mimeType
      });

    const { data, error } = await withTimeout(uploadPromise, 300000, 'storage.upload'); // 5 minutes for large files
    if (error) throw error;
    console.log("STEP 6c: Upload successful:", data);
    return data;
  }, { retries: 3, baseDelayMs: 500, label: 'storage.upload' });

  // STEP 7: insert DB record (with retry + timeout)
  onStep?.({ step: 3, total: 3, message: 'Registrando modelo en la base de datos...' });
  console.log("STEP 7: Registering model in DB...");

  const record = await retry(async () => {
    // Get PUBLIC URL
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = publicUrlData.publicUrl;
    console.log("STEP 7b: Public URL generated:", publicUrl);

    const payload = {
      project_id: projectId,
      user_id: user.id,
      name: name || fileName, // PREFER USER NAME
      file_path: `${bucket}:${path}`,
      file_url: publicUrl, // ESSENTIAL for the viewer
      mime_type: file.type || 'application/octet-stream',
      size: file.size || null
    };

    const insertPromise = supabase
      .from('models')
      .insert(payload)
      .select()
      .single();

    const { data, error } = await withTimeout(insertPromise, 10000, 'model.insert');
    if (error) throw error;
    console.log("STEP 7c: Model registered:", data);
    return data;
  }, { retries: 3, baseDelayMs: 500, label: 'db.insert' });

  return record;
}

// SELF-HEALING AUTH: Force cleanup on stale sessions
async function recoverSession() {
  console.warn("🚨 SELF-HEALING: Session corrupted. Clearing storage & reloading...");

  // 1. Local Logout
  await supabase.auth.signOut().catch(() => { });

  // 2. Aggressive Storage Cleansing
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth_token')) {
      localStorage.removeItem(key);
    }
  });
  // 3. Force Reload
  window.location.reload();
}

export async function saveModelFlow({ file, selectedProjectId, onStep, authUser, name }) {
  // ...
  // (skipping logic)
  // ...
  // Line 317 needs update
  // I need to start higher to replace signature.

  const start = Date.now();
  console.log("start-flow: saveModelFlow started");

  // 1. DIAGNOSTICS & AUTH CHECK
  const sbUrl = import.meta.env.VITE_SUPABASE_URL || 'MISSING';
  const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'MISSING';
  console.log(`[EnvCheck] URL: ${sbUrl}, Key (start): ${sbKey.substring(0, 10)}...`);

  onStep?.({ step: 1, total: 3, message: 'Verificando sesión...' });

  // 2. STRICT SESSION REFRESH
  let sessionUser = authUser;
  try {
    if (!sessionUser) {
      console.log("STEP 1: Getting Clean Session...");
      // Race condition wrapper for getSession (5s max)
      const sessionPromise = supabase.auth.getSession();
      const { data, error } = await withTimeout(sessionPromise, 5000, 'auth.getSession');

      if (error || !data.session) {
        console.warn("STEP 1: Session invalid/timeout. Trying refresh...");
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          throw new Error("AUTH_DEAD");
        }
        sessionUser = refreshData.session.user;
      } else {
        sessionUser = data.session.user;
      }
    }
  } catch (e) {
    console.error("STEP 1 FATAL: Auth System Dead.", e);
    if (e.message.includes("AUTH_DEAD") || e.message.includes("Timeout")) {
      await recoverSession();
      throw new Error("Sesión caducada. Recargando...");
    }
    throw e;
  }

  console.log(`STEP 1: User Confirmed: ${sessionUser.id} (${Date.now() - start}ms)`);

  let projectId = selectedProjectId;

  // 3. PROJECT RESOLUTION (Existing vs RPC)
  if (!projectId) {
    onStep?.({ step: 1, total: 3, message: 'Buscando proyecto...' });

    try {
      console.log("STEP 2: Searching for existing project (8s max)...");

      // Wrap query in explicit timeout
      const searchPromise = supabase
        .from('projects')
        .select('*')
        .eq('user_id', sessionUser.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const { data: existingProjects, error } = await withTimeout(searchPromise, 8000, 'search.projects');

      if (error) throw error;

      if (existingProjects && existingProjects.length > 0) {
        projectId = existingProjects[0].id;
        console.log(`STEP 2: Found existing project (Reusing): ${projectId} (${Date.now() - start}ms)`);
      } else {
        console.log("STEP 2: No existing projects found. Creating new via RPC...");
        throw new Error("No projects found (Trigger RPC)");
      }
    } catch (err) {
      if (err.message.includes("Timeout")) {
        console.error("STEP 2 TIMEOUT: Database Unreachable?");
        // Only auto-recover if it's strictly a timeout on READ, hinting at stale auth headers
        if (Date.now() - start > 8000) {
          await recoverSession();
          throw new Error("Conexión inestable. Reiniciando...");
        }
      }

      // FALLBACK TO RPC
      console.warn(`STEP 2 Warning: Search failed/timeout/empty (${err.message}). Falling back to RPC.`);
      try {
        const project = await createProject({ name: 'Nuevo Proyecto', description: 'Proyecto creado automáticamente' }, sessionUser);
        projectId = project.id;
      } catch (rpcErr) {
        console.error("STEP 2 FATAL: RPC also failed.", rpcErr);
        throw new Error("Error crítico de base de datos. Intente más tarde.");
      }
    }
  } else {
    console.log("STEP 2: Using provided project:", projectId);
  }

  // 4. UPLOAD
  try {
    console.log(`STEP 3: Calling uploadModelToCloud with ID: ${projectId}...`);
    const result = await uploadModelToCloud({ file, projectId, onStep, authUser: sessionUser, name });
    console.log(`STEP 8: Workflow Complete! Total time: ${Date.now() - start}ms`, result);
    return { projectId, ...result };
  } catch (e) {
    console.error("Workflow Failed:", e);
    if (projectId) await markProjectError(projectId, e?.message || e);
    throw e;
  }
}
