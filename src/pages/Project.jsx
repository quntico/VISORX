
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Box as Cube, Upload, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import UploadModelDialog from '@/components/UploadModelDialog';
import { projectsService, modelsService, storageService } from '@/lib/data-service';
import { isSupabaseConfigured } from '@/lib/supabase';

function Project() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState(null);
  const [models, setModels] = useState([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    
    if (!isSupabaseConfigured()) {
       // Fallback logic
       const projects = JSON.parse(localStorage.getItem('visorx_projects') || '[]');
       const foundProject = projects.find(p => p.id === id);
       
       const allModels = JSON.parse(localStorage.getItem('visorx_models') || '[]');
       const projectModels = allModels.filter(m => m.project_id === id);

       setProject(foundProject);
       setModels(projectModels);
       setLoading(false);
       return;
    }

    try {
      const [projectData, modelsData] = await Promise.all([
        projectsService.getById(id),
        modelsService.getByProject(id)
      ]);
      setProject(projectData);
      setModels(modelsData || []);
    } catch (error) {
      toast({
        title: "Error loading project",
        description: error.message,
        variant: "destructive"
      });
      // If project not found, redirect to dashboard
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadModel = async (modelData, files) => {
    if (!isSupabaseConfigured()) {
      // Local fallback
      const newModel = {
        id: `model-${Date.now()}`,
        project_id: id,
        ...modelData,
        created_at: new Date().toISOString()
      };
      
      const allModels = JSON.parse(localStorage.getItem('visorx_models') || '[]');
      allModels.push(newModel);
      localStorage.setItem('visorx_models', JSON.stringify(allModels));
      
      setModels([...models, newModel]);
      setShowUploadDialog(false);
      toast({ title: "Model Uploaded (Local)", description: "Saved to local storage" });
      return;
    }

    try {
      toast({ title: "Uploading...", description: "Please wait while we upload your files." });

      // 1. Upload Files
      let glbUrl = '', usdzUrl = '', thumbUrl = '';
      
      if (files.glb) {
        const path = `${project.user_id}/${Date.now()}_${files.glb.name}`;
        glbUrl = await storageService.uploadFile('models', path, files.glb);
      }
      
      if (files.usdz) {
        const path = `${project.user_id}/${Date.now()}_${files.usdz.name}`;
        usdzUrl = await storageService.uploadFile('models', path, files.usdz);
      }
      
      // 2. Create DB Record
      await modelsService.create({
        project_id: id,
        name: modelData.name,
        description: modelData.description,
        file_url: glbUrl,
        ios_url: usdzUrl,
        thumbnail_url: modelData.thumbnail_url || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400', // Use default if no thumb
        file_size: files.glb ? files.glb.size : 0
      });

      // 3. Refresh
      await fetchData();
      setShowUploadDialog(false);
      
      toast({
        title: "Model Uploaded",
        description: `${modelData.name} is ready for AR viewing`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#29B6F6] animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <>
      <Helmet>
        <title>{project.name} - VISOR-X v1.0</title>
        <meta name="description" content={`Manage 3D models for ${project.name}`} />
      </Helmet>

      <div className="min-h-screen bg-[#0B0F14]">
        {/* Header */}
        <header className="border-b border-[#29B6F6]/20 bg-[#151B23]">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => navigate('/dashboard')}
                  variant="outline"
                  className="border-[#29B6F6]/20 text-gray-300 hover:bg-[#29B6F6]/10"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-white">{project.name}</h1>
                  <p className="text-sm text-gray-400">{project.description}</p>
                </div>
              </div>
              <Button
                onClick={() => setShowUploadDialog(true)}
                className="bg-[#29B6F6] hover:bg-[#29B6F6]/90 text-[#0B0F14]"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Model
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">3D Models</h2>
            <p className="text-gray-400 mt-1">{models.length} model(s) in this project</p>
          </div>

          {/* Models Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {models.map((model, index) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                onClick={() => navigate(`/model/${model.id}`)}
                className="bg-[#151B23] border border-[#29B6F6]/20 rounded-lg overflow-hidden hover:border-[#29B6F6]/40 transition-all cursor-pointer group"
              >
                <div className="aspect-video bg-[#0B0F14] relative overflow-hidden flex items-center justify-center">
                  <img
                    src={model.thumbnail_url || 'https://placehold.co/400x300/151B23/29B6F6?text=No+Preview'}
                    alt={model.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => { e.target.src = 'https://placehold.co/400x300/151B23/29B6F6?text=No+Preview' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] to-transparent opacity-60"></div>
                  <div className="absolute bottom-2 right-2">
                    <div className="p-2 bg-[#29B6F6]/20 rounded backdrop-blur-sm">
                      <Cube className="h-5 w-5 text-[#29B6F6]" />
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white mb-1">{model.name}</h3>
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{model.description}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatFileSize(model.file_size)}</span>
                    <Eye className="h-4 w-4 text-[#29B6F6] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {models.length === 0 && (
            <div className="text-center py-16 bg-[#151B23]/50 rounded-lg border border-dashed border-gray-800">
              <Upload className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No models yet. Upload your first 3D model!</p>
            </div>
          )}
        </main>

        <UploadModelDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          onSubmit={handleUploadModel}
        />
      </div>
    </>
  );
}

export default Project;
