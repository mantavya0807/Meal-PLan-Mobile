/**
 * Transaction Item Component
 * File Path: components/TransactionItem.tsx
 * 
 * Individual transaction display component with modern styling and comprehensive information.
 * Shows transaction details, amount, location, and date in a clean card format.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

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
 * Component props interface
 */
interface TransactionItemProps {
  transaction: Transaction;
  onPress?: () => void;
}

/**
 * Individual transaction item component
 */
export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onPress,
}) => {
  /**
   * Formats the transaction date for display
   * @param dateString - ISO date string
   * @returns Formatted date string
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  /**
   * Formats the transaction time
   * @param dateString - ISO date string
   * @returns Formatted time string
   */
  const formatTime = (dateString: string): string => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  /**
   * Formats currency amounts
   * @param amount - Amount to format
   * @returns Formatted currency string with sign
   */
  const formatAmount = (amount: number): string => {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '+' : '-'; // Negative amount = money spent (debit), positive = refund (credit)
    return `${sign}$${abs.toFixed(2)}`;
  };

  /**
   * Gets the appropriate color for the amount based on transaction type
   * @param amount - Transaction amount
   * @returns Color string
   */
  const getAmountColor = (amount: number): string => {
    return amount < 0 ? theme.colors.success : theme.colors.error; // Negative = credit (green), positive = debit (red)
  };

  /**
   * Gets dining location emoji based on location name
   * @param location - Location name
   * @returns Appropriate emoji
   */
  const getLocationEmoji = (location: string): string => {
    const loc = location.toLowerCase();
    
    if (loc.includes('market') || loc.includes('store') || loc.includes('shop')) {
      return '🏪';
    } else if (loc.includes('cafe') || loc.includes('coffee')) {
      return '☕';
    } else if (loc.includes('pizza')) {
      return '🍕';
    } else if (loc.includes('grill') || loc.includes('burger')) {
      return '🍔';
    } else if (loc.includes('dining') || loc.includes('hall')) {
      return '🍽️';
    } else if (loc.includes('food') || loc.includes('court')) {
      return '🍱';
    } else {
      return '🍽️'; // Default dining emoji
    }
  };

  /**
   * Truncates location name if too long
   * @param location - Location name
   * @returns Truncated location name
   */
  const truncateLocation = (location: string): string => {
    return location.length > 25 ? `${location.substring(0, 25)}...` : location;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.content}>
        {/* Transaction Icon and Location */}
        <View style={styles.leftSection}>
          <View style={styles.iconContainer}>
            <Text style={styles.locationEmoji}>
              {getLocationEmoji(transaction.location)}
            </Text>
          </View>
          
          <View style={styles.locationInfo}>
            <Text style={styles.locationName}>
              {truncateLocation(transaction.location)}
            </Text>
            <View style={styles.detailsRow}>
              <Text style={styles.dateText}>
                {formatDate(transaction.date)}
              </Text>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.timeText}>
                {formatTime(transaction.date)}
              </Text>
            </View>
            
            {/* Additional transaction details */}
            {transaction.description && (
              <Text style={styles.description}>
                {transaction.description}
              </Text>
            )}
            
            {transaction.accountType && (
              <View style={styles.accountTypeContainer}>
                <Text style={styles.accountType}>
                  {transaction.accountType}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Amount and Balance */}
        <View style={styles.rightSection}>
          <Text style={[styles.amount, { color: getAmountColor(transaction.amount) }]}>
            {formatAmount(transaction.amount)}
          </Text>
          
          {transaction.balanceAfter !== null && transaction.balanceAfter !== undefined && (
            <Text style={styles.balanceText}>
              Balance: ${transaction.balanceAfter.toFixed(2)}
            </Text>
          )}
          
          {transaction.cardNumber && (
            <Text style={styles.cardNumber}>
              {transaction.cardNumber}
            </Text>
          )}
        </View>
      </View>

      {/* Subtle divider */}
      <View style={styles.divider} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
  },
  locationEmoji: {
    fontSize: 20,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  dateText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  separator: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textTertiary,
    marginHorizontal: theme.spacing.xs,
  },
  timeText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  description: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.xs,
  },
  accountTypeContainer: {
    alignSelf: 'flex-start',
  },
  accountType: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.medium,
    backgroundColor: theme.colors.accentAlpha,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs / 2,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.xs,
  },
  balanceText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs / 2,
  },
  cardNumber: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textTertiary,
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: theme.spacing.lg,
  },
});

export default TransactionItem;