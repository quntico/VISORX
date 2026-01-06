import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
// import { motion } from 'framer-motion'; 
import { Plus, Box as Cube, LogOut, Folder, Eye, Loader2, ShieldCheck, Settings, Image as ImageIcon, Globe, Info as InfoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import CreateProjectDialog from '@/components/CreateProjectDialog';
import { listProjects, createProject } from '@/lib/data-service';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

function Dashboard() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language, setLanguage } = useLanguage();

  // Use local state for now, NO FETCHING yet
  const [projects, setProjects] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  // DEBUG STATE
  const [dbStats, setDbStats] = useState({ projects: null, models: null, error: null, url: null, ping: null });

  // REAL DATA FETCHING
  useEffect(() => {
    loadProjects();
    runDatabaseProbe();
  }, [user]);

  const runDatabaseProbe = async () => {
    if (!user) return;

    // TIMEOUT WRAPPER
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout Total (3s)")), 3000)
    );

    try {
      await Promise.race([
        (async () => {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;

          if (!token) throw new Error("No Token");

          const headers = {
            'apikey': supabase.supabaseKey,
            'Authorization': `Bearer ${token}`
          };

          const start = Date.now();
          // 1. PING (HEAD request)
          const pingReq = await fetch(`${supabase.supabaseUrl}/rest/v1/`, { method: 'HEAD', headers });

          // 2. DATA
          const projectsReq = await fetch(`${supabase.supabaseUrl}/rest/v1/projects?select=*&limit=1`, { headers });
          const projectsData = await projectsReq.json();

          const modelsReq = await fetch(`${supabase.supabaseUrl}/rest/v1/models?select=*&limit=1`, { headers });
          const modelsData = await modelsReq.json();

          setDbStats({
            projects: Array.isArray(projectsData) ? `OK (${projectsData.length})` : 'ERR',
            models: Array.isArray(modelsData) ? `OK (${modelsData.length})` : 'ERR',
            error: null,
            url: supabase.supabaseUrl,
            ping: `${Date.now() - start}ms`
          });
        })(),
        timeoutPromise
      ]);

    } catch (e) {
      console.error("Probe Timeout/Error", e);
      setDbStats(prev => ({ ...prev, error: e.message, ping: "TIMEOUT" }));
    }
  };

  const forceReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  const loadProjects = async () => {
    console.log("🔄 [Dashboard] loadProjects: Iniciando...");
    setLoading(true);

    try {
      if (!isSupabaseConfigured()) {
        console.warn("⚠️ Supabase no configurado. Offline.");
        setLoading(false);
        return;
      }

      const data = await listProjects();
      console.log("✅ Datos recibidos:", data);

      if (Array.isArray(data)) {
        setProjects(data);
      } else {
        console.error("❌ Datos inválidos:", data);
        setProjects([]);
      }

    } catch (error) {
      console.error("💥 Error en loadProjects:", error);
      toast({
        title: "Error cargando proyectos",
        description: error.message,
        variant: "destructive"
      });
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(); // AuthContext redirection handles this
    } catch (error) {
      console.error("Logout failed:", error);
      // Fallback force redirect
      window.location.href = '/login';
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'en' : 'es');
  };

  const handleCreateProject = async (data) => {
    try {
      await createProject(data);
      toast({ title: "Proyecto Creado", description: "Listo para usar." });
      loadProjects();
      setShowCreateDialog(false);
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  return (
    <>
      <Helmet>
        <title>{t('dashboard.title')} - VISOR-X v1.0</title>
      </Helmet>

      <div className="min-h-screen bg-[#0B0F14]">
        {/* Header Restored */}
        <header className="border-b border-[#29B6F6]/20 bg-[#151B23]">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cube className="h-8 w-8 text-[#29B6F6]" />
                <div>
                  <h1 className="text-xl font-bold text-white">VISOR-X</h1>
                  <span className="text-[10px] text-[#29B6F6] font-mono bg-[#29B6F6]/10 px-1.5 py-0.5 rounded border border-[#29B6F6]/20">v3.12 (WEBGL-FIX)</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400 hidden sm:inline">{user?.email}</span>
                <Button onClick={handleLogout} variant="outline" size="sm" className="hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors">
                  <LogOut className="h-4 w-4 mr-2" /> {t('dashboard.logout')}
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Restored */}
        <main className="container mx-auto px-4 py-8 max-w-6xl">

          {/* SECCIÓN 1: ACCESOS RÁPIDOS (HERO) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">

            {/* CARD 1: VISOR 3D (MAIN) */}
            <div
              onClick={() => navigate('/converter')}
              className="bg-gradient-to-br from-[#1c2430] to-[#151B23] border border-[#29B6F6]/30 rounded-xl p-5 cursor-pointer hover:border-[#29B6F6] hover:shadow-[0_0_20px_rgba(41,182,246,0.15)] transition-all group lg:col-span-2 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Cube className="w-24 h-24" />
              </div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="p-2 bg-[#29B6F6]/10 w-fit rounded-lg mb-3">
                    <Cube className="w-6 h-6 text-[#29B6F6]" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">Visor 3D General</h3>
                  <p className="text-sm text-gray-400">Acceder al Toolkit completo. Visualiza, edita y convierte formatos.</p>
                </div>
                <div className="mt-4 flex items-center text-[#29B6F6] font-medium text-sm">
                  Entrar Ahora <Plus className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>

            {/* CARD 2: SUBIR ARCHIVO */}
            <div
              onClick={() => navigate('/converter')}
              className="bg-[#151B23] border border-white/10 rounded-xl p-5 cursor-pointer hover:bg-[#1c2430] hover:border-[#29B6F6]/50 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="p-2 bg-purple-500/10 w-fit rounded-lg mb-3 text-purple-400 group-hover:text-purple-300">
                  <Folder className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Subir Archivo</h3>
                <p className="text-xs text-gray-400">Soporta .ZIP, .OBJ, .FBX con texturas.</p>
              </div>
            </div>

            {/* CARD 3: LIBRERÍA */}
            <div
              onClick={() => navigate('/converter')}
              className="bg-[#151B23] border border-white/10 rounded-xl p-5 cursor-pointer hover:bg-[#1c2430] hover:border-[#10B981]/50 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="p-2 bg-emerald-500/10 w-fit rounded-lg mb-3 text-emerald-400 group-hover:text-emerald-300">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Mi Librería</h3>
                <p className="text-xs text-gray-400">Gestiona tus modelos guardados en la nube.</p>
              </div>
            </div>
          </div>


          {/* SECCIÓN 2: PROYECTOS RECIENTES */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-gray-500" /> Tus Proyectos Recientes
            </h2>
            <Button onClick={() => setShowCreateDialog(true)} variant="outline" size="sm" className="border-white/10 hover:bg-white/5 text-gray-300">
              <Plus className="w-4 h-4 mr-2" /> Nuevo Proyecto
            </Button>
          </div>

          {projects.length === 0 ? (
            // EMPTY STATE
            <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-2xl bg-white/5">
              <Cube className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-gray-400 font-medium mb-2">No hay proyectos aún</h3>
              <p className="text-gray-600 text-sm mb-6">Crea uno nuevo o usa el Visor General arriba.</p>
              <Button onClick={() => setShowCreateDialog(true)} className="bg-[#29B6F6] text-black hover:bg-[#29B6F6]/90">
                Crear Primer Proyecto
              </Button>
            </div>
          ) : (
            // GRID DE PROYECTOS
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project, index) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="bg-[#151B23] border border-[#29B6F6]/10 rounded-lg p-6 hover:border-[#29B6F6]/40 transition-all cursor-pointer group hover:bg-[#1c222b]"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-blue-500/10 rounded-md">
                      <Cube className="w-5 h-5 text-blue-400" />
                    </div>
                    {/* Status Badges */}
                    {project.status === 'error' && (
                      <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-1 rounded border border-red-500/20">ERROR</span>
                    )}
                    {project.status === 'creating' && (
                      <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded border border-yellow-500/20 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                      </span>
                    )}
                    {project.status === 'active' && (
                      <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-1 rounded border border-green-500/20">ACTIVO</span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-[#29B6F6] transition-colors">{project.name}</h3>
                  <p className="text-xs text-gray-500 font-mono mb-4">ID: {project.id.substring(0, 8)}...</p>

                  <div className="items-center text-xs text-gray-400 flex gap-4">
                    <span className="flex items-center gap-1"><InfoIcon className="w-3 h-3" /> Ver detalles</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        <CreateProjectDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSubmit={handleCreateProject}
        />


      </div>
    </>
  );
}

export default Dashboard;
