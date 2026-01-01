
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { CheckCircle, XCircle, AlertCircle, Database, Server, Settings, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

function SetupAdmin() {
  const [status, setStatus] = useState({
    connection: null,
    auth: null,
    storage: null,
    checking: false
  });

  const checkStatus = async () => {
    if (!isSupabaseConfigured()) {
        setStatus({ connection: false, auth: false, storage: false, checking: false });
        return;
    }

    setStatus(prev => ({ ...prev, checking: true }));
    const newStatus = { ...status, checking: false };

    // Check 1: Connection (Simple Query)
    try {
      // Try to select from a table that should exist, or check health
      const { error } = await supabase.from('projects').select('count', { count: 'exact', head: true });
      // If table doesn't exist yet, it might error, but connection works if we get a response
      // Postgrest error code 42P01 is "undefined_table", meaning connection is good but migrations haven't run
      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        console.error("Connection Check Error:", error);
        throw error; 
      }
      newStatus.connection = true;
    } catch (e) {
      console.error(e);
      newStatus.connection = false;
    }

    // Check 2: Auth Service
    try {
       const { data, error } = await supabase.auth.getSession();
       if (error) throw error;
       newStatus.auth = true;
    } catch (e) {
       console.error("Auth Check Error:", e);
       newStatus.auth = false;
    }

    // Check 3: Storage Bucket Access
    try {
        // Just list buckets to see if service is reachable
        const { data, error } = await supabase.storage.listBuckets();
        if (error) throw error;
        // Check specifically for 'models' bucket
        const hasModelsBucket = data.some(b => b.name === 'models');
        newStatus.storage = hasModelsBucket ? true : 'warning'; // Warning if connected but bucket missing
    } catch(e) {
        console.error("Storage Check Error:", e);
        newStatus.storage = false;
    }

    setStatus(newStatus);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <>
      <Helmet>
        <title>Setup Admin - VISOR-X</title>
      </Helmet>
      
      <div className="min-h-screen bg-[#0B0F14] text-white p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-8 border-b border-[#29B6F6]/20 pb-4">
            <Settings className="h-8 w-8 text-[#29B6F6]" />
            <h1 className="text-2xl font-bold">System Status</h1>
          </div>

          <div className="grid gap-6">
             {/* Configuration Status */}
             <div className="bg-[#151B23] p-6 rounded-lg border border-[#29B6F6]/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Server className="text-[#29B6F6]" />
                        <h2 className="text-lg font-semibold">Environment Config</h2>
                    </div>
                    {isSupabaseConfigured() ? (
                        <span className="text-green-400 flex items-center gap-1"><CheckCircle className="h-4 w-4"/> Configured</span>
                    ) : (
                        <span className="text-red-400 flex items-center gap-1"><XCircle className="h-4 w-4"/> Missing Config</span>
                    )}
                </div>
                <div className="text-sm text-gray-400">
                    <p>Client initialized via integrated setup.</p>
                </div>
             </div>

             {/* Connection Tests */}
             <div className="bg-[#151B23] p-6 rounded-lg border border-[#29B6F6]/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Database className="text-[#29B6F6]" />
                        <h2 className="text-lg font-semibold">Service Health</h2>
                    </div>
                    <Button 
                      onClick={checkStatus} 
                      size="sm" 
                      variant="outline" 
                      className="border-[#29B6F6] text-[#29B6F6] hover:bg-[#29B6F6]/10"
                      disabled={status.checking}
                    >
                        {status.checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run Diagnostics"}
                    </Button>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-[#0B0F14] rounded">
                        <span>Database Connection</span>
                        {status.connection === null ? <span className="text-gray-500">-</span> : 
                         status.connection ? <CheckCircle className="text-green-500 h-5 w-5"/> : <XCircle className="text-red-500 h-5 w-5"/>}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[#0B0F14] rounded">
                        <span>Auth Service</span>
                        {status.auth === null ? <span className="text-gray-500">-</span> : 
                         status.auth ? <CheckCircle className="text-green-500 h-5 w-5"/> : <XCircle className="text-red-500 h-5 w-5"/>}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[#0B0F14] rounded">
                        <span>Storage (Bucket: models)</span>
                        {status.storage === null ? <span className="text-gray-500">-</span> : 
                         status.storage === true ? <CheckCircle className="text-green-500 h-5 w-5"/> : 
                         status.storage === 'warning' ? <span className="text-yellow-500 flex items-center gap-1"><AlertCircle className="h-5 w-5"/> Bucket Missing</span> :
                         <XCircle className="text-red-500 h-5 w-5"/>}
                    </div>
                </div>
             </div>

             <div className="bg-[#29B6F6]/10 p-4 rounded border border-[#29B6F6]/20 text-sm text-[#29B6F6]">
                <div className="flex items-center gap-2 mb-2 font-bold">
                    <AlertCircle className="h-4 w-4" />
                    Action Required
                </div>
                <p>If "Database Connection" is red, please ensure migrations have run.</p>
                <p>If "Storage" shows "Bucket Missing", you need to create 'models' bucket in Supabase dashboard.</p>
             </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SetupAdmin;
