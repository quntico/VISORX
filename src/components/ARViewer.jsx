
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, RotateCw, Smartphone, Tablet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

function ARViewer({ model, isPublic = false }) {
  const { toast } = useToast();
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
  }, []);

  const handleARView = () => {
    if (isIOS) {
      // iOS Quick Look
      toast({
        title: "AR Quick Look",
        description: "Opening AR experience in Quick Look...",
      });
      // In production, this would open the USDZ file
      // window.location.href = model.ios_url;
    } else {
      // Android Scene Viewer / WebXR
      toast({
        title: "AR Scene Viewer",
        description: "Opening AR experience in Scene Viewer...",
      });
      // In production, this would use Scene Viewer intent
      // const intent = `intent://arvr.google.com/scene-viewer/1.0?file=${model.file_url}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=https://developers.google.com/ar;end;`;
      // window.location.href = intent;
    }
  };

  return (
    <div className="space-y-6">
      {/* 3D Viewer */}
      <div className="bg-[#151B23] border border-[#29B6F6]/20 rounded-lg overflow-hidden">
        <div className="aspect-video bg-[#0B0F14] relative flex items-center justify-center">
          {/* Placeholder for model-viewer */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={model.thumbnail_url}
              alt={model.name}
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14]/80 to-transparent"></div>
          </div>
          
          {/* 3D Controls Overlay */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                onClick={() => toast({ title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀" })}
                variant="outline"
                size="sm"
                className="bg-[#0B0F14]/80 backdrop-blur-sm border-[#29B6F6]/20 text-gray-300 hover:bg-[#29B6F6]/10"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => toast({ title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀" })}
                variant="outline"
                size="sm"
                className="bg-[#0B0F14]/80 backdrop-blur-sm border-[#29B6F6]/20 text-gray-300 hover:bg-[#29B6F6]/10"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={handleARView}
              className="bg-[#29B6F6] hover:bg-[#29B6F6]/90 text-[#0B0F14]"
            >
              {isIOS ? <Smartphone className="h-4 w-4 mr-2" /> : <Tablet className="h-4 w-4 mr-2" />}
              View in AR
            </Button>
          </div>
        </div>

        {/* Model Info */}
        {!isPublic && (
          <div className="p-4 border-t border-[#29B6F6]/20">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400 mb-1">Format</p>
                <p className="text-white">GLB / USDZ</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">File Size</p>
                <p className="text-white">{(model.file_size / (1024 * 1024)).toFixed(1)} MB</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Created</p>
                <p className="text-white">{new Date(model.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Platform</p>
                <p className="text-white">iOS & Android</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AR Instructions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-[#29B6F6]/10 border border-[#29B6F6]/20 rounded-lg p-4"
      >
        <h3 className="text-white font-semibold mb-2">AR Instructions</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• <strong>iOS:</strong> Tap "View in AR" to open Quick Look</li>
          <li>• <strong>Android:</strong> Tap "View in AR" to launch Scene Viewer</li>
          <li>• Point your camera at a flat surface to place the model</li>
          <li>• Pinch to scale, drag to move, two fingers to rotate</li>
        </ul>
      </motion.div>
    </div>
  );
}

export default ARViewer;
