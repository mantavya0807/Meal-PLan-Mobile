import * as React from 'react';
import { Stack, router, useSegments } from "expo-router";
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';

const RootLayoutNav = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    // Wait for authentication state to load
    if (isLoading) {
      return;
    }

    const inAuthGroup = segments.includes('auth');

    // If the user is authenticated and in the auth group (e.g., login page),
    // redirect them to the dashboard.
    if (isAuthenticated && inAuthGroup) {
      router.replace('/dashboard');
    } 
    // If the user is not authenticated, redirect them to the welcome screen
    // if they are on a protected route.
    else if (!isAuthenticated) {
      const isProtectedRoute = segments.length > 0 && !inAuthGroup && segments[0] !== 'welcome';
      if (isProtectedRoute) {
        router.replace('/welcome');
      }
    }
  }, [isAuthenticated, isLoading, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
