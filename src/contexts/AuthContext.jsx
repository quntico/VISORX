
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
      logAuth('Init: v5.0 - Hash Protection');

      // Check for OAuth Hash/Code
      const hasHash = window.location.hash.includes('access_token') ||
        window.location.search.includes('code=');

      try {
        // Race getSession against a 4s timeout to prevent infinite loading
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Auth Timeout")), 4000)
        );

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

        if (session?.user) {
          logAuth(`Session Found: ${session.user.email}`);
          setUser(session.user);
          await fetchProfile(session.user);

          // Clear hash safely
          if (hasHash) {
            window.history.replaceState(null, '', window.location.pathname);
          }

          // Redirect if on login
          if (window.location.pathname === '/login') {
            window.location.replace('/dashboard');
          }

          // Safe to stop loading
          setLoading(false);
        } else {
          // NO SESSION FOUND
          logAuth('No active session.');

          if (hasHash) {
            logAuth('OAuth detected! Attempting manual extraction...');

            // MANUAL HASH PARSING
            const hash = window.location.hash;
            const params = new URLSearchParams(hash.replace('#', ''));
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');

            if (access_token && refresh_token) {
              logAuth('Manual Token Found. Forcing Session...');
              const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });

              if (!error && data.session) {
                logAuth('Manual Session Set Success!');
                setUser(data.session.user);
                await fetchProfile(data.session.user);
                window.history.replaceState(null, '', window.location.pathname); // Clear hash
                setLoading(false);
                return; // Done
              }
            }

            // Fallback: Wait for event if manual parsing failed (or if it was a 'code=' flow)
            setTimeout(() => {
              logAuth('Hash Wait Timeout. Forcing load finish.');
              setLoading((prev) => {
                if (prev) return false;
                return prev;
              });
            }, 6000);
          } else {
            // Check local storage fallbacks (Dev User)
            const storedUser = localStorage.getItem('visorx_user');
            if (storedUser && (storedUser.includes('dev_user') || storedUser.includes('sim_user'))) {
              const parsed = JSON.parse(storedUser);
              setUser(parsed);
              setRole(parsed.role || 'user');
            }
            setLoading(false);
          }
        }
      } catch (e) {
        logAuth(`Init Error: ${e.message}`);
        setLoading(false);
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
      } else if (event === 'SIGNED_OUT') {
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
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    });
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
