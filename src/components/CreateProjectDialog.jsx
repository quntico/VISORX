
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Folder } from 'lucide-react';

function CreateProjectDialog({ open, onOpenChange, onSubmit }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit({ name, description });
      setName('');
      setDescription('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#151B23] border-[#29B6F6]/20 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Folder className="h-5 w-5 text-[#29B6F6]" />
            Create New Project
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0B0F14] border border-[#29B6F6]/20 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#29B6F6] transition-colors"
              placeholder="e.g., Furniture Collection"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0B0F14] border border-[#29B6F6]/20 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#29B6F6] transition-colors resize-none"
              placeholder="Brief description of your project"
              rows={3}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="border-[#29B6F6]/20 text-gray-300 hover:bg-[#29B6F6]/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#29B6F6] hover:bg-[#29B6F6]/90 text-[#0B0F14]"
            >
              Create Project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateProjectDialog;
