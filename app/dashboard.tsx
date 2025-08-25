/**
 * Dashboard Screen - Enhanced with Penn State Account States
 * File Path: app/dashboard.tsx
 * 
 * Main dashboard for authenticated users with conditional display based on
 * Penn State account linking status. Shows different UI for linked vs unlinked states.
 */

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ScrollView,
  RefreshControl,
  SafeAreaView 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../constants/theme';

/**
 * Interface for Penn State account status
 */
interface PennStateAccount {
  isLinked: boolean;
  email?: string;
  lastSync?: Date;
  balance?: {
    current: number;
    remaining: number;
    spent: number;
  };
  recentTransactions?: Array<{
    id: string;
    date: Date;
    location: string;
    amount: number;
    description: string;
  }>;
}

/**
 * Dashboard screen component with Penn State account integration
 */
export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // TODO: Replace with actual Penn State account status from backend API
  // This will be connected to the backend service for Penn State integration
  const [pennStateAccount, setPennStateAccount] = useState<PennStateAccount>({
    isLinked: false, // Change to true to test linked state UI
  });

  /**
   * Handles logout functionality
   */
  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/welcome');
    } catch (error) {
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  /**
   * Navigates to Penn State account linking screen
   */
  const handleLinkPennState = () => {
    router.push('/link-penn-state');
  };

  /**
   * Handles refresh functionality
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // TODO: Implement actual refresh logic
    // - Sync Penn State meal plan data
    // - Update balance and transaction information
    // - Handle sync errors and display appropriate messages
    
    // Simulate refresh delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1500);
  };

  /**
   * Formats currency values for display
   * @param amount - Amount in dollars
   * @returns Formatted currency string
   */
  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

  /**
   * Renders the header section with user info and logout
   */
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View>
          <Text style={styles.welcomeText}>Welcome back</Text>
          <Text style={styles.userName}>{user?.firstName}</Text>
        </View>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  /**
   * Renders the Penn State account not linked state
   */
  const renderNotLinkedState = () => (
    <View style={styles.notLinkedContainer}>
      <View style={styles.notLinkedCard}>
        <View style={styles.notLinkedIcon}>
          <Text style={styles.iconText}>🎓</Text>
        </View>
        
        <Text style={styles.notLinkedTitle}>Connect Your Penn State Account</Text>
        <Text style={styles.notLinkedDescription}>
          Link your Penn State meal plan to track your balance, view transaction history, 
          and get spending insights all in one place.
        </Text>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={handleLinkPennState}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={theme.gradients.primary}
            style={styles.linkButtonGradient}
          >
            <Text style={styles.linkButtonText}>Link Penn State Account</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.securityNotice}>
          <Text style={styles.securityText}>
            🔒 Your credentials are encrypted and stored securely
          </Text>
        </View>
      </View>
    </View>
  );

  /**
   * Renders the Penn State account linked state with meal plan data
   */
  const renderLinkedState = () => (
    <View style={styles.linkedContainer}>
      {/* Account Status Card */}
      <View style={styles.accountStatusCard}>
        <View style={styles.statusHeader}>
          <View>
            <Text style={styles.statusTitle}>Penn State Account</Text>
            <Text style={styles.statusEmail}>{pennStateAccount.email}</Text>
          </View>
          <View style={styles.connectedBadge}>
            <Text style={styles.connectedText}>Connected</Text>
          </View>
        </View>
        
        {pennStateAccount.lastSync && (
          <Text style={styles.lastSyncText}>
            Last updated: {pennStateAccount.lastSync.toLocaleTimeString()}
          </Text>
        )}
      </View>

      {/* Balance Overview Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceTitle}>Current Balance</Text>
        <Text style={styles.balanceAmount}>
          {/* TODO: Display actual balance from Penn State API */}
          {pennStateAccount.balance ? formatCurrency(pennStateAccount.balance.current) : '$0.00'}
        </Text>
        
        {pennStateAccount.balance && (
          <View style={styles.balanceDetails}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Spent This Period</Text>
              <Text style={styles.balanceValue}>
                {formatCurrency(pennStateAccount.balance.spent)}
              </Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Remaining</Text>
              <Text style={styles.balanceValue}>
                {formatCurrency(pennStateAccount.balance.remaining)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsCard}>
        <Text style={styles.quickActionsTitle}>Quick Actions</Text>
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
            <Text style={styles.actionButtonText}>View Transactions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
            <Text style={styles.actionButtonText}>Spending Analytics</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity Placeholder */}
      <View style={styles.recentActivityCard}>
        <Text style={styles.recentActivityTitle}>Recent Activity</Text>
        <View style={styles.emptyActivityState}>
          <Text style={styles.emptyActivityText}>
            {/* TODO: Display actual recent transactions from Penn State API */}
            Transaction data will appear here once synced
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {pennStateAccount.isLinked ? renderLinkedState() : renderNotLinkedState()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing['4xl'],
  },

  // Header Styles
  header: {
    backgroundColor: theme.colors.surface,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.layout.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    ...theme.shadows.sm,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.normal,
  },
  userName: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.xs,
  },
  logoutButton: {
    backgroundColor: theme.colors.surfaceSecondary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  logoutText: {
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
    fontSize: theme.typography.sizes.sm,
  },

  // Not Linked State Styles
  notLinkedContainer: {
    flex: 1,
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing['5xl'],
  },
  notLinkedCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius['3xl'],
    padding: theme.spacing['4xl'],
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  notLinkedIcon: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.primaryAlpha,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing['2xl'],
  },
  iconText: {
    fontSize: 40,
  },
  notLinkedTitle: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  notLinkedDescription: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.base,
    marginBottom: theme.spacing['3xl'],
  },
  linkButton: {
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.md,
    marginBottom: theme.spacing.xl,
  },
  linkButtonGradient: {
    paddingVertical: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing['4xl'],
    alignItems: 'center',
  },
  linkButtonText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textInverse,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  securityNotice: {
    alignItems: 'center',
  },
  securityText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },

  // Linked State Styles
  linkedContainer: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  
  // Account Status Card
  accountStatusCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing.xl,
    ...theme.shadows.md,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  statusTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  statusEmail: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  connectedBadge: {
    backgroundColor: theme.colors.successLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  connectedText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.success,
  },
  lastSyncText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textTertiary,
  },

  // Balance Card
  balanceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing.xl,
    ...theme.shadows.md,
  },
  balanceTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  balanceAmount: {
    fontSize: theme.typography.sizes['5xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.lg,
  },
  balanceDetails: {
    gap: theme.spacing.md,
  },
  balanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  balanceValue: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },

  // Quick Actions Card
  quickActionsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing.xl,
    ...theme.shadows.md,
  },
  quickActionsTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSecondary,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textPrimary,
  },

  // Recent Activity Card
  recentActivityCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing.xl,
    ...theme.shadows.md,
  },
  recentActivityTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  emptyActivityState: {
    alignItems: 'center',
    paddingVertical: theme.spacing['2xl'],
  },
  emptyActivityText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});