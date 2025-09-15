/**
 * Sync Transactions Modal Component
 * File Path: components/SyncTransactionsModal.tsx
 * 
 * Modal component for syncing Penn State meal plan transactions.
 * Provides options for full sync vs incremental sync with status feedback.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';

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
 * Sync options interface
 */
interface SyncOptions {
  fullSync?: boolean;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Component props interface
 */
interface SyncTransactionsModalProps {
  visible: boolean;
  onClose: () => void;
  onSync: (options: SyncOptions) => Promise<void>;
  isSyncing: boolean;
  syncStatus: SyncStatus | null;
}

/**
 * Sync transactions modal component
 */
export const SyncTransactionsModal: React.FC<SyncTransactionsModalProps> = ({
  visible,
  onClose,
  onSync,
  isSyncing,
  syncStatus,
}) => {
  const [syncOption, setSyncOption] = useState<'incremental' | 'full'>('incremental');

  /**
   * Formats date for display
   * @param dateString - ISO date string
   * @returns Formatted date string
   */
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  /**
   * Gets the appropriate sync description based on current state
   */
  const getSyncDescription = (): string => {
    if (!syncStatus) return '';

    if (syncOption === 'incremental') {
      if (syncStatus.hasTransactions && syncStatus.latestTransactionDate) {
        return `Sync new transactions since ${formatDate(syncStatus.latestTransactionDate)}`;
      } else {
        return 'Sync recent transactions from the last 30 days';
      }
    } else {
      return 'Download all available transaction history (may take longer)';
    }
  };

  /**
   * Gets sync recommendation based on user's current state
   */
  const getSyncRecommendation = (): string => {
    if (!syncStatus) return '';

    if (!syncStatus.hasTransactions) {
      return 'Recommended: Start with a full sync to get your complete transaction history.';
    } else {
      return 'Recommended: Use incremental sync to get new transactions quickly.';
    }
  };

  /**
   * Handles sync initiation
   */
  const handleSync = async () => {
    if (!syncStatus?.pennStateLinked) {
      Alert.alert(
        'Account Not Linked',
        'Please link your Penn State account first.',
        [{ text: 'OK' }]
      );
      return;
    }

    const options: SyncOptions = {
      fullSync: syncOption === 'full',
    };

    await onSync(options);
  };

  /**
   * Renders sync option selection
   */
  const renderSyncOptions = () => (
    <View style={styles.optionsSection}>
      <Text style={styles.optionsTitle}>Sync Options</Text>
      
      {/* Incremental Sync Option */}
      <TouchableOpacity
        style={[
          styles.optionCard,
          syncOption === 'incremental' && styles.optionCardSelected,
        ]}
        onPress={() => setSyncOption('incremental')}
        activeOpacity={0.7}
      >
        <View style={styles.optionHeader}>
          <View style={[
            styles.optionRadio,
            syncOption === 'incremental' && styles.optionRadioSelected,
          ]}>
            {syncOption === 'incremental' && (
              <View style={styles.optionRadioInner} />
            )}
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Quick Sync</Text>
            <Text style={styles.optionDescription}>
              Get recent transactions only
            </Text>
          </View>
          <View style={styles.optionBadge}>
            <Text style={styles.optionBadgeText}>⚡</Text>
          </View>
        </View>
        <Text style={styles.optionDetails}>
          {getSyncDescription()}
        </Text>
      </TouchableOpacity>

      {/* Full Sync Option */}
      <TouchableOpacity
        style={[
          styles.optionCard,
          syncOption === 'full' && styles.optionCardSelected,
        ]}
        onPress={() => setSyncOption('full')}
        activeOpacity={0.7}
      >
        <View style={styles.optionHeader}>
          <View style={[
            styles.optionRadio,
            syncOption === 'full' && styles.optionRadioSelected,
          ]}>
            {syncOption === 'full' && (
              <View style={styles.optionRadioInner} />
            )}
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Full Sync</Text>
            <Text style={styles.optionDescription}>
              Complete transaction history
            </Text>
          </View>
          <View style={styles.optionBadge}>
            <Text style={styles.optionBadgeText}>📚</Text>
          </View>
        </View>
        <Text style={styles.optionDetails}>
          Download all available transaction history (may take longer)
        </Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Renders sync status information
   */
  const renderSyncInfo = () => (
    <View style={styles.infoSection}>
      {syncStatus?.lastSyncDate && (
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Last Sync:</Text>
          <Text style={styles.infoValue}>
            {formatDate(syncStatus.lastSyncDate)}
          </Text>
        </View>
      )}
      
      {syncStatus?.hasTransactions && (
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Latest Transaction:</Text>
          <Text style={styles.infoValue}>
            {syncStatus.latestTransactionDate 
              ? formatDate(syncStatus.latestTransactionDate)
              : 'N/A'
            }
          </Text>
        </View>
      )}
      
      <View style={styles.infoItem}>
        <Text style={styles.infoLabel}>Account Status:</Text>
        <Text style={[
          styles.infoValue,
          { color: syncStatus?.pennStateLinked ? theme.colors.success : theme.colors.error }
        ]}>
          {syncStatus?.pennStateLinked ? 'Connected' : 'Not Connected'}
        </Text>
      </View>
    </View>
  );

  /**
   * Renders recommendation banner
   */
  const renderRecommendation = () => (
    <View style={styles.recommendationBanner}>
      <Text style={styles.recommendationIcon}>💡</Text>
      <Text style={styles.recommendationText}>
        {getSyncRecommendation()}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Sync Transactions</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
            disabled={isSyncing}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Sync Status Info */}
          {renderSyncInfo()}

          {/* Recommendation */}
          {renderRecommendation()}

          {/* Sync Options */}
          {renderSyncOptions()}

          {/* Sync Process Info */}
          <View style={styles.processInfo}>
            <Text style={styles.processTitle}>What happens during sync?</Text>
            <View style={styles.processSteps}>
              <Text style={styles.processStep}>• Connect to Penn State Transact system</Text>
              <Text style={styles.processStep}>• Extract transaction data</Text>
              <Text style={styles.processStep}>• Process and store transactions</Text>
              <Text style={styles.processStep}>• Update your spending analytics</Text>
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          {!syncStatus?.pennStateLinked ? (
            <TouchableOpacity
              style={styles.linkAccountButton}
              onPress={() => {
                onClose();
                // TODO: Navigate to link account screen
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={theme.gradients.accent}
                style={styles.linkAccountButtonGradient}
              >
                <Text style={styles.linkAccountButtonText}>Link Penn State Account</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={styles.syncActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                activeOpacity={0.7}
                disabled={isSyncing}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
                onPress={handleSync}
                activeOpacity={0.8}
                disabled={isSyncing}
              >
                <LinearGradient
                  colors={theme.gradients.primary}
                  style={styles.syncButtonGradient}
                >
                  {isSyncing ? (
                    <View style={styles.syncingContainer}>
                      <ActivityIndicator size="small" color={theme.colors.textInverse} />
                      <Text style={styles.syncingText}>Syncing...</Text>
                    </View>
                  ) : (
                    <Text style={styles.syncButtonText}>
                      Start {syncOption === 'full' ? 'Full' : 'Quick'} Sync
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing['2xl'],
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.bold,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.layout.screenPadding,
  },
  infoSection: {
    marginTop: theme.spacing['2xl'],
    marginBottom: theme.spacing['2xl'],
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  infoLabel: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  infoValue: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.semibold,
  },
  recommendationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accentAlpha,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing['2xl'],
  },
  recommendationIcon: {
    fontSize: 20,
    marginRight: theme.spacing.lg,
  },
  recommendationText: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.sm,
  },
  optionsSection: {
    marginBottom: theme.spacing['2xl'],
  },
  optionsTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  optionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.sm,
  },
  optionCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryAlpha,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRadioSelected: {
    borderColor: theme.colors.primary,
  },
  optionRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  optionDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  optionBadge: {
    marginLeft: theme.spacing.lg,
  },
  optionBadgeText: {
    fontSize: 20,
  },
  optionDetails: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.sm,
  },
  processInfo: {
    marginBottom: theme.spacing['2xl'],
  },
  processTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  processSteps: {
    paddingLeft: theme.spacing.lg,
  },
  processStep: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.sm,
  },
  actionSection: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingVertical: theme.spacing['2xl'],
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  linkAccountButton: {
    marginBottom: theme.spacing.lg,
  },
  linkAccountButtonGradient: {
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
  },
  linkAccountButtonText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textInverse,
  },
  syncActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.lg,
    marginRight: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  syncButton: {
    flex: 2,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonGradient: {
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
  },
  syncButtonText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textInverse,
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncingText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textInverse,
    marginLeft: theme.spacing.sm,
  },
});

export default SyncTransactionsModal;