/**
 * Transaction Stats Component
 * File Path: components/TransactionStats.tsx
 * 
 * Modal component displaying comprehensive transaction analytics including
 * spending patterns, top locations, monthly breakdowns, and insights.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';
import { apiService } from '../services/api';

/**
 * Transaction statistics interface
 */
interface TransactionStats {
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

/**
 * Component props interface
 */
interface TransactionStatsProps {
  onClose: () => void;
}

/**
 * Time period options for statistics
 */
const TIME_PERIODS = [
  { label: '30 Days', days: 30 },
  { label: '3 Months', days: 90 },
  { label: '6 Months', days: 180 },
  { label: 'Year', days: 365 },
];

/**
 * Transaction statistics component
 */
export const TransactionStats: React.FC<TransactionStatsProps> = ({
  onClose,
}) => {
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(0);
  const [error, setError] = useState('');

  /**
   * Screen width for responsive layout
   */
  const screenWidth = Dimensions.get('window').width;

  /**
   * Loads statistics from the API
   */
  const loadStats = async () => {
    try {
      setIsLoading(true);
      setError('');

      const period = TIME_PERIODS[selectedPeriod];
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - period.days);

        const [statsResponse, monthlyResponse] = await Promise.all([
          apiService.get(`/penn-state/transactions/stats?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`),
          apiService.get(`/penn-state/transactions/monthly?months=${Math.ceil(period.days / 30)}`)
        ]);      if (statsResponse.success && monthlyResponse.success) {
        setStats(statsResponse.data.statistics);
        setMonthlyData(monthlyResponse.data.monthlySpending);
      } else {
        throw new Error(statsResponse.message || monthlyResponse.message || 'Failed to load statistics');
      }
    } catch (error: any) {
      console.error('Error loading stats:', error);
      setError(error.message || 'Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Formats currency amounts
   * @param amount - Amount to format
   * @returns Formatted currency string
   */
  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

  /**
   * Formats month display name
   * @param monthString - Month in YYYY-MM format
   * @returns Formatted month name
   */
  const formatMonth = (monthString: string): string => {
    const [year, month] = monthString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  /**
   * Gets spending trend emoji
   * @param current - Current month spending
   * @param previous - Previous month spending
   * @returns Trend emoji
   */
  const getTrendEmoji = (current: number, previous: number): string => {
    if (current > previous * 1.1) return '📈'; // Significant increase
    if (current < previous * 0.9) return '📉'; // Significant decrease
    return '📊'; // Stable
  };

  /**
   * Renders overview cards
   */
  const renderOverviewCards = () => {
    if (!stats) return null;

    const overviewData = [
      {
        title: 'Total Spent',
        value: formatCurrency(stats.totalSpent),
        subtitle: `${TIME_PERIODS[selectedPeriod].label.toLowerCase()}`,
        icon: '💰',
        color: theme.colors.error,
      },
      {
        title: 'Transactions',
        value: stats.totalTransactions.toString(),
        subtitle: 'total purchases',
        icon: '🧾',
        color: theme.colors.accent,
      },
      {
        title: 'Average',
        value: formatCurrency(stats.averageTransaction),
        subtitle: 'per transaction',
        icon: '📊',
        color: theme.colors.success,
      },
      {
        title: 'Top Location',
        value: stats.topLocations[0]?.location || 'N/A',
        subtitle: stats.topLocations[0] ? `${stats.topLocations[0].visitCount} visits` : '',
        icon: '🏆',
        color: theme.colors.warning,
      },
    ];

    return (
      <View style={styles.overviewSection}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.overviewGrid}>
          {overviewData.map((item, index) => (
            <View key={index} style={styles.overviewCard}>
              <View style={styles.overviewHeader}>
                <Text style={styles.overviewIcon}>{item.icon}</Text>
                <Text style={styles.overviewTitle}>{item.title}</Text>
              </View>
              <Text style={[styles.overviewValue, { color: item.color }]}>
                {item.value}
              </Text>
              {item.subtitle && (
                <Text style={styles.overviewSubtitle}>{item.subtitle}</Text>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  /**
   * Renders monthly spending chart
   */
  const renderMonthlyChart = () => {
    if (!monthlyData || monthlyData.length === 0) return null;

    const maxSpending = Math.max(...monthlyData.map(m => m.totalSpent));
    
    return (
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>Monthly Spending</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
          <View style={styles.chartContainer}>
            {monthlyData.map((month, index) => {
              const height = maxSpending > 0 ? (month.totalSpent / maxSpending) * 120 : 0;
              const previousMonth = monthlyData[index + 1];
              const trend = previousMonth ? getTrendEmoji(month.totalSpent, previousMonth.totalSpent) : '📊';
              
              return (
                <View key={month.month} style={styles.chartBar}>
                  <View style={styles.chartBarContainer}>
                    <LinearGradient
                      colors={[theme.colors.primary, theme.colors.primaryLight]}
                      style={[styles.chartBarFill, { height }]}
                    />
                  </View>
                  <Text style={styles.chartAmount}>{formatCurrency(month.totalSpent)}</Text>
                  <Text style={styles.chartLabel}>{formatMonth(month.month)}</Text>
                  <Text style={styles.chartTrend}>{trend}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  /**
   * Renders top locations
   */
  const renderTopLocations = () => {
    if (!stats?.topLocations || stats.topLocations.length === 0) return null;

    return (
      <View style={styles.locationsSection}>
        <Text style={styles.sectionTitle}>Top Dining Locations</Text>
        {stats.topLocations.slice(0, 5).map((location, index) => {
          const percentage = stats.totalSpent > 0 ? (location.totalSpent / stats.totalSpent) * 100 : 0;
          
          return (
            <View key={index} style={styles.locationItem}>
              <View style={styles.locationInfo}>
                <View style={styles.locationRank}>
                  <Text style={styles.locationRankText}>{index + 1}</Text>
                </View>
                <View style={styles.locationDetails}>
                  <Text style={styles.locationName}>{location.location}</Text>
                  <Text style={styles.locationStats}>
                    {location.visitCount} visits • {formatCurrency(location.averagePerVisit)} avg
                  </Text>
                </View>
              </View>
              
              <View style={styles.locationSpending}>
                <Text style={styles.locationAmount}>
                  {formatCurrency(location.totalSpent)}
                </Text>
                <View style={styles.locationPercentageBar}>
                  <View 
                    style={[
                      styles.locationPercentageFill, 
                      { width: `${Math.min(percentage, 100)}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.locationPercentage}>
                  {percentage.toFixed(0)}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  /**
   * Renders spending insights
   */
  const renderInsights = () => {
    if (!stats || !monthlyData) return null;

    const insights = [];
    
    // Average daily spending
    const period = TIME_PERIODS[selectedPeriod];
    const dailyAverage = stats.totalSpent / period.days;
    insights.push(`You spend an average of ${formatCurrency(dailyAverage)} per day on dining.`);
    
    // Most frequent location
    if (stats.topLocations[0]) {
      const topLocation = stats.topLocations[0];
      insights.push(`${topLocation.location} is your go-to spot with ${topLocation.visitCount} visits.`);
    }
    
    // Transaction frequency
    const transactionFrequency = stats.totalTransactions / period.days;
    if (transactionFrequency >= 1) {
      insights.push(`You make about ${transactionFrequency.toFixed(1)} dining transactions per day.`);
    } else {
      insights.push(`You dine out about ${(transactionFrequency * 7).toFixed(1)} times per week.`);
    }
    
    // Monthly trend
    if (monthlyData.length >= 2) {
      const recent = monthlyData[0];
      const previous = monthlyData[1];
      const change = ((recent.totalSpent - previous.totalSpent) / previous.totalSpent) * 100;
      
      if (Math.abs(change) > 10) {
        const direction = change > 0 ? 'increased' : 'decreased';
        insights.push(`Your spending has ${direction} by ${Math.abs(change).toFixed(0)}% compared to last month.`);
      }
    }

    return (
      <View style={styles.insightsSection}>
        <Text style={styles.sectionTitle}>Insights</Text>
        {insights.map((insight, index) => (
          <View key={index} style={styles.insightItem}>
            <Text style={styles.insightBullet}>💡</Text>
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        ))}
      </View>
    );
  };

  /**
   * Initialize component
   */
  useEffect(() => {
    loadStats();
  }, [selectedPeriod]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Spending Analytics</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      </View>

      {/* Time Period Selector */}
      <View style={styles.periodSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TIME_PERIODS.map((period, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.periodButton,
                selectedPeriod === index && styles.periodButtonSelected,
              ]}
              onPress={() => setSelectedPeriod(index)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === index && styles.periodButtonTextSelected,
              ]}>
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadStats}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderOverviewCards()}
          {renderMonthlyChart()}
          {renderTopLocations()}
          {renderInsights()}
        </ScrollView>
      )}
    </View>
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
  periodSelector: {
    paddingVertical: theme.spacing.lg,
    paddingLeft: theme.layout.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  periodButton: {
    backgroundColor: theme.colors.surfaceSecondary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  periodButtonSelected: {
    backgroundColor: theme.colors.primaryAlpha,
    borderColor: theme.colors.primary,
  },
  periodButtonText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  periodButtonTextSelected: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.layout.screenPadding,
  },
  errorText: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
  },
  retryButtonText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textInverse,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.layout.screenPadding,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  
  // Overview Cards
  overviewSection: {
    marginTop: theme.spacing['2xl'],
    marginBottom: theme.spacing['2xl'],
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  overviewCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  overviewIcon: {
    fontSize: 16,
    marginRight: theme.spacing.sm,
  },
  overviewTitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  overviewValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.xs,
  },
  overviewSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textTertiary,
  },

  // Monthly Chart
  chartSection: {
    marginBottom: theme.spacing['2xl'],
  },
  chartScroll: {
    marginLeft: -theme.layout.screenPadding,
  },
  chartContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.layout.screenPadding,
  },
  chartBar: {
    alignItems: 'center',
    marginRight: theme.spacing.lg,
    width: 60,
  },
  chartBarContainer: {
    height: 120,
    width: 20,
    backgroundColor: theme.colors.borderLight,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'flex-end',
    marginBottom: theme.spacing.sm,
  },
  chartBarFill: {
    width: '100%',
    borderRadius: theme.borderRadius.sm,
  },
  chartAmount: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.semibold,
    marginBottom: theme.spacing.xs,
  },
  chartLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  chartTrend: {
    fontSize: 12,
  },

  // Top Locations
  locationsSection: {
    marginBottom: theme.spacing['2xl'],
  },
  locationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryAlpha,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
  },
  locationRankText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  locationDetails: {
    flex: 1,
  },
  locationName: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  locationStats: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  locationSpending: {
    alignItems: 'flex-end',
  },
  locationAmount: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  locationPercentageBar: {
    width: 60,
    height: 4,
    backgroundColor: theme.colors.borderLight,
    borderRadius: 2,
    marginBottom: theme.spacing.xs,
  },
  locationPercentageFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  locationPercentage: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textTertiary,
  },

  // Insights
  insightsSection: {
    marginBottom: theme.spacing['4xl'],
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  insightBullet: {
    fontSize: 16,
    marginRight: theme.spacing.lg,
    marginTop: 2,
  },
  insightText: {
    flex: 1,
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textPrimary,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.base,
  },
});

export default TransactionStats;