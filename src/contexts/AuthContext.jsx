
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

    // Initial session check
    const initSession = async () => {
      try {
        console.log('[AuthDebug] Checking initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
           console.error('[AuthDebug] Error getting session:', error);
           throw error;
        }

        console.log('[AuthDebug] Initial Session:', session ? 'Found' : 'None');
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user);
        }
      } catch (error) {
        console.error("[AuthDebug] Auth check failed:", error);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AuthDebug] Auth Event: ${event}`);
      
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        await fetchProfile(currentUser);
      } else {
        setRole(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    console.log('[AuthDebug] signInWithGoogle triggered');
    
    if (!supabase) {
      toast({ title: "Demo Mode", description: "Google Auth requires Supabase connection." });
      return;
    }

    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
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
    if (!supabase) {
      localStorage.removeItem('visorx_user');
      setUser(null);
      setRole(null);
    } else {
      await supabase.auth.signOut();
    }
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
