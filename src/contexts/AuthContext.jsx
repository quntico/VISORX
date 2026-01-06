
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const logAuth = (msg) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    const log = `[${timestamp}] ${msg}`;
    console.log(log);
    try {
      const history = JSON.parse(localStorage.getItem('auth_debug_log') || '[]');
      history.unshift(log);
      localStorage.setItem('auth_debug_log', JSON.stringify(history.slice(0, 50)));
    } catch (e) { }
  };

  const fetchProfile = async (sessionUser) => {
    if (!sessionUser) {
      setRole(null);
      return;
    }
    try {
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single();

      if (!profile && (!error || error.code === 'PGRST116')) {
        const newRole = sessionUser.email === 'delavega3540@gmail.com' ? 'admin' : 'user';
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert([{ id: sessionUser.id, email: sessionUser.email, role: newRole }])
          .select().single();
        if (newProfile) profile = newProfile;
      }
      if (profile) setRole(profile.role);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    const initAuth = async () => {
      logAuth('Init: v3.10 (RE-LOGIN) - Hash Protection');

      // 1. Check for OAuth Hash/Code
      const hash = window.location.hash;
      const search = window.location.search;
      const hasHash = hash.includes('access_token') || search.includes('code=');

      // 2. Race getSession against a 4s timeout
      let initialSession = null;
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Auth Timeout")), 4000)
        );
        const { data } = await Promise.race([sessionPromise, timeoutPromise]);
        initialSession = data.session;
      } catch (e) {
        logAuth(`SDK Init Error: ${e.message}`);
      }

      // 3. Evaluate Session or Force Hijack
      if (initialSession?.user) {
        logAuth(`Session Found via SDK: ${initialSession.user.email}`);
        setUser(initialSession.user);
        await fetchProfile(initialSession.user);

        if (hasHash) window.history.replaceState(null, '', window.location.pathname);
        if (window.location.pathname === '/login') window.location.replace('/dashboard');
        setLoading(false);
      } else {
        // NO SDK SESSION - CHECK FOR MANUAL HIJACK
        logAuth('SDK returned null session.');

        if (hasHash) {
          logAuth('OAuth Hash Detected! Engaging Manual Hijack...');

          const params = new URLSearchParams(hash.replace('#', ''));
          const searchParams = new URLSearchParams(search);

          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          const code = searchParams.get('code');

          if (access_token) {
            logAuth('Manual Token Found. Setting Session...');
            const { data, error } = await supabase.auth.setSession({
              access_token,
              refresh_token: refresh_token || ''
            });

            if (!error && (data.session || data.user)) {
              logAuth('Manual Session Set Success!');
              setUser(data.user || data.session.user);
              await fetchProfile(data.user || data.session.user);
              window.history.replaceState(null, '', window.location.pathname);
              setLoading(false);
              return;
            } else {
              logAuth(`Manual SetSession Failed: ${error?.message}`);
              // Fallback: Direct User Fetch
              const { data: userData } = await supabase.auth.getUser(access_token);
              if (userData?.user) {
                logAuth('Recovered User via Token (getUser)!');
                setUser(userData.user);
                await fetchProfile(userData.user);
                window.history.replaceState(null, '', window.location.pathname);
                setLoading(false);
                return;
              }
            }
          } else if (code) {
            // PKCE Code Exchange
            logAuth('PKCE Code Found. Exchanging...');
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error && data.session) {
              logAuth('PKCE Exchange Success!');
              setUser(data.session.user);
              await fetchProfile(data.session.user);
              window.history.replaceState(null, '', window.location.pathname);
              setLoading(false);
              return;
            }
          }

          // If we are here, manual hijack failed.
          logAuth('Manual Hijack Failed. Token likely invalid.');

          // NUCLEAR OPTION 2.0: Nuke Storage AND Redirect to Login (Fresh Start)
          logAuth('CRITICAL: Token Rejected. Nuking and Redirecting to Login...');
          localStorage.removeItem('visorx_user');
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-')) localStorage.removeItem(key);
          });
          // Force clean URL and fresh login
          window.location.href = '/login?error=auth_reset';

        } else {
          // No Hash, No Session -> Check Local Fallbacks
          const storedUser = localStorage.getItem('visorx_user');
          if (storedUser && (storedUser.includes('dev_user'))) {
            setUser(JSON.parse(storedUser));
          }
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logAuth(`Event: ${event}`);

      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user);

        if (loading) setLoading(false); // Unblock if waiting

        if (window.location.pathname === '/login') {
          window.location.replace('/dashboard');
        }

        // Cleanup Auto-Fix Flag if success
        sessionStorage.removeItem('visorx_auto_clean');
      } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_FAILED') {
        if (event === 'TOKEN_REFRESH_FAILED') {
          console.warn("CRITICAL: Token Refresh Failed. Nuking storage.");
          localStorage.removeItem('visorx_user');
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-')) localStorage.removeItem(key);
          });
          window.location.reload();
          return;
        }

        // Protect dev user
        const storedUser = localStorage.getItem('visorx_user');
        if (!storedUser?.includes('dev_user')) {
          setUser(null);
          setRole(null);
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // Remove dependencies to prevent re-runs

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error("Login Error:", error);
      toast({
        title: "Error al iniciar sesión",
        description: error.message || "No se pudo conectar con Google.",
        variant: "destructive"
      });
    }
  };

  const signOut = async () => {
    localStorage.removeItem('visorx_user');
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    window.location.href = '/login';
  };

  const value = {
    user,
    role,
    isAdmin: role === 'admin',
    loading,
    signInWithGoogle,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
