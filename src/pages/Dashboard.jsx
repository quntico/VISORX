
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Box as Cube, LogOut, Folder, Eye, Loader2, ShieldCheck, Settings, Image as ImageIcon, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import CreateProjectDialog from '@/components/CreateProjectDialog';
import { projectsService } from '@/lib/data-service';
import { isSupabaseConfigured } from '@/lib/supabase';

function Dashboard() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language, setLanguage } = useLanguage();
  const [projects, setProjects] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, [user]);

  const loadProjects = async () => {
    setLoading(true);
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      const stored = localStorage.getItem('visorx_projects');
      if (stored) {
        setProjects(JSON.parse(stored));
      } else {
        setProjects([]);
      }
      setLoading(false);
      return;
    }

    try {
      const data = await projectsService.getAll();
      setProjects(data || []);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (projectData) => {
    if (!isSupabaseConfigured()) {
      // Fallback
      const newProject = {
        id: `project-${Date.now()}`,
        ...projectData,
        created_at: new Date().toISOString(),
        model_count: 0
      };
      const updated = [...projects, newProject];
      localStorage.setItem('visorx_projects', JSON.stringify(updated));
      setProjects(updated);
      setShowCreateDialog(false);
      toast({ title: t('common.success'), description: `${projectData.name} ready.` });
      return;
    }

    try {
      await projectsService.create(projectData);
      await loadProjects();
      setShowCreateDialog(false);
      toast({
        title: t('common.success'),
        description: `${projectData.name} ready.`,
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'en' : 'es');
  };

  return (
    <>
      <Helmet>
        <title>{t('dashboard.title')} - VISOR-X v1.0</title>
        <meta name="description" content="Manage your AR projects and 3D models with VISOR-X dashboard" />
      </Helmet>

      <div className="min-h-screen bg-[#0B0F14]">
        {/* Header */}
        <header className="border-b border-[#29B6F6]/20 bg-[#151B23]">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cube className="h-8 w-8 text-[#29B6F6]" />
                <div>
                  <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    VISOR-X
                    {role === 'admin' && (
                      <span className="bg-[#29B6F6] text-[#0B0F14] text-[10px] px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Admin
                      </span>
                    )}
                  </h1>
                  <p className="text-xs text-gray-400">AR Model Viewer</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400 hidden sm:inline">{user?.email}</span>

                <Button
                  onClick={toggleLanguage}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white mr-2"
                  title={t('common.language')}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  {language.toUpperCase()}
                </Button>

                {role === 'admin' && (
                  <Button
                    onClick={() => navigate('/setup')}
                    variant="outline"
                    className="border-[#29B6F6]/20 text-gray-300 hover:bg-[#29B6F6]/10 h-9 px-3"
                    title={t('dashboard.systemStatus')}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  onClick={() => navigate('/converter')}
                  variant="outline"
                  className="border-[#29B6F6]/20 text-[#29B6F6] hover:bg-[#29B6F6]/10 mr-2"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  {t('dashboard.converter')}
                </Button>

                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="border-[#29B6F6]/20 text-gray-300 hover:bg-[#29B6F6]/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('dashboard.logout')}
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white">{t('dashboard.projects')}</h2>
              <p className="text-gray-400 mt-1">{t('dashboard.subtitle')}</p>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-[#29B6F6] hover:bg-[#29B6F6]/90 text-[#0B0F14]"
            >
              <Plus className="h-5 w-5 mr-2" />
              {t('dashboard.newProject')}
            </Button>
          </div>

          {!isSupabaseConfigured() && (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-200 text-sm">
              ⚠️ Supabase not connected. Running in Local Storage Mode. Data will not persist across devices. See /setup page.
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 text-[#29B6F6] animate-spin" />
            </div>
          ) : (
            /* Projects Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="bg-[#151B23] border border-[#29B6F6]/20 rounded-lg p-6 hover:border-[#29B6F6]/40 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-[#29B6F6]/10 rounded-lg group-hover:bg-[#29B6F6]/20 transition-colors">
                      <Folder className="h-6 w-6 text-[#29B6F6]" />
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{project.name}</h3>
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{project.description || "No description provided."}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{t('common.view')}</span>
                    <Eye className="h-4 w-4 text-[#29B6F6] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="text-center py-16 bg-[#151B23]/50 rounded-lg border border-dashed border-gray-800">
              <Folder className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">{t('dashboard.noProjects')}</p>
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
