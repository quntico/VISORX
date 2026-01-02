
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
      console.log('[AuthDebug] No session user, clearing role');
      setRole(null);
      return;
    }

    console.log('[AuthDebug] Fetching profile for:', sessionUser.id);

    try {
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[AuthDebug] Error fetching profile:', error);
      }

      // Auto-create profile if missing (backwards compatibility or if trigger failed)
      if (!profile) {
        console.log('[AuthDebug] Profile missing, attempting manual creation...');
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
          console.log('[AuthDebug] Manual profile creation successful:', newProfile);
          profile = newProfile;
        } else {
          console.error('[AuthDebug] Manual profile creation failed:', insertError);
        }
      } else {
        console.log('[AuthDebug] Profile found:', profile);
      }

      if (profile) {
        setRole(profile.role);
      }
    } catch (error) {
      console.error("[AuthDebug] Unexpected error in fetchProfile:", error);
    }
  };

  useEffect(() => {
    console.log('[AuthDebug] AuthProvider initializing...');

    if (!supabase) {
      console.warn('[AuthDebug] Supabase client is NOT configured.');
      // Fallback legacy local mode
      const storedUser = localStorage.getItem('visorx_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        setRole(parsed.email === 'admin@visorx.com' ? 'admin' : 'user');
      }
      setLoading(false);
      return;
    }

    // Safety timeout to prevent infinite loading (e.g. network issues)
    const timeoutId = setTimeout(() => {
      console.warn('[AuthDebug] Auth init timed out, forcing load completion');
      setLoading(false);
    }, 8000);

    // Initial session check
    const initSession = async () => {
      try {
        console.log('[AuthDebug] Checking initial session...');

        // CHECK LOCAL FALLBACK FIRST
        const storedUser = localStorage.getItem('visorx_user');
        if (storedUser) {
          console.log('[AuthDebug] Found local dev user override');
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          setRole(parsed.role || 'user');
          setLoading(false);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();

        if (session?.user) {
          console.log('[AuthDebug] Supabase Session Found');
          setUser(session.user);
          await fetchProfile(session.user);
        } else {
          // NO SESSION? DO NOT AUTO-ACTIVATE SIMULATION MODE
          // This allows the user to see the Login Screen.
          console.log('[AuthDebug] No session found. Waiting for user action.');
          setUser(null);
          setRole(null);
        }

      } catch (error) {
        console.error("[AuthDebug] Auth check failed:", error);
        // Do not force Simulation Mode on error. Show Login screen.
        setUser(null);
        setRole(null);
        // localStorage.setItem('visorx_mode', 'simulation'); // REMOVED
      } finally {
        clearTimeout(timeoutId);
        // If we have a hash with access_token, we might be in the middle of a redirect flow.
        // Let onAuthStateChange handle the final loading state to avoid premature PrivateRoute redirection.
        if (!window.location.hash.includes('access_token')) {
          setLoading(false);
        } else {
          console.log('[AuthDebug] Auth hash detected, keeping loading true for onAuthStateChange to resolve.');
        }
      }
    };

    initSession();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // ... existing listener logic ... 
      // For simplicity, we mostly rely on initSession for the first load in this new "Simulation First" approach
      // But we should update state if real auth happens
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user);
        localStorage.removeItem('visorx_mode'); // Exit simulation mode if real login happens
      }
      setLoading(false); // Ensure loading is cleared after auth check
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const signInWithGoogle = async () => {
    console.log('[AuthDebug] signInWithGoogle triggered');

    if (!supabase) {
      toast({ title: "Demo Mode", description: "Google Auth requires Supabase connection." });
      return;
    }

    try {
      // Use origin only. Let App router handle the default forwarding to dashboard.
      const redirectUrl = window.location.origin;
      console.log('[AuthDebug] Starting OAuth flow. Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });

      if (data) console.log('[AuthDebug] OAuth data:', data);

      if (error) {
        console.error('[AuthDebug] OAuth Error:', error);
        throw error;
      }
    } catch (error) {
      console.error('[AuthDebug] Catch Block Error:', error);
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    }
  };

  const signOut = async () => {
    console.log('[AuthDebug] Signing out...');

    try {
      // always clear local state
      localStorage.removeItem('visorx_user');
      localStorage.removeItem('visorx_mode');

      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error("SignOut fatal error:", error);
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
