import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, AuthError } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

interface AuthContextType {
  session: Session | null;
  user: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: AuthError | null }>;
  sendOTP: (phoneNumber: string, name: string) => Promise<{ error: Error | null }>;
  verifyOTP: (phoneNumber: string, otp: string) => Promise<{ error: Error | null }>;
  setAuthenticatedUser: (userData: any) => void;
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
    let timeoutId: NodeJS.Timeout;

    // Get initial session
    const initializeAuth = async () => {
      setLoading(true);

      // Add timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        console.warn('⚠️ Auth initialization timeout - proceeding without auth');
        if (mountedRef.current) {
          setLoading(false);
          setSession(null);
          setUser(null);
        }
      }, 5000); // 5 second timeout

      try {
        // Always check Supabase session first to ensure we have a valid UUID
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
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
          setUser(session?.user ? {
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name || 'User',
            phone_number: session.user.user_metadata?.phone_number,
            role: 'customer',
            customer_id: session.user.id // Use the same UUID from Supabase auth
          } : null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setSession(null);
        setUser(null);
      }

      if (mountedRef.current) {
        clearTimeout(timeoutId);
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
          customer_id: session.user.id, // Use the same UUID from Supabase auth
          phone_number: session.user.user_metadata?.phone_number,
          role: 'customer'
        } : null);
      }
    });

    subscription = authSubscription;
    initializeAuth();

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
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
      console.log('📱 ===== SEND OTP STARTING =====');
      console.log('📱 Phone Number:', phoneNumber);
      console.log('📱 Name:', name);

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      console.log('📱 Supabase URL:', supabaseUrl);
      console.log('📱 Anon Key exists:', !!supabaseKey);

      const requestUrl = `${supabaseUrl}/functions/v1/send-otp`;
      console.log('📱 Request URL:', requestUrl);

      console.log('📱 Making fetch request...');
      const response = await fetch(requestUrl, {
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

      console.log('📱 Response status:', response.status);
      console.log('📱 Response ok:', response.ok);

      const data = await response.json();
      console.log('📱 Response data:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.error('📱 ❌ OTP send failed:', data.error);
        return { error: new Error(data.error || 'Failed to send OTP') };
      }

      console.log('📱 ✅ OTP sent successfully!');
      console.log('📱 Dev OTP:', data.devOtp);
      console.log('📱 SMS Sent:', data.smsSent);
      console.log('📱 SMS Error:', data.smsError);
      console.log('📱 ===== SEND OTP COMPLETE =====');

      return { error: null, otp: data.devOtp, smsSent: data.smsSent, smsError: data.smsError };
    } catch (error) {
      console.error('📱 ❌ Error sending OTP:', error);
      console.error('📱 Error details:', error);
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

      if (data.success && data.userId) {
        console.log('✅ User verified successfully!');
        console.log('✅ User ID (UUID) from verify-otp:', data.userId);
        console.log('✅ This UUID will be used for all database operations');

        // Now sign in the user with Supabase to get a proper session
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (signInError || !authData.user) {
          console.error('❌ Auto sign-in failed:', signInError);
          return { error: new Error('Failed to establish session') };
        }

        console.log('✅ Session established with UUID:', authData.user.id);
        console.log('✅ Session object:', authData.session);

        // Set session to persist authentication
        setSession(authData.session);

        // Set user with the UUID from the authenticated session
        setUser({
          id: authData.user.id,  // UUID from auth.users
          email: authData.user.email,
          full_name: authData.user.user_metadata?.full_name || 'User',
          phone_number: authData.user.user_metadata?.phone_number,
          role: 'customer',
          customer_id: authData.user.id  // Same UUID for consistency
        });

        console.log('✅ User data and session set with proper UUID');
      } else {
        console.error('❌ Invalid response from server');
        return { error: new Error('Authentication failed: Invalid response') };
      }

      console.log('✅ OTP verification complete');
      return { error: null };
    } catch (error) {
      console.error('❌ Error verifying OTP:', error);
      return { error: error as Error };
    }
  };

  const setAuthenticatedUser = (userData: any) => {
    console.log('✅ Setting authenticated user in context:', userData);
    setUser(userData);
  };

  const signOut = async () => {
    try {
      console.log('🚪 Starting sign out process...');

      // Clear old AsyncStorage keys (no longer used)
      await AsyncStorage.removeItem('isAuthenticated');
      await AsyncStorage.removeItem('customerId');
      await AsyncStorage.removeItem('customerName');
      await AsyncStorage.removeItem('customerPhone');

      if (Platform.OS === 'web') {
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
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Supabase sign out error:', error);
      }

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
    setAuthenticatedUser,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}