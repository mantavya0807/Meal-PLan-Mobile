/**
 * Penn State Account Linking Screen - Fixed Session and Polling
 * File Path: app/link-penn-state.tsx
 * 
 * Complete rewrite with proper session handling and polling mechanism
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { router } from 'expo-router';
import { apiService } from '../services/api';

type AuthState = 'credentials' | 'push_notification' | 'success';

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

export default function LinkPennStateScreen() {
  // State management
  const [authState, setAuthState] = useState<AuthState>('credentials');
  const [formData, setFormData] = useState<FormData>({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [numberMatchCode, setNumberMatchCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Use refs to avoid closure issues with polling
  const sessionIdRef = useRef<string>('');
  const pollingIntervalRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);

  /**
   * Validates form input
   */
  const validateCredentials = (): FormErrors => {
    const formErrors: FormErrors = {};
    
    if (!formData.email.trim()) {
      formErrors.email = 'Penn State email is required';
    } else if (!formData.email.endsWith('@psu.edu')) {
      formErrors.email = 'Must be a valid @psu.edu email';
    }
    
    if (!formData.password) {
      formErrors.password = 'Password is required';
    }
    
    return formErrors;
  };

  /**
   * Check push notification approval status
   */
  const checkPushApproval = useCallback(async () => {
    // Use ref to get latest sessionId value
    const currentSessionId = sessionIdRef.current;
    
    if (!currentSessionId) {
      console.error('No session ID available for push approval check');
      stopPolling();
      Alert.alert(
        'Session Error',
        'Authentication session lost. Please try again.',
        [{ text: 'OK', onPress: () => resetToCredentials() }]
      );
      return;
    }

    try {
      console.log(`Checking push approval for session: ${currentSessionId}`);
      
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/penn-state/check-approval?sessionId=${currentSessionId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await apiService.getToken() || ''}`,
          },
        }
      );

      const result = await response.json();
      console.log('Push approval check result:', result);

      if (result.success && result.data?.linkedAccount) {
        // Success - account linked!
        console.log('Account successfully linked!');
        stopPolling();
        setAuthState('success');
        setStatusMessage('Account linked successfully!');
        setIsLoading(false);
        
        Alert.alert(
          'Success!',
          'Your Penn State meal plan is now connected.',
          [{ text: 'Continue', onPress: () => router.replace('/(tabs)/dashboard') }]
        );
        
      } else if (!result.success && result.data?.requiresRestart) {
        // Session expired or error
        console.log('Session expired or error');
        stopPolling();
        setIsLoading(false);
        
        Alert.alert(
          'Authentication Failed',
          result.message || 'Session expired. Please try again.',
          [{ text: 'Try Again', onPress: () => resetToCredentials() }]
        );
        
      } else if (result.success && result.data?.status === 'waiting_for_approval') {
        // Still waiting - polling will continue
        console.log('Still waiting for approval...');
      } else {
        // Unexpected response
        console.error('Unexpected response:', result);
        stopPolling();
        setIsLoading(false);
        
        Alert.alert(
          'Error',
          'Unable to verify authentication status.',
          [{ text: 'Try Again', onPress: () => resetToCredentials() }]
        );
      }
    } catch (error) {
      console.error('Error checking push approval:', error);
      stopPolling();
      setIsLoading(false);
      
      Alert.alert(
        'Connection Error',
        'Unable to check authentication status.',
        [{ text: 'Try Again', onPress: () => resetToCredentials() }]
      );
    }
  }, []);

  /**
   * Start polling for push approval
   */
  const startPolling = useCallback(() => {
    if (isPollingRef.current) {
      console.log('Polling already active');
      return;
    }
    
    console.log('Starting push approval polling...');
    isPollingRef.current = true;
    
    // Do immediate check
    checkPushApproval();
    
    // Set up interval for repeated checks
    pollingIntervalRef.current = setInterval(() => {
      checkPushApproval();
    }, 3000); // Check every 3 seconds
  }, [checkPushApproval]);

  /**
   * Stop polling
   */
  const stopPolling = () => {
    console.log('Stopping polling...');
    isPollingRef.current = false;
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  /**
   * Reset to credentials screen
   */
  const resetToCredentials = () => {
    stopPolling();
    setAuthState('credentials');
    setFormData({ email: '', password: '' });
    setErrors({});
    setStatusMessage('');
    setNumberMatchCode('');
    sessionIdRef.current = '';
    setIsLoading(false);
  };

  /**
   * Handle form submission
   */
  const handleSubmitCredentials = async () => {
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
      
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/penn-state/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await apiService.getToken() || ''}`,
          },
          body: JSON.stringify({
            email: formData.email.trim(),
            password: formData.password,
          }),
        }
      );

      const result = await response.json();
      console.log('Login response:', result);

      if (result.success) {
        // Success without 2FA
        setAuthState('success');
        setStatusMessage('Account linked successfully!');
        setIsLoading(false);
        
        Alert.alert(
          'Success!',
          'Your Penn State meal plan is now connected.',
          [{ text: 'Continue', onPress: () => router.replace('/(tabs)/dashboard') }]
        );
        
      } else if (result.data?.requiresMFA) {
        // 2FA required
        const { numberMatchCode: code, sessionId } = result.data;
        
        if (!sessionId) {
          console.error('No sessionId received from backend');
          Alert.alert('Error', 'Authentication session could not be established.');
          setIsLoading(false);
          return;
        }
        
        console.log('2FA required. Session ID:', sessionId);
        console.log('Number match code:', code);
        
        // Store session ID in ref to avoid closure issues
        sessionIdRef.current = sessionId;
        
        // Update UI state
        setNumberMatchCode(code || '');
        setAuthState('push_notification');
        setStatusMessage('Check your Microsoft Authenticator app');
        
        // Start polling after a short delay
        setTimeout(() => {
          console.log('Starting polling with session:', sessionIdRef.current);
          startPolling();
        }, 2000);
        
      } else {
        // Login failed
        console.log('Login failed:', result.message);
        setIsLoading(false);
        
        Alert.alert(
          'Connection Failed',
          result.message || 'Unable to verify your credentials.'
        );
      }
      
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
      
      Alert.alert(
        'Connection Error',
        'Unable to connect to Penn State services.'
      );
    }
  };

  /**
   * Handle going back
   */
  const handleGoBack = () => {
    if (!isLoading) {
      stopPolling();
      router.back();
    }
  };

  /**
   * Clean up on unmount
   */
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Render based on auth state
  if (authState === 'push_notification') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.content}>
            <Text style={styles.title}>Approve Sign-In Request</Text>
            
            <Text style={styles.description}>
              Check your Microsoft Authenticator app and approve the sign-in request for your Penn State account.
            </Text>

            {numberMatchCode && (
              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>Match this number:</Text>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{numberMatchCode}</Text>
                </View>
                <Text style={styles.codeHint}>
                  Select "Yes" if this number appears in your Microsoft Authenticator app.
                </Text>
              </View>
            )}

            <View style={styles.stepsContainer}>
              <Text style={styles.stepsTitle}>Steps:</Text>
              <Text style={styles.stepText}>1. Open Microsoft Authenticator app</Text>
              <Text style={styles.stepText}>2. Look for Penn State sign-in notification</Text>
              {numberMatchCode && (
                <Text style={styles.stepText}>3. Verify the number matches: {numberMatchCode}</Text>
              )}
              <Text style={styles.stepText}>{numberMatchCode ? '4' : '3'}. Tap "Yes" to approve</Text>
            </View>

            <ActivityIndicator size="large" color="#1e3a8a" style={styles.loader} />
            <Text style={styles.statusText}>Waiting for approval...</Text>

            <TouchableOpacity onPress={resetToCredentials} style={styles.startOverButton}>
              <Text style={styles.startOverText}>Start Over</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (authState === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.title}>Account Linked Successfully!</Text>
          <Text style={styles.description}>
            Your Penn State meal plan is now connected. You can start tracking your balance and transactions.
          </Text>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/dashboard')} style={styles.continueButton}>
            <Text style={styles.continueText}>Continue to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Default: credentials form
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton} disabled={isLoading}>
            <Text style={[styles.backText, isLoading && styles.disabledText]}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.content}>
            <Text style={styles.title}>Link Penn State Account</Text>
            <Text style={styles.description}>
              Connect your Penn State meal plan to start tracking your dining balance and transactions.
            </Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Penn State Email</Text>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="abc123@psu.edu"
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  editable={!isLoading}
                />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={[styles.passwordContainer, errors.password && styles.inputError]}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChangeText={(text) => setFormData({ ...formData, password: text })}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    editable={!isLoading}
                  />
                  <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Text>{showPassword ? '👁' : '👁‍🗨'}</Text>
                  </TouchableOpacity>
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>
            </View>

            <TouchableOpacity 
              onPress={handleSubmitCredentials}
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Link Account</Text>
              )}
            </TouchableOpacity>

            {statusMessage !== '' && (
              <Text style={styles.statusMessage}>{statusMessage}</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  backButton: {
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    color: '#1e3a8a',
  },
  disabledText: {
    opacity: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 30,
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  eyeButton: {
    padding: 12,
  },
  submitButton: {
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusMessage: {
    marginTop: 20,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  codeContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  codeLabel: {
    fontSize: 16,
    marginBottom: 10,
  },
  codeBox: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  codeText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  codeHint: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 10,
    textAlign: 'center',
  },
  stepsContainer: {
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    padding: 20,
    marginBottom: 30,
    width: '100%',
    maxWidth: 400,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  stepText: {
    fontSize: 14,
    marginVertical: 4,
  },
  loader: {
    marginVertical: 20,
  },
  statusText: {
    fontSize: 14,
    color: '#6b7280',
  },
  startOverButton: {
    marginTop: 30,
  },
  startOverText: {
    fontSize: 16,
    color: '#1e3a8a',
    textDecorationLine: 'underline',
  },
  successIcon: {
    fontSize: 72,
    marginBottom: 20,
  },
  continueButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 16,
    marginTop: 30,
    minWidth: 200,
    alignItems: 'center',
  },
  continueText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});