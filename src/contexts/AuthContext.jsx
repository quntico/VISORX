
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

  // Ref to track if we are manually processing a hash to prevent race conditions
  const processingHash = useRef(false);

  // Helper for persistent logging
  const logAuth = (msg) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    const log = `[${timestamp}] ${msg}`;
    console.log(log);
    try {
      const history = JSON.parse(localStorage.getItem('auth_debug_log') || '[]');
      history.unshift(log); // Add to top
      localStorage.setItem('auth_debug_log', JSON.stringify(history.slice(0, 50)));
    } catch (e) { console.error('Log error', e); }
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

      if (error && error.code !== 'PGRST116') {
        logAuth(`Error fetching profile: ${error.message}`);
      }

      // Auto-create profile if missing
      if (!profile) {
        logAuth('Profile missing. Creating new profile...');
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
          logAuth('Profile created successfully.');
        } else {
          logAuth(`Error creating profile: ${insertError.message}`);
        }
      }

      if (profile) {
        setRole(profile.role);
      }
    } catch (error) {
      logAuth(`Unexpected error in fetchProfile: ${error.message}`);
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

    // SAFETY VALVE: Force stop loading after 8 seconds no matter what
    const safetyTimeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          logAuth('SAFETY TIMEOUT: Forcing loading=false (8s expired)');
          return false;
        }
        return prev;
      });
    }, 8000);

    // Initialize session
    const initAuth = async () => {
      try {
        logAuth('Auth Init Started');

        // 1. Check for local dev user first
        const storedUser = localStorage.getItem('visorx_user');
        if (storedUser) {
          logAuth('Found local dev user in localStorage');
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          setRole(parsed.role || 'user');
          setLoading(false);
          return;
        }

        // 2. Manual Token Recovery (Robust Fallback)
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          logAuth('Hash detected containing access_token');
          processingHash.current = true;

          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken) {
            const { data: { session }, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            });

            if (error) {
              logAuth(`setSession FAILED: ${error.message}`);
            }

            if (!error && session?.user) {
              logAuth('Manual setSession SUCCESS. User established.');
              setUser(session.user);
              await fetchProfile(session.user);
              setLoading(false);

              // Clean URL and redirect
              window.location.hash = '';
              // Force navigation only if on login page
              if (window.location.pathname === '/login') {
                logAuth('Redirecting to dashboard from login page...');
                window.location.href = '/dashboard';
              }
              processingHash.current = false;
              return;
            }
          }
          processingHash.current = false;
        } else {
          logAuth('No access_token in hash.');
        }

        // 3. Standard Session Check (Only if manual recovery didn't finish)
        logAuth('Checking standard supabase.auth.getSession()...');
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          logAuth(`Standard getSession FOUND user: ${session.user.email}`);
          setUser(session.user);
          await fetchProfile(session.user);
        } else {
          logAuth('Standard getSession returned NO user.');
        }
      } catch (error) {
        logAuth(`Init CRITICAL ERROR: ${error.message}`);
      } finally {
        // ONLY set loading to false if we are NOT currently processing a hash
        if (!processingHash.current) {
          logAuth('Setting loading = false (Init complete)');
          setLoading(false);
        } else {
          logAuth('Keeping loading = true (Hash processing in progress)');
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logAuth(`Supabase Event: ${event}`);

      // Ignore SIGNED_OUT events if we are manually processing a token
      if (processingHash.current && event === 'SIGNED_OUT') {
        logAuth('IGNORING SIGNED_OUT event due to active hash processing lock');
        return;
      }

      if (event === 'SIGNED_IN') {
        if (session?.user) {
          logAuth(`SIGNED_IN event with user: ${session.user.email}`);
          setUser(session.user);
          await fetchProfile(session.user);
          localStorage.removeItem('visorx_mode');

          if (window.location.pathname === '/login') {
            logAuth('Redirecting to /dashboard from SIGNED_IN event');
            window.location.href = '/dashboard';
          }
        }
      } else if (event === 'SIGNED_OUT') {
        logAuth('SIGNED_OUT event processed. Clearing user state.');
        setUser(null);
        setRole(null);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const signInWithGoogle = async () => {
    logAuth('User clicked SignInWithGoogle');
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
      logAuth(`SignIn ERROR: ${error.message}`);
      console.error('[Auth] Login error:', error);
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    }
  };

  const signOut = async () => {
    logAuth('User clicked SignOut');
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
