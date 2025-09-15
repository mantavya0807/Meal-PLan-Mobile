/**
 * Dashboard Screen - Updated with Transaction Integration
 * File Path: app/(tabs)/dashboard.tsx
 * 
 * Main dashboard screen with Penn State account status, transaction overview,
 * and quick actions for meal plan management.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

/**
 * Penn State account status interface
 */
interface PennStateStatus {
  pennStateLinked: boolean;
  lastSyncDate?: string;
  hasTransactions: boolean;
  latestTransactionDate?: string;
  pennStateEmail?: string;
  accountStatus: string;
}

/**
 * Recent transaction interface
 */
interface RecentTransaction {
  id: string;
  date: string;
  location: string;
  amount: number;
  balanceAfter?: number;
}

/**
 * Quick stats interface
 */
interface QuickStats {
  totalSpent: number;
  transactionCount: number;
  averageTransaction: number;
  topLocation?: string;
}

/**
 * Component state interface
 */
interface DashboardState {
  pennStateStatus: PennStateStatus | null;
  recentTransactions: RecentTransaction[];
  quickStats: QuickStats | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string;
}

/**
 * Dashboard screen component
 */
export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [state, setState] = useState<DashboardState>({
    pennStateStatus: null,
    recentTransactions: [],
    quickStats: null,
    isLoading: true,
    isRefreshing: false,
    error: '',
  });

  /**
   * Updates component state
   * @param updates - Partial state updates
   */
  const updateState = useCallback((updates: Partial<DashboardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Loads dashboard data from API
   */
  const loadDashboardData = useCallback(async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        updateState({ isRefreshing: true, error: '' });
      } else {
        updateState({ isLoading: true, error: '' });
      }

      // Load Penn State status
      const statusResponse = await apiService.get('/penn-state/transactions/sync-status');
      let pennStateStatus = null;
      
      if (statusResponse.success) {
        pennStateStatus = statusResponse.data.syncStatus;
        updateState({ pennStateStatus });

        // If Penn State is linked and has transactions, load recent data
        if (pennStateStatus.pennStateLinked && pennStateStatus.hasTransactions) {
          const [transactionsResponse, statsResponse] = await Promise.all([
            apiService.get('/penn-state/transactions/recent?limit=5'),
            apiService.get('/penn-state/transactions/stats?startDate=' + 
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          ]);

          if (transactionsResponse.success) {
            updateState({ recentTransactions: transactionsResponse.data.transactions || [] });
          }

          if (statsResponse.success) {
            const stats = statsResponse.data.statistics;
            updateState({
              quickStats: {
                totalSpent: stats.totalSpent,
                transactionCount: stats.totalTransactions,
                averageTransaction: stats.averageTransaction,
                topLocation: stats.topLocations[0]?.location,
              }
            });
          }
        }
      }

      updateState({ 
        isLoading: false, 
        isRefreshing: false,
        pennStateStatus,
      });

    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      updateState({
        error: error.message || 'Failed to load dashboard data',
        isLoading: false,
        isRefreshing: false,
      });
    }
  }, [updateState]);

  /**
   * Handles logout
   */
  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/welcome');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  /**
   * Handles refresh
   */
  const handleRefresh = useCallback(async () => {
    await loadDashboardData(true);
  }, [loadDashboardData]);

  /**
   * Formats currency values
   */
  const formatCurrency = useCallback((amount: number): string => {
    return `$${Math.abs(amount).toFixed(2)}`;
  }, []);

  /**
   * Formats date for display
   */
  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }, []);

  /**
   * Renders the header section
   */
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View>
          <Text style={styles.welcomeText}>Welcome back</Text>
          <Text style={styles.userName}>
            {user?.firstName} {user?.lastName}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  /**
   * Renders Penn State account status card
   */
  const renderPennStateStatus = () => (
    <View style={styles.statusCard}>
      <View style={styles.statusHeader}>
        <View style={styles.statusIconContainer}>
          <Text style={styles.statusIcon}>
            {state.pennStateStatus?.pennStateLinked ? '✅' : '🎓'}
          </Text>
        </View>
        <View style={styles.statusInfo}>
          <Text style={styles.statusTitle}>Penn State Account</Text>
          <Text style={[
            styles.statusText,
            { color: state.pennStateStatus?.pennStateLinked ? theme.colors.success : theme.colors.warning }
          ]}>
            {state.pennStateStatus?.pennStateLinked ? 'Connected' : 'Not Connected'}
          </Text>
        </View>
      </View>
      
      {state.pennStateStatus?.pennStateLinked ? (
        <View style={styles.statusDetails}>
          {state.pennStateStatus.pennStateEmail && (
            <Text style={styles.statusDetail}>
              Account: {state.pennStateStatus.pennStateEmail}
            </Text>
          )}
          {state.pennStateStatus.lastSyncDate && (
            <Text style={styles.statusDetail}>
              Last sync: {formatDate(state.pennStateStatus.lastSyncDate)}
            </Text>
          )}
          
          <View style={styles.statusActions}>
            <TouchableOpacity
              style={styles.syncButton}
              onPress={() => {
                // TODO: Implement quick sync
                Alert.alert('Sync', 'Quick sync feature coming soon!');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.syncButtonText}>🔄 Sync</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => router.push('/(tabs)/transactions')}
              activeOpacity={0.8}
            >
              <Text style={styles.viewButtonText}>View Transactions</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.connectButton}
          onPress={() => router.push('/link-penn-state')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={theme.gradients.primary}
            style={styles.connectButtonGradient}
          >
            <Text style={styles.connectButtonText}>Connect Penn State Account</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  /**
   * Renders quick stats section
   */
  const renderQuickStats = () => {
    if (!state.quickStats) return null;

    const stats = [
      {
        label: 'This Month',
        value: formatCurrency(state.quickStats.totalSpent),
        icon: '💰',
      },
      {
        label: 'Transactions',
        value: state.quickStats.transactionCount.toString(),
        icon: '🧾',
      },
      {
        label: 'Average',
        value: formatCurrency(state.quickStats.averageTransaction),
        icon: '📊',
      },
    ];

    return (
      <View style={styles.quickStatsSection}>
        <Text style={styles.sectionTitle}>Quick Stats (30 Days)</Text>
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.statCard}>
              <Text style={styles.statIcon}>{stat.icon}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
        {state.quickStats.topLocation && (
          <View style={styles.topLocationCard}>
            <Text style={styles.topLocationLabel}>Most Visited</Text>
            <Text style={styles.topLocationName}>🏆 {state.quickStats.topLocation}</Text>
          </View>
        )}
      </View>
    );
  };

  /**
   * Renders recent transactions section
   */
  const renderRecentTransactions = () => {
    if (!state.recentTransactions || state.recentTransactions.length === 0) return null;

    return (
      <View style={styles.transactionsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/transactions')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        
        {state.recentTransactions.slice(0, 3).map((transaction) => (
          <View key={transaction.id} style={styles.transactionItem}>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionLocation}>{transaction.location}</Text>
              <Text style={styles.transactionDate}>{formatDate(transaction.date)}</Text>
            </View>
            <View style={styles.transactionAmount}>
              <Text style={styles.transactionAmountText}>
                -{formatCurrency(transaction.amount)}
              </Text>
              {transaction.balanceAfter && (
                <Text style={styles.transactionBalance}>
                  Balance: {formatCurrency(transaction.balanceAfter)}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  /**
   * Renders quick actions section
   */
  const renderQuickActions = () => (
    <View style={styles.actionsSection}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/transactions')}
          activeOpacity={0.8}
        >
          <View style={styles.actionIcon}>
            <Text style={styles.actionIconText}>📊</Text>
          </View>
          <Text style={styles.actionLabel}>Transactions</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            // TODO: Navigate to analytics
            Alert.alert('Analytics', 'Advanced analytics coming soon!');
          }}
          activeOpacity={0.8}
        >
          <View style={styles.actionIcon}>
            <Text style={styles.actionIconText}>📈</Text>
          </View>
          <Text style={styles.actionLabel}>Analytics</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            // TODO: Navigate to settings
            Alert.alert('Settings', 'Settings page coming soon!');
          }}
          activeOpacity={0.8}
        >
          <View style={styles.actionIcon}>
            <Text style={styles.actionIconText}>⚙️</Text>
          </View>
          <Text style={styles.actionLabel}>Settings</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            // TODO: Navigate to help
            Alert.alert('Help', 'Help & support coming soon!');
          }}
          activeOpacity={0.8}
        >
          <View style={styles.actionIcon}>
            <Text style={styles.actionIconText}>❓</Text>
          </View>
          <Text style={styles.actionLabel}>Help</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  /**
   * Initialize dashboard data
   */
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (state.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={state.isRefreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {renderHeader()}
      {renderPennStateStatus()}
      {renderQuickStats()}
      {renderRecentTransactions()}
      {renderQuickActions()}

      {state.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{state.error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadDashboardData()}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
  },
  content: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.spacing['4xl'],
  },
  header: {
    paddingTop: theme.spacing['2xl'],
    paddingBottom: theme.spacing['2xl'],
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  userName: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  logoutButton: {
    backgroundColor: theme.colors.surfaceSecondary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
  },
  logoutText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.medium,
  },
  
  // Status Card
  statusCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing['2xl'],
    marginBottom: theme.spacing['2xl'],
    ...theme.shadows.md,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
  },
  statusIcon: {
    fontSize: 20,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  statusText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
  },
  statusDetails: {
    marginTop: theme.spacing.lg,
  },
  statusDetail: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  statusActions: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
  },
  syncButton: {
    backgroundColor: theme.colors.surfaceSecondary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    marginRight: theme.spacing.lg,
  },
  syncButtonText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.medium,
  },
  viewButton: {
    backgroundColor: theme.colors.primaryAlpha,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
  },
  viewButtonText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  connectButton: {
    marginTop: theme.spacing.lg,
  },
  connectButtonGradient: {
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
  },
  connectButtonText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textInverse,
  },

  // Quick Stats
  quickStatsSection: {
    marginBottom: theme.spacing['2xl'],
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginRight: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: theme.spacing.sm,
  },
  statValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  topLocationCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  topLocationLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  topLocationName: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },

  // Transactions
  transactionsSection: {
    marginBottom: theme.spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  viewAllText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.semibold,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionLocation: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  transactionDate: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.error,
    marginBottom: theme.spacing.xs,
  },
  transactionBalance: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textTertiary,
  },

  // Quick Actions
  actionsSection: {
    marginBottom: theme.spacing['2xl'],
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primaryAlpha,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  actionIconText: {
    fontSize: 20,
  },
  actionLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },

  // Error handling
  errorContainer: {
    backgroundColor: theme.colors.errorLight,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  errorText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  retryButton: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
  },
  retryButtonText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textInverse,
    fontWeight: theme.typography.weights.semibold,
  },
});