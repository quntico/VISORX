
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, QrCode, ExternalLink, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ARViewer from '@/components/ARViewer';
import ShareDialog from '@/components/ShareDialog';
import { modelsService, publicLinksService } from '@/lib/data-service';
import { isSupabaseConfigured } from '@/lib/supabase';

function ModelView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [model, setModel] = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModel();
  }, [id]);

  const fetchModel = async () => {
    setLoading(true);
    if (!isSupabaseConfigured()) {
       // Fallback
       const models = JSON.parse(localStorage.getItem('visorx_models') || '[]');
       const found = models.find(m => m.id === id);
       setModel(found);
       setLoading(false);
       return;
    }

    try {
      const data = await modelsService.getById(id);
      setModel(data);
    } catch (error) {
      toast({ title: "Error", description: "Model not found", variant: "destructive" });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    setShowShareDialog(true);
  };

  const handleCopyLink = async () => {
    try {
        let publicToken;

        if (!isSupabaseConfigured()) {
             // Fallback
             publicToken = `${model.id}-public`;
        } else {
            // Get or create public link
             // Note: In a real app we would check if link exists first, 
             // but for MVP we might just create new one or retrieve existing.
             // We'll create a new one every time for simplicity here, or you could query.
             const linkData = await publicLinksService.create(model.id);
             publicToken = linkData.token;
        }

        const link = `${window.location.origin}/v/${publicToken}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({
          title: "Link Copied",
          description: "Public viewing link copied to clipboard",
        });

    } catch(err) {
        toast({ title: "Error", description: "Could not generate link", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#29B6F6] animate-spin" />
      </div>
    );
  }

  if (!model) return null;

  return (
    <>
      <Helmet>
        <title>{model.name} - VISOR-X v1.0</title>
        <meta name="description" content={`View ${model.name} in AR - ${model.description}`} />
      </Helmet>

      <div className="min-h-screen bg-[#0B0F14]">
        {/* Header */}
        <header className="border-b border-[#29B6F6]/20 bg-[#151B23]">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => navigate(`/project/${model.project_id}`)}
                  variant="outline"
                  className="border-[#29B6F6]/20 text-gray-300 hover:bg-[#29B6F6]/10"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-white">{model.name}</h1>
                  <p className="text-sm text-gray-400">{model.description}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  className="border-[#29B6F6]/20 text-gray-300 hover:bg-[#29B6F6]/10"
                >
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
                <Button
                  onClick={handleShare}
                  className="bg-[#29B6F6] hover:bg-[#29B6F6]/90 text-[#0B0F14]"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <ARViewer model={model} />
        </main>

        <ShareDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          model={model}
        />
      </div>
    </>
  );
}

export default ModelView;
