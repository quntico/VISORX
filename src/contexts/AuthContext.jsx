
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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

      if (error && error.code !== 'PGRST116') {
        console.error('[Auth] Error fetching profile:', error);
      }

      // Auto-create profile if missing
      if (!profile) {
        const newRole = sessionUser.email === 'delavega3540@gmail.com' ? 'admin' : 'user';
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([{
            id: sessionUser.id,
            email: sessionUser.email,
            role: newRole
          }])
          .select()
          .single();

        if (!insertError) {
          profile = newProfile;
        }
      }

      if (profile) {
        setRole(profile.role);
      }
    } catch (error) {
      console.error("[Auth] Unexpected error in fetchProfile:", error);
    }
  };

  useEffect(() => {
    // Check if Supabase is configured
    if (!supabase) {
      // Fallback to local mode
      const storedUser = localStorage.getItem('visorx_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        setRole(parsed.role || 'user');
      }
      setLoading(false);
      return;
    }

    // Initialize session
    const initAuth = async () => {
      try {
        // 1. Check for local dev user first
        const storedUser = localStorage.getItem('visorx_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          setRole(parsed.role || 'user');
          setLoading(false);
          return;
        }

        // 2. Manual Token Recovery (Robust Fallback)
        // If Supabase auto-detect fails, we manually process the hash
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          console.log('[Auth] Detected OAuth hash. Attempting manual session recovery...');
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken) {
            const { data: { session }, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            });

            if (!error && session?.user) {
              console.log('[Auth] Manual session recovery successful.');
              setUser(session.user);
              await fetchProfile(session.user);
              setLoading(false);

              // Clean URL and redirect
              window.location.hash = '';
              if (window.location.pathname === '/login') {
                window.location.href = '/dashboard';
              }
              return;
            }
          }
        }

        // 3. Standard Session Check
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user);
        }
      } catch (error) {
        console.error('[Auth] Init error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] State change:', event);

      if (event === 'SIGNED_IN') {
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user);
          localStorage.removeItem('visorx_mode');

          // Redirect to dashboard if on login page
          if (window.location.pathname === '/login') {
            window.location.href = '/dashboard';
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setRole(null);
      }

      // Always clear loading on state change
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!supabase) {
      toast({ title: "Demo Mode", description: "Google Auth requires Supabase connection." });
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error('[Auth] Login error:', error);
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    }
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('visorx_user');
      localStorage.removeItem('visorx_mode');

      if (supabase) {
        await supabase.auth.signOut().catch(err => console.warn("Supabase SignOut Warning:", err));
      }
    } catch (error) {
      console.error("SignOut error:", error);
    } finally {
      setUser(null);
      setRole(null);
      window.location.href = '/login';
    }
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
