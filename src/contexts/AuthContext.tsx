import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, AuthError } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { supabase } from '../utils/supabase';

interface AuthContextType {
  session: Session | null;
  user: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: AuthError | null }>;
  sendOTP: (phoneNumber: string, name: string) => Promise<{ error: Error | null }>;
  verifyOTP: (phoneNumber: string, otp: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const router = useRouter();

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let subscription: any;

    // Get initial session
    const initializeAuth = async () => {
      setLoading(true);
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          // If there's an error getting the session (like invalid refresh token),
          // clear the corrupted session data
          if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('sb-')) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
          }
          setSession(null);
          setUser(null);
        } else {
          setSession(session);
          // Use session user data directly instead of fetching from database
          setUser(session?.user ? {
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name || 'User',
            phone_number: session.user.user_metadata?.phone_number,
            role: 'customer'
          } : null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setSession(null);
        setUser(null);
      }
      
      if (mountedRef.current) {
        setLoading(false);
      }
    };

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mountedRef.current) {
        setSession(session);
        // Use session user data directly
        setUser(session?.user ? {
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name || 'User',
          phone_number: session.user.user_metadata?.phone_number,
          role: 'customer'
        } : null);
      }
    });

    subscription = authSubscription;
    initializeAuth();

    return () => {
      mountedRef.current = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    console.log('🔐 Starting signup process for:', email);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone_number: phone,
        }
      }
    });

    // If signup successful, create user profile in users table
    if (data.user && !error) {
      try {
        console.log('✅ Auth user created, creating customer profile...');
        
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: data.user.email!,
            full_name: fullName,
            phone_number: phone || null,
            role: 'customer',
          });

        if (profileError) {
          // If it's a duplicate key error, the user already exists, which is fine
          if (profileError.code !== '23505') {
            console.error('Error creating customer profile:', profileError);
            throw profileError;
          } else {
            console.log('✅ Customer profile already exists, continuing...');
          }
        } else {
          console.log('✅ Customer profile created successfully');
        }
      } catch (profileError) {
        console.error('Error creating customer profile:', profileError);
        // Return the profile error so the UI can handle it
        return { error: profileError as AuthError };
      }
    }

    console.log('✅ Signup process completed successfully');
    return { error };
  };

  const sendOTP = async (phoneNumber: string, name: string) => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          phoneNumber,
          name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: new Error(data.error || 'Failed to send OTP') };
      }

      return { error: null, otp: data.devOtp };
    } catch (error) {
      console.error('Error sending OTP:', error);
      return { error: error as Error };
    }
  };

  const verifyOTP = async (phoneNumber: string, otp: string) => {
    try {
      console.log('🔐 Verifying OTP for:', phoneNumber);
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          otp,
        }),
      });

      const data = await response.json();
      console.log('📦 Verify OTP response:', data);

      if (!response.ok) {
        console.error('❌ OTP verification failed:', data.error);
        return { error: new Error(data.error || 'Failed to verify OTP') };
      }

      if (data.sessionUrl) {
        console.log('🔑 Session URL received, extracting tokens...');
        const sessionUrl = new URL(data.sessionUrl);
        const accessToken = sessionUrl.searchParams.get('access_token');
        const refreshToken = sessionUrl.searchParams.get('refresh_token');

        console.log('🔑 Access token exists:', !!accessToken);
        console.log('🔑 Refresh token exists:', !!refreshToken);

        if (accessToken && refreshToken) {
          console.log('🔐 Setting session...');
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('❌ Session error:', sessionError);
            return { error: sessionError };
          }

          console.log('✅ Session set successfully:', sessionData);
        } else {
          console.error('❌ Missing tokens in session URL');
        }
      } else {
        console.error('❌ No session URL in response');
      }

      console.log('✅ OTP verification complete');
      return { error: null };
    } catch (error) {
      console.error('❌ Error verifying OTP:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      console.log('🚪 Starting sign out process...');
      
      // Clear all Supabase-related session data from storage
      if (Platform.OS === 'web') {
        // Clear localStorage on web
        if (typeof localStorage !== 'undefined') {
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
        }
      } else {
        // For React Native, we would use AsyncStorage, but since this is web-focused
        // we'll handle it in the Supabase signOut call
      }
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Supabase sign out error:', error);
        // Even if signOut fails, clear local state to prevent stuck sessions
      }
      
      // Clear local state after Supabase sign out
      setSession(null);
      setUser(null);
      
      console.log('✅ Sign out completed, redirecting to login...');
      
      // Force navigation to login with a small delay to ensure state is cleared
      setTimeout(() => {
        router.replace('/auth/login');
      }, 100);
    } catch (error) {
      console.error('Error signing out:', error);
      // Clear state and force navigation even on error
      setSession(null);
      setUser(null);
      
      // Also clear storage on error
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }
      
      router.replace('/auth/login');
    }
  };

  const value = {
    session,
    user,
    loading,
    signIn,
    signUp,
    sendOTP,
    verifyOTP,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}