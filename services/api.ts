/**
 * API Service for Backend Communication
 * File Path: services/api.ts
 * 
 * Handles all HTTP requests to the backend API with automatic token management
 * and error handling for authentication flows.
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';

/**
 * API configuration
 */
const API_BASE_URL = 'http://localhost:3001'; // Change to your backend URL
const API_VERSION = 'v1';

/**
 * Storage keys for tokens
 */
const TOKEN_STORAGE_KEY = '@auth_tokens';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * API response interfaces
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ValidationError[];
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Auth API request interfaces
 */
export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

/**
 * API Service Class
 */
class ApiService {
  private axiosInstance: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: `${API_BASE_URL}/api/${API_VERSION}`,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Sets up request/response interceptors for token management
   */
  private setupInterceptors(): void {
    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        const token = await this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // Wait for token refresh to complete
            return new Promise((resolve) => {
              this.refreshSubscribers.push((token: string) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(this.axiosInstance(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const newToken = await this.refreshAccessToken();
            this.isRefreshing = false;
            this.refreshSubscribers.forEach(callback => callback(newToken));
            this.refreshSubscribers = [];

            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            this.isRefreshing = false;
            this.refreshSubscribers = [];
            await this.clearTokens();
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Token storage methods
   */
  private async storeTokens(tokens: AuthTokens): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(TOKEN_STORAGE_KEY, tokens.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      } else {
        // Store access token in AsyncStorage (less sensitive)
        await AsyncStorage.setItem(TOKEN_STORAGE_KEY, tokens.accessToken);
        
        // Store refresh token in Keychain (more secure)
        await Keychain.setInternetCredentials(
          REFRESH_TOKEN_KEY,
          'user',
          tokens.refreshToken
        );
      }
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  private async getAccessToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(TOKEN_STORAGE_KEY);
      }
      return await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  private async getRefreshToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(REFRESH_TOKEN_KEY);
      }
      const credentials = await Keychain.getInternetCredentials(REFRESH_TOKEN_KEY);
      return credentials ? credentials.password : null;
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  private async clearTokens(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      } else {
        await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
        await Keychain.resetGenericPassword({ service: REFRESH_TOKEN_KEY });
      }
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  /**
   * Token refresh logic
   */
  private async refreshAccessToken(): Promise<string> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post(
      `${API_BASE_URL}/api/${API_VERSION}/auth/refresh-token`,
      { refreshToken }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || 'Token refresh failed');
    }

    const newAccessToken = response.data.data.accessToken;
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, newAccessToken);
    return newAccessToken;
  }

  /**
   * Authentication methods
   */
  async register(userData: RegisterRequest): Promise<{ user: UserProfile; tokens: AuthTokens }> {
    try {
      const response: AxiosResponse<ApiResponse> = await this.axiosInstance.post('/auth/register', userData);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Registration failed');
      }

      const { user, tokens } = response.data.data;
      await this.storeTokens(tokens);
      
      return { user, tokens };
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error('Registration failed. Please try again.');
    }
  }

  async login(credentials: LoginRequest): Promise<{ user: UserProfile; tokens: AuthTokens }> {
    try {
      const response: AxiosResponse<ApiResponse> = await this.axiosInstance.post('/auth/login', credentials);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Login failed');
      }

      const { user, tokens } = response.data.data;
      await this.storeTokens(tokens);
      
      return { user, tokens };
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error('Login failed. Please try again.');
    }
  }

  async forgotPassword(email: string): Promise<string> {
    try {
      const response: AxiosResponse<ApiResponse> = await this.axiosInstance.post('/auth/forgot-password', { email });
      return response.data.message;
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error('Password reset request failed. Please try again.');
    }
  }

  async resetPassword(resetData: ResetPasswordRequest): Promise<string> {
    try {
      const response: AxiosResponse<ApiResponse> = await this.axiosInstance.post('/auth/reset-password', resetData);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Password reset failed');
      }

      return response.data.message;
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error('Password reset failed. Please try again.');
    }
  }

  async getCurrentUser(): Promise<UserProfile> {
    try {
      const response: AxiosResponse<ApiResponse> = await this.axiosInstance.get('/auth/me');
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to get user profile');
      }

      return response.data.data.user;
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error('Failed to get user profile');
    }
  }

  async logout(): Promise<void> {
    try {
      // Call backend logout endpoint
      await this.axiosInstance.post('/auth/logout');
    } catch (error) {
      // Continue with local logout even if backend call fails
      console.warn('Backend logout failed, continuing with local logout');
    } finally {
      // Always clear local tokens
      await this.clearTokens();
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    // For web, we can just check for the access token.
    // For native, checking both is more robust.
    if (Platform.OS === 'web') {
      return !!accessToken;
    }
    const refreshToken = await this.getRefreshToken();
    return !!(accessToken && refreshToken);
  }
}

export const apiService = new ApiService();
export default apiService;
