/**
 * Main Index - App Entry Point
 * File Path: app/index.tsx
 * 
 * Redirects users to the appropriate screen based on authentication state.
 */

import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../constants/theme';

/**
 * Main app entry point with authentication check
 */
export default function IndexScreen() {
  const { isAuthenticated, isLoading } = useAuth();

  console.log('IndexScreen - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);

  useEffect(() => {
    console.log('IndexScreen useEffect - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);
    if (!isLoading) {
      if (isAuthenticated) {
        console.log('Navigating to dashboard...');
        router.replace('/(tabs)/dashboard');
      } else {
        console.log('Navigating to welcome...');
        router.replace('/welcome');
      }
    }
  }, [isAuthenticated, isLoading]);

  // Show loading screen while checking auth state
  if (isLoading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: theme.colors.background 
      }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return null;
}