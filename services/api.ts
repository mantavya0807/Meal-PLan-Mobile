/**
 * API Service - Updated with Menu Endpoints
 * File Path: services/api.ts
 * 
 * Frontend API service with authentication, Penn State integration,
 * transaction management, and comprehensive menu management methods.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * API configuration
 */
const API_CONFIG = {
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001',
  version: 'v1',
  timeout: 30000,
};

/**
 * Storage keys for tokens
 */
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
} as const;

/**
 * API Response interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
}

/**
 * User interfaces
 */
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

/**
 * Penn State interfaces
 */
export interface PennStateLoginRequest {
  email: string;
  password: string;
}

export interface PennStateStatus {
  pennStateLinked: boolean;
  lastSyncDate?: string;
  hasTransactions: boolean;
  latestTransactionDate?: string;
  pennStateEmail?: string;
  accountStatus: string;
}

/**
 * Transaction interfaces
 */
export interface Transaction {
  id: string;
  date: string;
  location: string;
  description?: string;
  amount: number;
  balanceAfter?: number;
  accountType?: string;
  cardNumber?: string;
}

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  location?: string;
  accountType?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
}

export interface TransactionStats {
  totalTransactions: number;
  totalSpent: number;
  averageTransaction: number;
  topLocations: Array<{
    location: string;
    visitCount: number;
    totalSpent: number;
    averagePerVisit: number;
  }>;
  monthlySpending: Array<{
    month: string;
    totalSpent: number;
    transactionCount: number;
    averagePerTransaction: number;
  }>;
}

export interface SyncTransactionRequest {
  fullSync?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface SyncTransactionResponse {
  success: boolean;
  totalTransactions: number;
  newTransactions: number;
  duplicatesSkipped: number;
  lastSyncDate: string;
  error?: string;
}

/**
 * Menu interfaces
 */
export interface MenuItem {
  id: string;
  itemId: string;
  name: string;
  locationId: string;
  date: string;
  mealPeriod: string;
  category?: string;
  description?: string;
  calories?: number;
  totalFat?: number;
  saturatedFat?: number;
  transFat?: number;
  cholesterol?: number;
  sodium?: number;
  totalCarbs?: number;
  dietaryFiber?: number;
  totalSugars?: number;
  addedSugars?: number;
  protein?: number;
  servingSize?: string;
  ingredients?: string;
  allergens?: string[];
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isFavorite?: boolean;
}

export interface MenuLocation {
  id: string;
  locationId: number;
  name: string;
  shortName: string;
  campus: string;
  isActive: boolean;
}

export interface MenuFilters {
  date?: string;
  locationIds?: string[];
  mealPeriods?: string[];
  categories?: string[];
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  hasAllergens?: string[];
  excludeAllergens?: string[];
  minCalories?: number;
  maxCalories?: number;
  minProtein?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MenuStats {
  totalItems: number;
  totalLocations: number;
  itemsByMealPeriod: Record<string, number>;
  itemsByLocation: Record<string, number>;
  averageCalories: number;
  vegetarianCount: number;
  veganCount: number;
  glutenFreeCount: number;
}

export interface MenuScrapeRequest {
  date?: string;
  meal?: string;
  locations?: number[];
  force?: boolean;
}

/**
 * HTTP Error class
 */
class APIError extends Error {
  constructor(
    public status: number,
    public message: string,
    public response?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * API Service Class
 */
export class apiService {
  
  /**
   * Makes HTTP request with authentication
   * @param method - HTTP method
   * @param endpoint - API endpoint
   * @param data - Request body data
   * @param options - Additional options
   * @returns Promise with API response
   */
  static async request<T = any>(
    method: string,
    endpoint: string,
    data?: any,
    options: {
      skipAuth?: boolean;
      timeout?: number;
      headers?: Record<string, string>;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { skipAuth = false, timeout = API_CONFIG.timeout, headers = {} } = options;

    try {
      const url = `${API_CONFIG.baseURL}/api/${API_CONFIG.version}${endpoint}`;
      
      const requestOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        signal: AbortSignal.timeout(timeout),
      };

      // Add authentication header if not skipped
      if (!skipAuth) {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        if (token) {
          requestOptions.headers = {
            ...requestOptions.headers,
            'Authorization': `Bearer ${token}`,
          };
        }
      }

      // Add request body for non-GET requests
      if (data && method.toUpperCase() !== 'GET') {
        requestOptions.body = JSON.stringify(data);
      }

      const response = await fetch(url, requestOptions);
      
      // Handle specific HTTP errors
      if (response.status === 401) {
        // Try to refresh token
        const refreshed = await this.refreshAuthToken();
        if (refreshed) {
          // Retry original request with new token
          return this.request(method, endpoint, data, options);
        } else {
          // Clear stored auth data and throw error
          await this.clearAuthData();
          throw new APIError(401, 'Authentication required');
        }
      }

      const responseData = await response.json();

      if (!response.ok) {
        throw new APIError(response.status, responseData.message || 'Request failed', responseData);
      }

      return responseData;

    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new APIError(408, 'Request timeout');
        }
        if (error.message.includes('Network request failed')) {
          throw new APIError(0, 'Network error - please check your connection');
        }
      }

      throw new APIError(500, 'An unexpected error occurred');
    }
  }

  /**
   * Authentication Methods
   */

  /**
   * User login
   * @param credentials - Login credentials
   * @returns Login response
   */
  static async login(credentials: { email: string; password: string }): Promise<ApiResponse<LoginResponse>> {
    const response = await this.request<LoginResponse>('POST', '/auth/login', credentials, { skipAuth: true });
    
    if (response.success && response.data) {
      await this.storeAuthData(response.data.tokens, response.data.user);
    }
    
    return response;
  }

  /**
   * User registration
   * @param userData - Registration data
   * @returns Registration response
   */
  static async register(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Promise<ApiResponse<LoginResponse>> {
    const response = await this.request<LoginResponse>('POST', '/auth/register', userData, { skipAuth: true });
    
    if (response.success && response.data) {
      await this.storeAuthData(response.data.tokens, response.data.user);
    }
    
    return response;
  }

  /**
   * User logout
   */
  static async logout(): Promise<void> {
    try {
      await this.request('POST', '/auth/logout');
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      await this.clearAuthData();
    }
  }

  /**
   * Get current user
   * @returns Current user data
   */
  static async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    return this.request<{ user: User }>('GET', '/auth/me');
  }

  /**
   * Check if user is authenticated
   * @returns Boolean indicating authentication status
   */
  static async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (!token) return false;
      
      const response = await this.getCurrentUser();
      return response.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh authentication token
   * @returns Boolean indicating success
   */
  static async refreshAuthToken(): Promise<boolean> {
    try {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) return false;

      const response = await this.request<{ tokens: AuthTokens }>('POST', '/auth/refresh', 
        { refreshToken }, 
        { skipAuth: true }
      );

      if (response.success && response.data) {
        await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.data.tokens.accessToken);
        await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.data.tokens.refreshToken);
        return true;
      }

      return false;
    } catch (error) {
      console.warn('Token refresh failed:', error);
      return false;
    }
  }

  /**
   * Store authentication data
   * @param tokens - Authentication tokens
   * @param user - User data
   */
  private static async storeAuthData(tokens: AuthTokens, user: User): Promise<void> {
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken),
      AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken),
      AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user)),
    ]);
  }

  /**
   * Clear authentication data
   */
  private static async clearAuthData(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
    ]);
  }

  /**
   * Transaction API Methods
   */

  /**
   * Gets user transactions with filtering
   * @param filters - Transaction filters
   * @returns Filtered transactions
   */
  static async getTransactions(filters: TransactionFilters = {}): Promise<ApiResponse<{
    transactions: Transaction[];
    totalCount: number;
    hasMore: boolean;
  }>> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request<{
      transactions: Transaction[];
      totalCount: number;
      hasMore: boolean;
    }>('GET', `/transactions${query}`);
  }

  /**
   * Gets transaction statistics
   * @param filters - Optional filters for statistics
   * @returns Transaction statistics
   */
  static async getTransactionStats(filters: Partial<TransactionFilters> = {}): Promise<ApiResponse<TransactionStats>> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request<TransactionStats>('GET', `/transactions/stats${query}`);
  }

  /**
   * Gets Penn State account status
   * @returns Penn State account status
   */
  static async getPennStateStatus(): Promise<ApiResponse<PennStateStatus>> {
    return this.request<PennStateStatus>('GET', '/pennstate/status');
  }

  /**
   * Links Penn State account
   * @param credentials - Penn State login credentials
   * @returns Linking result
   */
  static async linkPennStateAccount(credentials: PennStateLoginRequest): Promise<ApiResponse<{
    success: boolean;
    message: string;
  }>> {
    return this.request<{
      success: boolean;
      message: string;
    }>('POST', '/pennstate/link', credentials);
  }

  /**
   * Syncs Penn State transactions
   * @param request - Sync request parameters
   * @returns Sync result
   */
  static async syncTransactions(request: SyncTransactionRequest = {}): Promise<ApiResponse<SyncTransactionResponse>> {
    return this.request<SyncTransactionResponse>('POST', '/pennstate/sync-transactions', request);
  }

  /**
   * Menu API Methods
   */

  /**
   * Gets today's menu for all or specific locations
   * @param params - Query parameters
   * @returns Today's menu items
   */
  static async getTodaysMenu(params: {
    meal?: string;
    locations?: string;
    refresh?: boolean;
  } = {}): Promise<ApiResponse<{
    items: MenuItem[];
    grouped: Record<string, Record<string, MenuItem[]>>;
    date: string;
    mealPeriod: string;
    locationCount: number;
  }>> {
    const queryParams = new URLSearchParams();
    if (params.meal) queryParams.append('meal', params.meal);
    if (params.locations) queryParams.append('locations', params.locations);
    if (params.refresh) queryParams.append('refresh', params.refresh.toString());
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request<{
      items: MenuItem[];
      grouped: Record<string, Record<string, MenuItem[]>>;
      date: string;
      mealPeriod: string;
      locationCount: number;
    }>('GET', `/menu/today${query}`, undefined, { skipAuth: true });
  }

  /**
   * Gets menu items with advanced filtering
   * @param filters - Menu filters
   * @returns Filtered menu items
   */
  static async getMenuItems(filters: MenuFilters = {}): Promise<ApiResponse<{
    items: MenuItem[];
    stats: any;
    filters: { applied: any };
  }>> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value) && value.length > 0) {
          queryParams.append(key, value.join(','));
        } else if (typeof value === 'string' && value.trim()) {
          queryParams.append(key, value);
        } else if (typeof value === 'number' && !isNaN(value)) {
          queryParams.append(key, value.toString());
        } else if (typeof value === 'boolean') {
          queryParams.append(key, value.toString());
        }
      }
    });
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request<{
      items: MenuItem[];
      stats: any;
      filters: { applied: any };
    }>('GET', `/menu/items${query}`, undefined, { skipAuth: true });
  }

  /**
   * Gets all dining locations
   * @returns Array of dining locations
   */
  static async getMenuLocations(): Promise<ApiResponse<{
    locations: MenuLocation[];
    count: number;
  }>> {
    return this.request<{
      locations: MenuLocation[];
      count: number;
    }>('GET', '/menu/locations', undefined, { skipAuth: true });
  }

  /**
   * Manually triggers menu scraping
   * @param request - Scraping parameters
   * @returns Scraping result
   */
  static async scrapeMenu(request: MenuScrapeRequest = {}): Promise<ApiResponse<{
    scrapingResult: any;
    summary: {
      totalItems: number;
      itemsWithNutrition: number;
      nutritionSuccessRate: number;
      processingTimeSeconds: number;
      locationsProcessed: number;
    };
  }>> {
    return this.request<{
      scrapingResult: any;
      summary: {
        totalItems: number;
        itemsWithNutrition: number;
        nutritionSuccessRate: number;
        processingTimeSeconds: number;
        locationsProcessed: number;
      };
    }>('POST', '/menu/scrape', request);
  }

  /**
   * Gets user's favorite menu items
   * @param limit - Maximum number of items to return
   * @returns Array of favorite menu items
   */
  static async getMenuFavorites(limit = 50): Promise<ApiResponse<{
    favorites: MenuItem[];
    count: number;
  }>> {
    return this.request<{
      favorites: MenuItem[];
      count: number;
    }>('GET', `/menu/favorites?limit=${limit}`);
  }

  /**
   * Adds a menu item to user's favorites
   * @param menuItemId - Menu item ID
   * @returns Success response
   */
  static async addMenuFavorite(menuItemId: string): Promise<ApiResponse<{
    menuItemId: string;
    userId: string;
  }>> {
    return this.request<{
      menuItemId: string;
      userId: string;
    }>('POST', `/menu/favorites/${menuItemId}`);
  }

  /**
   * Removes a menu item from user's favorites
   * @param menuItemId - Menu item ID
   * @returns Success response
   */
  static async removeMenuFavorite(menuItemId: string): Promise<ApiResponse<{
    menuItemId: string;
    userId: string;
  }>> {
    return this.request<{
      menuItemId: string;
      userId: string;
    }>('DELETE', `/menu/favorites/${menuItemId}`);
  }

  /**
   * Gets menu statistics and analytics
   * @param date - Optional date filter (YYYY-MM-DD)
   * @returns Menu statistics
   */
  static async getMenuStats(date?: string): Promise<ApiResponse<{
    stats: MenuStats;
    dateFilter: string;
  }>> {
    const query = date ? `?date=${date}` : '';
    return this.request<{
      stats: MenuStats;
      dateFilter: string;
    }>('GET', `/menu/stats${query}`, undefined, { skipAuth: true });
  }
}