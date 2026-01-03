
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Box as Cube, Shield, Zap, Info, AlertCircle, RefreshCw, Terminal, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';

function Login() {
  const { signInWithGoogle, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  useEffect(() => {
    // Check for OAuth errors in URL
    const hash = window.location.hash;
    if (hash && hash.includes('error_description')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDescription = params.get('error_description');
      toast({
        title: t('auth.errorTitle'),
        description: errorDescription?.replace(/\+/g, ' ') || 'Authentication error',
        variant: "destructive"
      });
      setIsLoggingIn(false);
    }

    // Redirect if user is logged in
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate, toast, t]);

  const handleLoginClick = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setIsLoggingIn(false);
      toast({
        title: "Error",
        description: "No se pudo iniciar sesión. Por favor intenta de nuevo.",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Login - VISOR-X</title>
        <meta name="description" content="Sign in to VISOR-X" />
      </Helmet>

      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Grid */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full" style={{
            backgroundImage: 'linear-gradient(#29B6F6 1px, transparent 1px), linear-gradient(90deg, #29B6F6 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="bg-[#151B23] border border-[#29B6F6]/20 rounded-lg p-8 shadow-2xl">
            {/* Logo */}
            <div className="flex items-center justify-center mb-8">
              <div className="relative">
                <Cube className="h-12 w-12 text-[#29B6F6]" strokeWidth={1.5} />
                <div className="absolute inset-0 bg-[#29B6F6] blur-xl opacity-30"></div>
              </div>
              <div className="ml-3">
                <h1 className="text-2xl font-bold text-white">VISOR-X</h1>
                <p className="text-xs text-[#29B6F6]">v3.0-FB</p>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-[#0B0F14] border border-[#29B6F6]/10 rounded p-3 text-center">
                <Shield className="h-5 w-5 text-[#29B6F6] mx-auto mb-1" />
                <p className="text-xs text-gray-400">Secure</p>
              </div>
              <div className="bg-[#0B0F14] border border-[#29B6F6]/10 rounded p-3 text-center">
                <Cube className="h-5 w-5 text-[#29B6F6] mx-auto mb-1" />
                <p className="text-xs text-gray-400">AR Ready</p>
              </div>
              <div className="bg-[#0B0F14] border border-[#29B6F6]/10 rounded p-3 text-center">
                <Zap className="h-5 w-5 text-[#29B6F6] mx-auto mb-1" />
                <p className="text-xs text-gray-400">Fast</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white mb-2">{t('auth.loginTitle')}</h2>
                <p className="text-sm text-gray-400">{t('auth.loginSubtitle')}</p>
              </div>

              <Button
                className="w-full bg-white text-gray-900 hover:bg-gray-100 font-semibold h-12"
                onClick={handleLoginClick}
                disabled={isLoggingIn}
              >
                <img
                  src="https://www.google.com/favicon.ico"
                  alt="Google"
                  className="w-5 h-5 mr-3"
                />
                {isLoggingIn ? 'Iniciando...' : t('auth.signInButton')}
              </Button>

              {/* Dev Bypass Button */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#151B23] px-2 text-gray-500">Dev Options</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10 h-10 text-xs"
                onClick={() => {
                  localStorage.setItem('visorx_mode', 'simulation');
                  localStorage.setItem('visorx_user', JSON.stringify({
                    id: 'dev_user',
                    email: 'demo@visorx.com',
                    role: 'admin',
                    app_metadata: {},
                    user_metadata: { full_name: 'Evaluador' }
                  }));
                  window.location.reload();
                }}
              >
                ⚡ Acceso Rápido (Bypass Login)
              </Button>

              <div className="bg-[#29B6F6]/10 border border-[#29B6F6]/20 rounded p-3 flex items-start gap-3">
                <Info className="h-5 w-5 text-[#29B6F6] shrink-0 mt-0.5" />
                <p className="text-xs text-[#29B6F6] leading-relaxed">
                  Admin access is granted automatically for authorized emails.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Diagnostics Panel - Persistent */}
        <div className="fixed bottom-4 left-4 right-4 z-50">
          <DiagnosticsPanel />
        </div>
      </div>
    </>
  );
}

// Diagnostics Component
function DiagnosticsPanel() {
  // Always verify localStorage for default open state to catch redirect loops
  const [isOpen, setIsOpen] = useState(() => localStorage.getItem('debug_panel_open') === 'true');
  const [sessionStatus, setSessionStatus] = useState('Unknown');
  const [logs, setLogs] = useState([]);
  const { user, loading } = useAuth();

  const toggleOpen = (state) => {
    setIsOpen(state);
    localStorage.setItem('debug_panel_open', state);
  };

  // Poll for logs every 500ms
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      try {
        const history = JSON.parse(localStorage.getItem('auth_debug_log') || '[]');
        setLogs(history);
      } catch (e) { }
    }, 500);
    return () => clearInterval(interval);
  }, [isOpen]);

  const checkSession = async () => {
    setSessionStatus('Checking...');
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session) {
        setSessionStatus(`Active: ${data.session.user.email}`);
      } else {
        setSessionStatus('No Session Found');
      }
    } catch (e) {
      setSessionStatus(`Err: ${e.message}`);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => toggleOpen(true)}
        className="text-[10px] text-gray-600 hover:text-gray-400 underline w-full text-center"
      >
        Abrir Diagnóstico de Conexión
      </button>
    );
  }

  return (
    <div className="bg-black/90 border border-gray-800 p-4 rounded-lg text-xs font-mono text-green-400 w-full max-w-4xl mx-auto backdrop-blur-md shadow-2xl h-80 flex flex-col">
      <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2 shrink-0">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          AUTH FLIGHT RECORDER
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              localStorage.removeItem('auth_debug_log');
              setLogs([]);
            }}
            className="text-gray-500 hover:text-red-400"
            title="Clear Logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => toggleOpen(false)} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0 mb-2">
        <div>
          <strong className="text-gray-500 block mb-1">STATE</strong>
          <div className="flex gap-4">
            <span>User: <span className={user ? "text-green-400" : "text-yellow-500"}>{user ? 'LOGGED_IN' : 'NULL'}</span></span>
            <span>Loading: <span className={loading ? "text-blue-400" : "text-gray-500"}>{loading ? 'TRUE' : 'FALSE'}</span></span>
          </div>
        </div>
        <div>
          <button onClick={checkSession} className="bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-white flex items-center gap-1 text-[10px] border border-gray-600">
            <RefreshCw className="w-3 h-3" /> Check Raw Supabase Session
          </button>
          <div className="mt-1 text-gray-400">{sessionStatus}</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-black/50 p-2 rounded border border-gray-800 font-mono text-[10px] leading-tight space-y-1">
        {logs.length === 0 && <div className="text-gray-600 italic">Waiting for events...</div>}
        {logs.map((log, i) => (
          <div key={i} className="border-b border-white/5 pb-0.5 whitespace-pre-wrap break-all">
            {log}
          </div>
        ))}
      </div>

      <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
        <span>{window.location.href}</span>
        <button
          onClick={() => { localStorage.clear(); window.location.reload(); }}
          className="text-red-500 hover:underline"
        >
          Nuke LocalStorage & Reload
        </button>
      </div>
    </div>
  );
}

export default Login;
