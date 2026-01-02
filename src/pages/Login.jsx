
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Box as Cube, Shield, Zap, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase'; // Import supabase for diagnostics
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'; // Icons

function Login() {
  const { signInWithGoogle, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    // Check for error in URL hash (from OAuth redirect)
    const hash = window.location.hash;
    if (hash && hash.includes('error_description')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDescription = params.get('error_description');
      const errorCode = params.get('error_code');

      console.error('[AuthDebug] URL Hash Error:', errorDescription, errorCode);

      if (errorDescription) {
        toast({
          title: t('auth.errorTitle'),
          description: errorDescription.replace(/\+/g, ' '),
          variant: "destructive"
        });
      }
    }

    if (user && !loading) {
      console.log('[AuthDebug] Login page detected user, redirecting to dashboard');
      navigate('/dashboard');
    }
  }, [user, loading, navigate, toast, t]);

  const handleLoginClick = () => {
    console.log('[AuthDebug] Login button clicked');
    signInWithGoogle();
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
                <p className="text-xs text-[#29B6F6]">v1.0</p>
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
              >
                <img
                  src="https://www.google.com/favicon.ico"
                  alt="Google"
                  className="w-5 h-5 mr-3"
                />
                {t('auth.signInButton')}
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
                  // Activate Simulation Mode
                  localStorage.setItem('visorx_mode', 'simulation');
                  window.location.reload();
                }}
              >
                ⚡ Acceso Rápido (Modo Pruebas)
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

        {/* DIAGNOSTICS PANEL (New) */}
        <div className="fixed bottom-4 left-4 right-4 z-50">
          <DiagnosticsPanel />
        </div>

      </div>
    </>
  );
}

// Internal Diagnostics Component
function DiagnosticsPanel() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [sessionStatus, setSessionStatus] = React.useState('Unknown');
  const [lastError, setLastError] = React.useState(null);
  const { user, loading } = useAuth();

  const checkSession = async () => {
    setSessionStatus('Checking...');
    setLastError(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session) {
        setSessionStatus(`Active: ${data.session.user.email}`);
      } else {
        setSessionStatus('No Session Found');
      }
    } catch (e) {
      setSessionStatus('Error');
      setLastError(e.message);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-[10px] text-gray-600 hover:text-gray-400 underline w-full text-center"
      >
        Abrir Diagnóstico de Conexión
      </button>
    );
  }

  return (
    <div className="bg-black/80 border border-gray-800 p-4 rounded text-xs font-mono text-green-400 w-full max-w-2xl mx-auto backdrop-blur-md">
      <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
        <h3 className="font-bold text-white">SYSTEM DIAGNOSTICS</h3>
        <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">✕</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <strong className="text-gray-500 block mb-1">AUTH CONTEXT</strong>
          <div>User: {user ? user.email : 'NULL'}</div>
          <div>Loading: {loading ? 'YES' : 'NO'}</div>
        </div>
        <div>
          <strong className="text-gray-500 block mb-1">SUPABASE RAW</strong>
          <div className="flex items-center gap-2">
            <span>{sessionStatus}</span>
            <button onClick={checkSession} className="bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded text-white flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Check
            </button>
          </div>
          {lastError && <div className="text-red-400 mt-1">ERR: {lastError}</div>}
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-gray-800 break-all">
        <strong className="text-gray-500">CURRENT URL:</strong> {window.location.href}
      </div>
    </div>
  );
}

export default Login;
