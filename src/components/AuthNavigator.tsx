import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function AuthNavigator({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  React.useEffect(() => {
    console.log('🔍 AuthNavigator - checking auth state:', { 
      user: !!user, 
      loading, 
      segments: segments.join('/'),
      userEmail: user?.email,
      userRole: user?.role
    });
    
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      // User is not authenticated and not on auth screen, redirect to login
      console.log('🔄 Redirecting to login - user not authenticated');
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      // User is authenticated but on auth screen, redirect to tabs
      console.log('🔄 User authenticated, checking if should redirect to tabs');
      
      // Only redirect if user has proper role and profile
      if (user.role === 'customer') {
        console.log('✅ Customer authenticated, redirecting to tabs');
        router.replace('/(tabs)');
      } else {
        console.log('⚠️ User authenticated but role not set, staying on auth');
      }
    } else if (user && !inAuthGroup) {
      console.log('✅ User authenticated and on correct screen');
    }
  }, [user, loading, segments]);

  if (loading) {
    console.log('⏳ AuthNavigator - showing loading screen');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});