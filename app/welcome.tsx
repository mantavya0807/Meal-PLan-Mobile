/**
 * Welcome Screen - Modern themed entry point
 * File Path: app/welcome.tsx
 * 
 * Sophisticated welcome screen using the centralized theme system.
 * Features modern gradients, typography, and component styling.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { theme } from '../constants/theme';

/**
 * Modern welcome screen with sophisticated theming
 */
export default function WelcomeScreen() {
  /**
   * Navigate to user registration screen
   */
  const handleGetStarted = () => {
    router.push('/auth/register');
  };

  /**
   * Navigate to user login screen
   */
  const handleSignIn = () => {
    router.push('/auth/login');
  };

  return (
    <LinearGradient
      colors={[theme.colors.background, theme.colors.surfaceSecondary]}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <View style={styles.icon} />
          </View>
          
          <Text style={styles.title}>Meal Plan Manager</Text>
          <Text style={styles.subtitle}>
            Take control of your dining experience with real-time balance tracking, 
            spending insights, and smart notifications.
          </Text>
        </View>
        
        {/* Action Buttons */}
        <View style={styles.buttonSection}>
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={theme.gradients.primary}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={handleSignIn}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Already have an account?</Text>
          </TouchableOpacity>
        </View>
        
        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.disclaimer}>
            Unofficial app for Penn State students
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: theme.layout.screenPadding,
    paddingVertical: theme.spacing['5xl'],
  },
  
  // Hero Section
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  iconContainer: {
    marginBottom: theme.spacing['4xl'],
  },
  icon: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius['3xl'],
    ...theme.shadows.lg,
  },
  title: {
    fontSize: theme.typography.sizes['4xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.normal,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  
  // Button Section
  buttonSection: {
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  primaryButton: {
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  primaryButtonGradient: {
    paddingVertical: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing['3xl'],
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textInverse,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: theme.layout.borderWidth,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing['3xl'],
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  secondaryButtonText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.accent,
  },
  
  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
  },
  disclaimer: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.normal,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});