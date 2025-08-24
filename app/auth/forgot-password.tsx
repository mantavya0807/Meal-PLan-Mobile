/**
 * Forgot Password Screen - Complete with Backend Integration
 * File Path: app/auth/forgot-password.tsx
 * 
 * Password recovery screen with email validation, backend API integration,
 * and comprehensive user feedback for the reset password flow.
 */

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { theme } from '../../constants/theme';
import { apiService } from '../../services/api';

/**
 * Component state interface
 */
interface ComponentState {
  email: string;
  isLoading: boolean;
  emailSent: boolean;
  errorMessage: string;
  countdown: number;
}

/**
 * Forgot password screen component
 */
export default function ForgotPasswordScreen() {
  const [state, setState] = useState<ComponentState>({
    email: '',
    isLoading: false,
    emailSent: false,
    errorMessage: '',
    countdown: 0,
  });

  /**
   * Updates component state
   * @param updates - Partial state updates
   */
  const updateState = (updates: Partial<ComponentState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  /**
   * Validates email format
   * @param email - Email address to validate
   * @returns Boolean indicating if email is valid
   */
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email.trim());
  };

  /**
   * Handles email input changes
   * @param value - New email value
   */
  const handleEmailChange = (value: string) => {
    updateState({ 
      email: value,
      errorMessage: '', // Clear error when user types
    });
  };

  /**
   * Starts countdown timer for resend functionality
   */
  const startCountdown = () => {
    const countdownSeconds = 60;
    updateState({ countdown: countdownSeconds });

    const timer = setInterval(() => {
      setState(prev => {
        if (prev.countdown <= 1) {
          clearInterval(timer);
          return { ...prev, countdown: 0 };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
  };

  /**
   * Handles forgot password form submission
   */
  const handleForgotPassword = async () => {
    const trimmedEmail = state.email.trim().toLowerCase();

    // Validation
    if (!trimmedEmail) {
      updateState({ errorMessage: 'Please enter your email address' });
      Alert.alert('Validation Error', 'Please enter your email address');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      updateState({ errorMessage: 'Please enter a valid email address' });
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return;
    }

    updateState({ 
      isLoading: true, 
      errorMessage: '' 
    });

    try {
      const message = await apiService.forgotPassword(trimmedEmail);
      
      updateState({ 
        emailSent: true,
        isLoading: false 
      });
      
      startCountdown();
      
      Alert.alert(
        'Email Sent',
        message || 'Password reset instructions have been sent to your email address.',
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      console.error('Forgot password error:', error);
      
      const errorMessage = error.message || 'Failed to send password reset email. Please try again.';
      
      updateState({ 
        errorMessage,
        isLoading: false 
      });
      
      Alert.alert('Error', errorMessage);
    }
  };

  /**
   * Handles resend email functionality
   */
  const handleResendEmail = async () => {
    if (state.countdown > 0 || state.isLoading) return;

    await handleForgotPassword();
  };

  /**
   * Navigates back to login screen
   */
  const handleBackToLogin = () => {
    if (state.isLoading) return;
    router.back();
  };

  /**
   * Navigates to login screen directly
   */
  const handleGoToLogin = () => {
    if (state.isLoading) return;
    router.replace('/auth/login');
  };

  /**
   * Handles different email providers
   */
  const getEmailProviderUrl = (email: string): string | null => {
    const domain = email.split('@')[1]?.toLowerCase();
    
    const providers: Record<string, string> = {
      'gmail.com': 'https://gmail.com',
      'outlook.com': 'https://outlook.com',
      'hotmail.com': 'https://outlook.com',
      'yahoo.com': 'https://mail.yahoo.com',
      'icloud.com': 'https://www.icloud.com/mail',
    };
    
    return providers[domain] || null;
  };

  const emailProvider = state.emailSent ? getEmailProviderUrl(state.email) : null;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={[theme.colors.background, theme.colors.surfaceSecondary]}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={handleBackToLogin}
              style={styles.backButton}
              disabled={state.isLoading}
            >
              <Text style={[styles.backButtonText, state.isLoading && styles.disabledText]}>
                ← Back to Login
              </Text>
            </TouchableOpacity>
            
            <View style={styles.iconContainer}>
              <View style={styles.lockIcon} />
            </View>
            
            <Text style={styles.title}>
              {state.emailSent ? 'Check Your Email' : 'Forgot Password?'}
            </Text>
            
            <Text style={styles.subtitle}>
              {state.emailSent 
                ? `We've sent password reset instructions to ${state.email}`
                : 'Enter your email address and we\'ll send you instructions to reset your password'
              }
            </Text>
          </View>

          {/* Main Content */}
          {!state.emailSent ? (
            // Email Input Form
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={[
                    styles.input,
                    state.errorMessage && styles.inputError
                  ]}
                  placeholder="Enter your email address"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={state.email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus={true}
                  editable={!state.isLoading}
                  returnKeyType="send"
                  onSubmitEditing={handleForgotPassword}
                />
                {state.errorMessage && (
                  <Text style={styles.errorText}>{state.errorMessage}</Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.resetButton, state.isLoading && styles.resetButtonDisabled]}
                onPress={handleForgotPassword}
                disabled={state.isLoading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={state.isLoading ? [theme.colors.textMuted, theme.colors.textMuted] : theme.gradients.primary}
                  style={styles.resetButtonGradient}
                >
                  {state.isLoading ? (
                    <ActivityIndicator color={theme.colors.textInverse} size="small" />
                  ) : (
                    <Text style={styles.resetButtonText}>Send Reset Instructions</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            // Email Sent Success State
            <View style={styles.successContainer}>
              <View style={styles.successCard}>
                <View style={styles.checkIcon}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
                
                <Text style={styles.successTitle}>Email Sent Successfully</Text>
                <Text style={styles.successMessage}>
                  We've sent password reset instructions to your email address. 
                  Please check your inbox and follow the instructions to reset your password.
                </Text>

                <View style={styles.emailInfo}>
                  <Text style={styles.emailInfoLabel}>Email sent to:</Text>
                  <Text style={styles.emailInfoValue}>{state.email}</Text>
                </View>

                {/* Email Provider Button */}
                {emailProvider && (
                  <TouchableOpacity
                    style={styles.emailProviderButton}
                    onPress={() => {
                      // In a real app, you might open the email provider
                      Alert.alert('Info', 'Please check your email app for the reset instructions.');
                    }}
                  >
                    <Text style={styles.emailProviderText}>Open Email App</Text>
                  </TouchableOpacity>
                )}

                {/* Resend Button */}
                <View style={styles.resendContainer}>
                  <Text style={styles.resendText}>Didn't receive the email?</Text>
                  <TouchableOpacity
                    onPress={handleResendEmail}
                    disabled={state.countdown > 0 || state.isLoading}
                    style={styles.resendButton}
                  >
                    <Text style={[
                      styles.resendButtonText,
                      (state.countdown > 0 || state.isLoading) && styles.disabledText
                    ]}>
                      {state.countdown > 0 
                        ? `Resend in ${state.countdown}s`
                        : state.isLoading 
                        ? 'Sending...'
                        : 'Resend Email'
                      }
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            {state.emailSent ? (
              <TouchableOpacity 
                onPress={handleGoToLogin} 
                disabled={state.isLoading}
                style={styles.footerButton}
              >
                <Text style={[styles.footerButtonText, state.isLoading && styles.disabledText]}>
                  Back to Login
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.helpText}>
                <Text style={styles.helpTextContent}>
                  Remember your password? 
                </Text>
                <TouchableOpacity 
                  onPress={handleGoToLogin} 
                  disabled={state.isLoading}
                >
                  <Text style={[styles.helpTextLink, state.isLoading && styles.disabledText]}>
                    Sign In
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Additional Help */}
          {state.emailSent && (
            <View style={styles.helpSection}>
              <Text style={styles.helpTitle}>Need Help?</Text>
              <Text style={styles.helpContent}>
                If you don't receive the email within a few minutes:
              </Text>
              <View style={styles.helpList}>
                <Text style={styles.helpListItem}>• Check your spam/junk folder</Text>
                <Text style={styles.helpListItem}>• Ensure the email address is correct</Text>
                <Text style={styles.helpListItem}>• Try resending after the countdown</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing['6xl'],
    paddingBottom: theme.spacing['4xl'],
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing['5xl'],
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing['2xl'],
  },
  backButtonText: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.medium,
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
  },
  lockIcon: {
    width: 60,
    height: 60,
    backgroundColor: theme.colors.primaryAlpha,
    borderRadius: theme.borderRadius.full,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  title: {
    fontSize: theme.typography.sizes['4xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.base,
    paddingHorizontal: theme.spacing.lg,
  },

  // Form
  form: {
    gap: theme.spacing['2xl'],
    marginBottom: theme.spacing['4xl'],
  },
  inputContainer: {
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textPrimary,
  },
  input: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: theme.layout.borderWidth,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textPrimary,
    ...theme.shadows.sm,
  },
  inputError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorLight,
  },
  errorText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
    fontWeight: theme.typography.weights.medium,
  },

  // Reset Button
  resetButton: {
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonGradient: {
    paddingVertical: theme.spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  resetButtonText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textInverse,
    letterSpacing: theme.typography.letterSpacing.wide,
  },

  // Success State
  successContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing['4xl'],
  },
  successCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing['3xl'],
    alignItems: 'center',
    width: '100%',
    ...theme.shadows.lg,
  },
  checkIcon: {
    width: 60,
    height: 60,
    backgroundColor: theme.colors.success,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
  },
  checkMark: {
    fontSize: theme.typography.sizes.xl,
    color: theme.colors.textInverse,
    fontWeight: theme.typography.weights.bold,
  },
  successTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.base,
    marginBottom: theme.spacing.xl,
  },
  emailInfo: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    marginBottom: theme.spacing.xl,
  },
  emailInfoLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.xs,
  },
  emailInfoValue: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textPrimary,
  },

  // Email Provider Button
  emailProviderButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing['2xl'],
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.sm,
  },
  emailProviderText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textInverse,
  },

  // Resend
  resendContainer: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  resendText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  resendButton: {
    paddingVertical: theme.spacing.sm,
  },
  resendButtonText: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.semibold,
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  footerButton: {
    paddingVertical: theme.spacing.md,
  },
  footerButtonText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.semibold,
  },
  helpText: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpTextContent: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
  },
  helpTextLink: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.semibold,
    marginLeft: theme.spacing.xs,
  },

  // Help Section
  helpSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.sm,
  },
  helpTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  helpContent: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  helpList: {
    gap: theme.spacing.xs,
  },
  helpListItem: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeights.normal * theme.typography.sizes.sm,
  },

  // Common
  disabledText: {
    opacity: 0.5,
  },
});