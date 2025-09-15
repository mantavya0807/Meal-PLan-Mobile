/**
 * Transactions Screen - Penn State Meal Plan Transaction History
 * File Path: app/(tabs)/transactions.tsx
 * 
 * Displays transaction history, sync functionality, and spending analytics
 * using the established theme system and component patterns.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../constants/theme';
import { apiService } from '../../services/api';
import TransactionItem from '../../components/TransactionItem';
import TransactionFilters from '../../components/TransactionFilters';
import TransactionStats from '../../components/TransactionStats';
import SyncTransactionsModal from '../../components/SyncTransactionModal';

/**
 * Transaction data interface
 */
interface Transaction {
  id: string;
  date: string;
  location: string;
  description?: string;
  amount: number;
  balanceAfter?: number;
  accountType?: string;
  cardNumber?: string;
}

/**
 * Transaction filters interface
 */
interface TransactionFiltersType {
  startDate?: Date;
  endDate?: Date;
  location?: string;
  accountType?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
}

/**
 * Sync status interface
 */
interface SyncStatus {
  pennStateLinked: boolean;
  lastSyncDate?: string;
  hasTransactions: boolean;
  latestTransactionDate?: string;
}

/**
 * Component state interface
 */
interface TransactionsScreenState {
  transactions: Transaction[];
  isLoading: boolean;
  isRefreshing: boolean;
  isSyncing: boolean;
  showFilters: boolean;
  showStats: boolean;
  showSyncModal: boolean;
  syncStatus: SyncStatus | null;
  error: string;
  hasMore: boolean;
  page: number;
}

/**
 * Transactions screen component
 */
export default function TransactionsScreen() {
  const [state, setState] = useState<TransactionsScreenState>({
    transactions: [],
    isLoading: false,
    isRefreshing: false,
    isSyncing: false,
    showFilters: false,
    showStats: false,
    showSyncModal: false,
    syncStatus: null,
    error: '',
    hasMore: true,
    page: 0,
  });

  /**
   * Updates component state
   * @param updates - Partial state updates
   */
  const updateState = useCallback((updates: Partial<TransactionsScreenState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Loads transactions from API
   * @param refresh - Whether this is a refresh (reset pagination)
   * @param loadMore - Whether this is loading more items
   */
  const loadTransactions = useCallback(async (refresh: boolean = false, loadMore: boolean = false) => {
    if (state.isLoading && !refresh && !loadMore) return;

    try {
      const page = refresh ? 0 : loadMore ? state.page + 1 : state.page;
      
      if (refresh) {
        updateState({ isRefreshing: true, error: '' });
      } else if (!loadMore) {
        updateState({ isLoading: true, error: '' });
      }

      const response = await apiService.get(`/penn-state/transactions?limit=20&offset=${page * 20}`);

      if (response.success) {
        const newTransactions = response.data.transactions || [];
        const hasMore = response.data.pagination?.hasMore || false;

        updateState({
          transactions: refresh || !loadMore ? newTransactions : [...state.transactions, ...newTransactions],
          hasMore,
          page,
          isLoading: false,
          isRefreshing: false,
        });
      } else {
        throw new Error(response.message || 'Failed to load transactions');
      }
    } catch (error: any) {
      console.error('Error loading transactions:', error);
      updateState({
        error: error.message || 'Failed to load transactions',
        isLoading: false,
        isRefreshing: false,
      });
    }
  }, [state.isLoading, state.page, state.transactions, updateState]);

  /**
   * Loads sync status from API
   */
  const loadSyncStatus = useCallback(async () => {
    try {
      const response = await apiService.get('/penn-state/transactions/sync-status');
      
      if (response.success) {
        updateState({ syncStatus: response.data.syncStatus });
      }
    } catch (error: any) {
      console.error('Error loading sync status:', error);
    }
  }, [updateState]);

  /**
   * Handles transaction sync
   */
  const handleSync = useCallback(async (options: { fullSync?: boolean } = {}) => {
    if (!state.syncStatus?.pennStateLinked) {
      Alert.alert(
        'Account Not Linked',
        'Please link your Penn State account first to sync transactions.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      updateState({ isSyncing: true });

      const response = await apiService.post('/penn-state/transactions/sync', {
        fullSync: options.fullSync || false,
      });

      if (response.success) {
        const syncResult = response.data.syncResult;
        
        Alert.alert(
          'Sync Complete',
          `Successfully synced ${syncResult.newTransactions} new transactions.`,
          [{ text: 'OK' }]
        );
        
        // Reload transactions and sync status
        await Promise.all([
          loadTransactions(true),
          loadSyncStatus(),
        ]);
      } else {
        throw new Error(response.message || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      Alert.alert('Sync Failed', error.message || 'Unable to sync transactions');
    } finally {
      updateState({ isSyncing: false, showSyncModal: false });
    }
  }, [state.syncStatus, loadTransactions, loadSyncStatus, updateState]);

  /**
   * Handles pull-to-refresh
   */
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      loadTransactions(true),
      loadSyncStatus(),
    ]);
  }, [loadTransactions, loadSyncStatus]);

  /**
   * Handles load more items
   */
  const handleLoadMore = useCallback(() => {
    if (state.hasMore && !state.isLoading) {
      loadTransactions(false, true);
    }
  }, [state.hasMore, state.isLoading, loadTransactions]);

  /**
   * Formats currency amounts
   * @param amount - Amount to format
   * @returns Formatted currency string
   */
  const formatCurrency = useCallback((amount: number): string => {
    return `$${Math.abs(amount).toFixed(2)}`;
  }, []);

  /**
   * Renders transaction list item
   */
  const renderTransaction = useCallback(({ item }: { item: Transaction }) => (
    <TransactionItem
      transaction={item}
      onPress={() => {
        // TODO: Navigate to transaction details
      }}
    />
  ), []);

  /**
   * Renders empty state
   */
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>📊</Text>
      </View>
      <Text style={styles.emptyTitle}>No Transactions Yet</Text>
      <Text style={styles.emptyDescription}>
        {state.syncStatus?.pennStateLinked
          ? 'Sync your Penn State account to see your meal plan transactions.'
          : 'Link your Penn State account to start tracking your spending.'
        }
      </Text>
      {state.syncStatus?.pennStateLinked && (
        <TouchableOpacity
          style={styles.syncButton}
          onPress={() => updateState({ showSyncModal: true })}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={theme.gradients.primary}
            style={styles.syncButtonGradient}
          >
            <Text style={styles.syncButtonText}>Sync Transactions</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  ), [state.syncStatus, updateState]);

  /**
   * Renders header with stats and controls
   */
  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.headerTitle}>Transactions</Text>
          <Text style={styles.headerSubtitle}>
            {state.transactions.length} transactions
            {state.syncStatus?.lastSyncDate && 
              ` • Last sync: ${new Date(state.syncStatus.lastSyncDate).toLocaleDateString()}`
            }
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => updateState({ showStats: true })}
            activeOpacity={0.7}
          >
            <Text style={styles.headerActionText}>📈</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => updateState({ showFilters: true })}
            activeOpacity={0.7}
          >
            <Text style={styles.headerActionText}>🔍</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.headerAction, state.isSyncing && styles.headerActionDisabled]}
            onPress={() => updateState({ showSyncModal: true })}
            activeOpacity={0.7}
            disabled={state.isSyncing}
          >
            {state.isSyncing ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Text style={styles.headerActionText}>🔄</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      {state.syncStatus && !state.syncStatus.pennStateLinked && (
        <View style={styles.notLinkedBanner}>
          <Text style={styles.notLinkedText}>
            Link your Penn State account to view transactions
          </Text>
          <TouchableOpacity
            style={styles.linkAccountButton}
            onPress={() => {
              // TODO: Navigate to link account screen
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.linkAccountButtonText}>Link Account</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  ), [state.transactions.length, state.syncStatus, state.isSyncing, updateState]);

  /**
   * Renders footer loading indicator
   */
  const renderFooter = useCallback(() => {
    if (!state.hasMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }, [state.hasMore]);

  /**
   * Initialize screen data
   */
  useEffect(() => {
    const initializeScreen = async () => {
      await Promise.all([
        loadTransactions(),
        loadSyncStatus(),
      ]);
    };

    initializeScreen();
  }, []);

  if (state.isLoading && state.transactions.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={state.transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={state.isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        contentContainerStyle={[
          styles.listContent,
          state.transactions.length === 0 && styles.listContentEmpty
        ]}
        showsVerticalScrollIndicator={false}
      />

      {/* Transaction Filters Modal */}
      <Modal
        visible={state.showFilters}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <TransactionFilters
          onApplyFilters={(filters: TransactionFiltersType) => {
            console.log('Applying filters:', filters);
            // TODO: Apply filters and reload transactions
            updateState({ showFilters: false });
          }}
          onClose={() => updateState({ showFilters: false })}
        />
      </Modal>

      {/* Transaction Stats Modal */}
      <Modal
        visible={state.showStats}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <TransactionStats
          onClose={() => updateState({ showStats: false })}
        />
      </Modal>

      {/* Sync Transactions Modal */}
      <SyncTransactionsModal
        visible={state.showSyncModal}
        onClose={() => updateState({ showSyncModal: false })}
        onSync={handleSync}
        isSyncing={state.isSyncing}
        syncStatus={state.syncStatus}
      />

      {state.error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{state.error}</Text>
          <TouchableOpacity
            onPress={() => updateState({ error: '' })}
            style={styles.errorDismiss}
          >
            <Text style={styles.errorDismissText}>×</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
  listContent: {
    paddingHorizontal: theme.layout.screenPadding,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    paddingVertical: theme.spacing['2xl'],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
  },
  headerTitle: {
    fontSize: theme.typography.sizes['3xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
  },
  headerActionDisabled: {
    opacity: 0.6,
  },
  headerActionText: {
    fontSize: 18,
  },
  notLinkedBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.warningLight,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.warning,
  },
  notLinkedText: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    marginRight: theme.spacing.lg,
  },
  linkAccountButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  linkAccountButtonText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textInverse,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing['4xl'],
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing['2xl'],
  },
  emptyIconText: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  emptyDescription: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.base,
    marginBottom: theme.spacing['2xl'],
    marginHorizontal: theme.spacing['2xl'],
  },
  syncButton: {
    marginTop: theme.spacing.lg,
  },
  syncButtonGradient: {
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
  },
  syncButtonText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textInverse,
  },
  loadingFooter: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  errorBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  errorText: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textInverse,
  },
  errorDismiss: {
    marginLeft: theme.spacing.lg,
    padding: theme.spacing.sm,
  },
  errorDismissText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textInverse,
    fontWeight: theme.typography.weights.bold,
  },
});