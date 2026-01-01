
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box as Cube, Loader2 } from 'lucide-react';
import ARViewer from '@/components/ARViewer';
import { publicLinksService } from '@/lib/data-service';
import { isSupabaseConfigured } from '@/lib/supabase';

function PublicViewer() {
  const { token } = useParams();
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadModel();
  }, [token]);

  const loadModel = async () => {
    setLoading(true);

    if (!isSupabaseConfigured()) {
       // Fallback logic
        const modelId = token.replace('-public', '');
        const models = JSON.parse(localStorage.getItem('visorx_models') || '[]');
        const found = models.find(m => m.id === modelId);
        setModel(found);
        setLoading(false);
        return;
    }

    try {
      const linkData = await publicLinksService.getByToken(token);
      if (linkData && linkData.models) {
        setModel(linkData.models);
      } else {
        throw new Error("Invalid Link");
      }
    } catch (err) {
      setError("This AR link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
         <Loader2 className="h-8 w-8 text-[#29B6F6] animate-spin" />
      </div>
    );
  }

  if (error || !model) {
    return (
       <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <div className="text-center">
          <Cube className="h-16 w-16 text-gray-700 mx-auto mb-4" />
          <p className="text-red-400">{error || "Model not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{model.name} - AR View</title>
        <meta name="description" content={`View ${model.name} in augmented reality`} />
      </Helmet>

      <div className="min-h-screen bg-[#0B0F14]">
        {/* Minimal Header */}
        <header className="border-b border-[#29B6F6]/20 bg-[#151B23]">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cube className="h-6 w-6 text-[#29B6F6]" />
                <div>
                  <h1 className="text-lg font-bold text-white">{model.name}</h1>
                  <p className="text-xs text-gray-400">Powered by VISOR-X</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Viewer */}
        <main className="container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <ARViewer model={model} isPublic={true} />
          </motion.div>
        </main>
      </div>
    </>
  );
}

export default PublicViewer;
