/**
 * Penn State Account Linking Screen - Updated with Push Notification Flow
 * File Path: app/link-penn-state.tsx
 * 
 * Screen for securely linking Penn State meal plan credentials.
 * Handles Penn State login with Microsoft Authenticator push notifications and 2-digit number matching.
 */

import React, { useState, useEffect } from 'react';
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
  Platform,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { theme } from '../constants/theme';
import { apiService } from '../services/api';

/**
 * Interface for form validation errors
 */
interface FormErrors {
  email?: string;
  password?: string;
}

/**
 * Authentication flow states
 */
type AuthState = 'credentials' | 'push_notification' | 'success';

/**
 * Penn State account linking screen component
 */
export default function LinkPennStateScreen() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authState, setAuthState] = useState<AuthState>('credentials');
  const [statusMessage, setStatusMessage] = useState('');
  const [numberMatchCode, setNumberMatchCode] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [pushApprovalTimer, setPushApprovalTimer] = useState<number | null>(null);

  /**
   * Updates form data for a specific field
   */
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  /**
   * Validates credential form data
   */
  const validateCredentials = (): FormErrors => {
    const newErrors: FormErrors = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Penn State email is required';
    } else if (!formData.email.toLowerCase().includes('@psu.edu') && !formData.email.match(/^[a-zA-Z0-9]+$/)) {
      newErrors.email = 'Please enter a valid Penn State email or username';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 1) {
      newErrors.password = 'Password cannot be empty';
    }

    return newErrors;
  };

  /**
   * Polls backend to check if push notification was approved
   */
  const checkPushApproval = async (): Promise<void> => {
    try {
      if (!sessionId) {
        console.error('No session ID available for push approval check');
        return;
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/penn-state/check-approval?sessionId=${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await apiService.getToken() || ''}`,
        },
      });

      const result = await response.json();

      if (result.success && result.data?.approved) {
        // Push notification approved - authentication successful
        console.log('Push notification approved');
        setAuthState('success');
        setStatusMessage('Authentication successful! Redirecting...');
        
        // Clear the polling timer
        if (pushApprovalTimer) {
          clearTimeout(pushApprovalTimer);
          setPushApprovalTimer(null);
        }
        
        // Auto-redirect after a brief success message
        setTimeout(() => {
          router.back();
        }, 1500); // 1.5 second delay to show success message

      } else if (!result.success) {
        // Error or denied
        console.log('Push approval check failed:', result.message);
        
        // Clear the polling timer
        if (pushApprovalTimer) {
          clearTimeout(pushApprovalTimer);
          setPushApprovalTimer(null);
        }
        
        setStatusMessage('');
        setIsLoading(false);
        
        Alert.alert(
          'Authentication Failed',
          result.message || 'Push notification was denied or timed out. Please try again.',
          [
            {
              text: 'Try Again',
              onPress: () => {
                setAuthState('credentials');
                setNumberMatchCode('');
              },
            },
          ]
        );
      } else {
        // Still waiting - continue polling
        console.log('Still waiting for push approval');
        const timer = setTimeout(checkPushApproval, 3000); // Poll every 3 seconds
        setPushApprovalTimer(timer);
      }

    } catch (error: any) {
      console.error('Error checking push approval:', error);
      
      // Clear the polling timer
      if (pushApprovalTimer) {
        clearTimeout(pushApprovalTimer);
        setPushApprovalTimer(null);
      }
      
      setStatusMessage('');
      setIsLoading(false);
      
      Alert.alert(
        'Connection Error',
        'Unable to check authentication status. Please try again.'
      );
    }
  };

  /**
   * Starts polling for push notification approval
   */
  const startPushApprovalPolling = (): void => {
    console.log('Starting push approval polling');
    const timer = setTimeout(checkPushApproval, 2000); // Start checking after 2 seconds
    setPushApprovalTimer(timer);
  };

  /**
   * Handles Penn State credential submission
   */
  const handleSubmitCredentials = async () => {
    // Validate credentials
    const formErrors = validateCredentials();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      Alert.alert('Validation Error', Object.values(formErrors)[0]);
      return;
    }

    setIsLoading(true);
    setErrors({});
    setStatusMessage('Connecting to Penn State...');

    try {
      console.log('Submitting Penn State credentials...');
      
      // Call backend API to initiate Penn State login
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/penn-state/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await apiService.getToken() || ''}`,
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Account linked successfully without 2FA
        setAuthState('success');
        setStatusMessage('Account linked successfully!');
        setIsLoading(false);
        
        Alert.alert(
          'Account Linked Successfully',
          'Your Penn State meal plan is now connected.',
          [
            {
              text: 'Continue',
              onPress: () => {
                router.back();
              },
            },
          ]
        );

      } else if (result.data?.requiresMFA) {
        // Push notification 2FA required
        console.log('Push notification 2FA required');
        
        const matchCode = result.data.numberMatchCode;
        const sessionIdFromResponse = result.data.sessionId;
        
        setNumberMatchCode(matchCode || '');
        setSessionId(sessionIdFromResponse || '');
        setAuthState('push_notification');
        setStatusMessage('Check your Microsoft Authenticator app');
        
        // Start polling for approval
        startPushApprovalPolling();
        
      } else {
        // Login failed
        console.log('Penn State login failed:', result.message);
        setStatusMessage('');
        setIsLoading(false);
        
        Alert.alert(
          'Connection Failed',
          result.message || 'We could not verify your Penn State credentials. Please check your information and try again.'
        );
      }

    } catch (error: any) {
      console.error('Penn State credential submission error:', error);
      setStatusMessage('');
      setIsLoading(false);
      
      Alert.alert(
        'Connection Error',
        'Unable to connect to Penn State services. Please try again later.'
      );
    }
  };

  /**
   * Resets form to initial state and clears timers
   */
  const handleStartOver = () => {
    // Clear any active polling timer
    if (pushApprovalTimer) {
      clearTimeout(pushApprovalTimer);
      setPushApprovalTimer(null);
    }
    
    setAuthState('credentials');
    setFormData({ email: '', password: '' });
    setErrors({});
    setStatusMessage('');
    setNumberMatchCode('');
    setSessionId('');
    setIsLoading(false);
    setIsLoading(false);
  };

  /**
   * Navigates back to dashboard
   */
  const handleGoBack = () => {
    if (isLoading) return;
    
    // Clear any active polling timer
    if (pushApprovalTimer) {
      clearTimeout(pushApprovalTimer);
      setPushApprovalTimer(null);
    }
    
    router.back();
  };

  /**
   * Cleanup effect to clear timers when component unmounts
   */
  useEffect(() => {
    return () => {
      if (pushApprovalTimer) {
        clearTimeout(pushApprovalTimer);
      }
    };
  }, [pushApprovalTimer]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={handleGoBack}
              style={styles.backButton}
              disabled={isLoading}
            >
              <Text style={[styles.backButtonText, isLoading && styles.disabledText]}>
                ← Back
              </Text>
            </TouchableOpacity>
            
            <View style={styles.iconContainer}>
              <View style={styles.pennStateIcon}>
                <Text style={styles.iconText}>🎓</Text>
              </View>
            </View>
            
            <Text style={styles.title}>Link Penn State Account</Text>
            <Text style={styles.subtitle}>
              Connect your Penn State meal plan to start tracking your dining balance and transactions.
            </Text>
          </View>

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <View style={styles.securityHeader}>
              <Text style={styles.securityIcon}>🔒</Text>
              <Text style={styles.securityTitle}>Your Privacy is Protected</Text>
            </View>
            <Text style={styles.securityDescription}>
              Your Penn State credentials are encrypted and stored securely. We only access your meal plan data and never store your password in plain text.
            </Text>
          </View>

          {/* Form - Conditional rendering based on auth state */}
          {authState === 'credentials' && (
            <View style={styles.form}>
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Penn State Email</Text>
                <TextInput
                  style={[
                    styles.input,
                    errors.email && styles.inputError
                  ]}
                  placeholder="your.email@psu.edu"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={formData.email}
                  onChangeText={(value) => handleInputChange('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  maxLength={255}
                />
                {errors.email && (
                  <Text style={styles.errorText}>{errors.email}</Text>
                )}
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Penn State Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.passwordInput,
                      errors.password && styles.inputError
                    ]}
                    placeholder="Your Penn State account password"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={formData.password}
                    onChangeText={(value) => handleInputChange('password', value)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                    maxLength={128}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                {errors.password && (
                  <Text style={styles.errorText}>{errors.password}</Text>
                )}
              </View>

              {/* Important Notice */}
              <View style={styles.importantNotice}>
                <Text style={styles.noticeTitle}>Important</Text>
                <Text style={styles.noticeText}>
                  • Use the same credentials you use for Penn State's official portal{'\n'}
                  • This is NOT your Canvas or LionPATH password{'\n'}
                  • You will need your Microsoft Authenticator app for 2FA
                </Text>
              </View>
            </View>
          )}

          {authState === 'push_notification' && (
            <View style={styles.form}>
              {/* Push Notification Instructions */}
              <View style={styles.pushNotificationContainer}>
                <View style={styles.pushNotificationIcon}>
                  <Text style={styles.pushNotificationIconText}>📱</Text>
                </View>
                
                <Text style={styles.pushNotificationTitle}>Approve Sign-In Request</Text>
                
                <Text style={styles.pushNotificationDescription}>
                  Check your Microsoft Authenticator app and approve the sign-in request for your Penn State account.
                </Text>

                {/* Number Match Code Display */}
                {numberMatchCode && (
                  <View style={styles.numberMatchContainer}>
                    <Text style={styles.numberMatchLabel}>Match this number:</Text>
                    <View style={styles.numberMatchCodeBox}>
                      <Text style={styles.numberMatchCode}>{numberMatchCode}</Text>
                    </View>
                    <Text style={styles.numberMatchInstructions}>
                      Select "Yes" if this number appears in your Microsoft Authenticator app.
                    </Text>
                  </View>
                )}

                {/* Instructions */}
                <View style={styles.pushInstructions}>
                  <Text style={styles.pushInstructionsTitle}>Steps:</Text>
                  <Text style={styles.pushInstructionsText}>
                    1. Open Microsoft Authenticator app{'\n'}
                    2. Look for Penn State sign-in notification{'\n'}
                    {numberMatchCode && `3. Verify the number matches: ${numberMatchCode}\n`}
                    {numberMatchCode ? '4. Tap "Yes" to approve' : '3. Tap "Yes" to approve'}
                  </Text>
                </View>

                {/* Status with Loading */}
                <View style={styles.statusContainer}>
                  <ActivityIndicator 
                    color={theme.colors.accent} 
                    size="small" 
                    style={styles.statusSpinner}
                  />
                  <Text style={styles.statusText}>
                    Waiting for approval...
                  </Text>
                </View>

                {/* Timeout Notice */}
                <View style={styles.timeoutNotice}>
                  <Text style={styles.timeoutNoticeText}>
                    This request will timeout in 2 minutes. If you don't see the notification, try the "Start Over" button below.
                  </Text>
                </View>
              </View>

              {/* Start Over Option */}
              <TouchableOpacity 
                style={styles.startOverButton}
                onPress={handleStartOver}
                disabled={isLoading}
              >
                <Text style={styles.startOverText}>Start Over</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Status Message */}
          {statusMessage && authState !== 'push_notification' && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          )}

          {/* Submit Button - Only show for credentials state */}
          {authState === 'credentials' && (
            <TouchableOpacity
              style={[styles.linkButton, isLoading && styles.linkButtonDisabled]}
              onPress={handleSubmitCredentials}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isLoading ? [theme.colors.textMuted, theme.colors.textMuted] : theme.gradients.primary}
                style={styles.linkButtonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color={theme.colors.textInverse} size="small" />
                ) : (
                  <Text style={styles.linkButtonText}>Link My Account</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Help Section */}
          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>Need Help?</Text>
            <Text style={styles.helpContent}>
              If you're having trouble connecting your account:
            </Text>
            <View style={styles.helpList}>
              <Text style={styles.helpListItem}>• Make sure you're using your Penn State email (@psu.edu)</Text>
              <Text style={styles.helpListItem}>• Ensure Microsoft Authenticator is set up for your Penn State account</Text>
              <Text style={styles.helpListItem}>• Try logging into Penn State's meal plan portal first to verify credentials</Text>
              <Text style={styles.helpListItem}>• Contact support if the issue persists</Text>
            </View>
          </View>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              This app is not affiliated with Penn State University. It's an unofficial tool created to help students better manage their meal plans.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['4xl'],
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing['4xl'],
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  backButtonText: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.medium,
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
  },
  pennStateIcon: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.primaryAlpha,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: theme.typography.sizes['4xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.base,
    paddingHorizontal: theme.spacing.lg,
  },

  // Security Notice
  securityNotice: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing['2xl'],
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success,
    ...theme.shadows.sm,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  securityIcon: {
    fontSize: theme.typography.sizes.lg,
    marginRight: theme.spacing.sm,
  },
  securityTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  securityDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.sm,
  },

  // Form
  form: {
    gap: theme.spacing.xl,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: theme.layout.borderWidth,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textPrimary,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  eyeButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  eyeText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.medium,
  },
  errorText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
    fontWeight: theme.typography.weights.medium,
  },

  // Important Notice
  importantNotice: {
    backgroundColor: theme.colors.warningLight,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.warning,
  },
  noticeTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  noticeText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.sm,
  },

  // Link Button
  linkButton: {
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  linkButtonDisabled: {
    opacity: 0.6,
  },
  linkButtonGradient: {
    paddingVertical: theme.spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  linkButtonText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textInverse,
    letterSpacing: theme.typography.letterSpacing.wide,
  },

  // Push Notification Styles
  pushNotificationContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.accentAlpha,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['3xl'],
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accent,
  },
  pushNotificationIcon: {
    marginBottom: theme.spacing.lg,
  },
  pushNotificationIconText: {
    fontSize: 48,
  },
  pushNotificationTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  pushNotificationDescription: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.base,
    marginBottom: theme.spacing.xl,
  },

  // Number Match Code Display
  numberMatchContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    width: '100%',
    ...theme.shadows.sm,
  },
  numberMatchLabel: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  numberMatchCodeBox: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.xl,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing['3xl'],
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  numberMatchCode: {
    fontSize: theme.typography.sizes['5xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textInverse,
    letterSpacing: theme.typography.letterSpacing.wider,
  },
  numberMatchInstructions: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.sm,
  },

  // Push Instructions
  pushInstructions: {
    backgroundColor: theme.colors.infoLight,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.info,
  },
  pushInstructionsTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  pushInstructionsText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.sm,
  },

  // Status Container with Spinner
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.lg,
  },
  statusSpinner: {
    marginRight: theme.spacing.sm,
  },
  statusText: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
    textAlign: 'center',
  },

  // Timeout Notice
  timeoutNotice: {
    backgroundColor: theme.colors.warningLight,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
    width: '100%',
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning,
  },
  timeoutNoticeText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.xs,
  },

  // Start Over Button
  startOverButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  startOverText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.semibold,
    textDecorationLine: 'underline',
  },

  // Help Section
  helpSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
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

  // Disclaimer
  disclaimer: {
    alignItems: 'center',
  },
  disclaimerText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.xs,
  },

  // Common
  disabledText: {
    opacity: 0.5,
  },
});