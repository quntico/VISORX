
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

  const processingHash = useRef(false);

  const logAuth = (msg) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    const log = `[${timestamp}] ${msg}`;
    console.log(log);
    try {
      const history = JSON.parse(localStorage.getItem('auth_debug_log') || '[]');
      history.unshift(log);
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
    if (!supabase) {
      const storedUser = localStorage.getItem('visorx_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        setRole(parsed.role || 'user');
      }
      setLoading(false);
      return;
    }

    const safetyTimeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          logAuth('SAFETY TIMEOUT: Forcing loading=false (8s expired)');
          return false;
        }
        return prev;
      });
    }, 8000);

    const initAuth = async () => {
      try {
        logAuth('Auth Init Started (v2.1 - Timeout Fix)');

        const storedUser = localStorage.getItem('visorx_user');
        if (storedUser) {
          logAuth('Found local dev user in localStorage');
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          setRole(parsed.role || 'user');
          setLoading(false);
          return;
        }

        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          logAuth(`Hash detected: ${hash.substring(0, 30)}...`);
          processingHash.current = true;

          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken) {
            const tokenPreview = accessToken.substring(0, 10);
            logAuth(`Extracted token: ${tokenPreview}...`);
            logAuth('Calling setSession (with 3s timeout)...');

            try {
              // Wrap setSession in a race with a timeout
              const sessionPromise = supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
              });

              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('setSession call timed out')), 3000)
              );

              const result = await Promise.race([sessionPromise, timeoutPromise]);
              const { data: { session }, error } = result;

              if (error) {
                logAuth(`setSession FAILED: ${error.message}`);
              }

              if (!error && session?.user) {
                logAuth(`setSession SUCCESS. User: ${session.user.email}`);
                setUser(session.user);
                await fetchProfile(session.user);
                setLoading(false);

                window.location.hash = '';
                if (window.location.pathname === '/login') {
                  logAuth('Redirecting to dashboard...');
                  window.location.href = '/dashboard';
                }
                processingHash.current = false;
                return;
              } else {
                logAuth('setSession returned success but NO session.');
              }
            } catch (err) {
              logAuth(`setSession EXCEPTION: ${err.message}`);
            }
          }
          processingHash.current = false;
        } else {
          logAuth('No access_token in hash.');
        }

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
        if (!processingHash.current) {
          logAuth('Setting loading = false (Init complete)');
          setLoading(false);
        } else {
          logAuth('Keeping loading = true (Hash processing logic active)');
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logAuth(`Supabase Event: ${event}`);

      if (processingHash.current && event === 'SIGNED_OUT') {
        logAuth('IGNORING SIGNED_OUT due to lock');
        return;
      }

      if (event === 'SIGNED_IN') {
        if (session?.user) {
          logAuth(`SIGNED_IN event with user: ${session.user.email}`);
          setUser(session.user);
          await fetchProfile(session.user);
          localStorage.removeItem('visorx_mode');

          if (window.location.pathname === '/login') {
            window.location.href = '/dashboard';
          }
        }
      } else if (event === 'SIGNED_OUT') {
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
