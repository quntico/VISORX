
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode as QrCodeIcon, Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

function ShareDialog({ open, onOpenChange, model }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const publicToken = `${model.id}-public`;
  const publicUrl = `${window.location.origin}/v/${publicToken}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Link Copied",
      description: "Public viewing link copied to clipboard",
    });
  };

  const handleOpenPublic = () => {
    window.open(publicUrl, '_blank');
  };

  // Generate simple QR code data URL (placeholder - in production use a QR library)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicUrl)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#151B23] border-[#29B6F6]/20 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <QrCodeIcon className="h-5 w-5 text-[#29B6F6]" />
            Share AR Model
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg flex items-center justify-center">
            <img
              src={qrCodeUrl}
              alt="QR Code"
              className="w-48 h-48"
            />
          </div>

          {/* Public Link */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Public Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={publicUrl}
                readOnly
                className="flex-1 bg-[#0B0F14] border border-[#29B6F6]/20 rounded px-3 py-2 text-white text-sm"
              />
              <Button
                onClick={handleCopy}
                variant="outline"
                className="border-[#29B6F6]/20 text-gray-300 hover:bg-[#29B6F6]/10"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleOpenPublic}
              className="flex-1 bg-[#29B6F6] hover:bg-[#29B6F6]/90 text-[#0B0F14]"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Public View
            </Button>
          </div>

          {/* Instructions */}
          <div className="bg-[#29B6F6]/5 border border-[#29B6F6]/20 rounded p-3">
            <p className="text-xs text-gray-400">
              <strong>Sharing Options:</strong>
              <br />• Scan QR code with mobile device for instant AR access
              <br />• Copy and share the public link via email or messaging
              <br />• Links are publicly accessible without login
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ShareDialog;
