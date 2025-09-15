/**
 * Transaction Filters Component
 * File Path: components/TransactionFilters.tsx
 * 
 * Modal component for filtering transaction history with date ranges,
 * location search, account types, and amount filters.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';

/**
 * Transaction filters interface
 */
interface TransactionFilters {
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
 * Component props interface
 */
interface TransactionFiltersProps {
  onApplyFilters: (filters: TransactionFilters) => void;
  onClose: () => void;
  initialFilters?: TransactionFilters;
}

/**
 * Date range preset options
 */
const DATE_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 3 months', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'This year', days: null, isCurrentYear: true },
];

/**
 * Common account types
 */
const ACCOUNT_TYPES = [
  'Meal Plan',
  'Dining Dollars',
  'LionCash',
  'Flex Dollars',
];

/**
 * Common dining locations (this could be fetched from API)
 */
const POPULAR_LOCATIONS = [
  'Pollock Commons',
  'South Commons',
  'West Commons',
  'North Commons',
  'East Commons',
  'Findlay Commons',
  'Redifer Commons',
  'Warnock Commons',
];

/**
 * Transaction filters component
 */
export const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  onApplyFilters,
  onClose,
  initialFilters = {},
}) => {
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  /**
   * Updates filter state
   * @param updates - Partial filter updates
   */
  const updateFilters = (updates: Partial<TransactionFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  };

  /**
   * Formats date for input display
   * @param date - Date to format
   * @returns Formatted date string (YYYY-MM-DD)
   */
  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  /**
   * Parses date from input string
   * @param dateString - Date string from input
   * @returns Date object or null
   */
  const parseDateFromInput = (dateString: string): Date | null => {
    if (!dateString) return null;
    const date = new Date(dateString + 'T00:00:00');
    return isNaN(date.getTime()) ? null : date;
  };

  /**
   * Handles date preset selection
   * @param presetIndex - Index of selected preset
   */
  const handleDatePreset = (presetIndex: number) => {
    const preset = DATE_PRESETS[presetIndex];
    const endDate = new Date();
    let startDate: Date;

    if (preset.isCurrentYear) {
      startDate = new Date(endDate.getFullYear(), 0, 1); // January 1st of current year
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - preset.days!);
    }

    updateFilters({
      startDate,
      endDate,
    });

    setSelectedPreset(presetIndex);
    setUseCustomDates(false);
  };

  /**
   * Clears all filters
   */
  const clearAllFilters = () => {
    setFilters({});
    setSelectedPreset(null);
    setUseCustomDates(false);
  };

  /**
   * Validates and applies filters
   */
  const handleApplyFilters = () => {
    // Validate date range
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      Alert.alert('Invalid Date Range', 'Start date must be before end date.');
      return;
    }

    // Validate amount range
    if (filters.minAmount !== undefined && filters.maxAmount !== undefined && 
        filters.minAmount > filters.maxAmount) {
      Alert.alert('Invalid Amount Range', 'Minimum amount must be less than maximum amount.');
      return;
    }

    onApplyFilters(filters);
  };

  /**
   * Renders date filter section
   */
  const renderDateFilters = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Date Range</Text>
      
      {/* Date Presets */}
      <View style={styles.presetsContainer}>
        {DATE_PRESETS.map((preset, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.presetButton,
              selectedPreset === index && !useCustomDates && styles.presetButtonSelected,
            ]}
            onPress={() => handleDatePreset(index)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.presetButtonText,
              selectedPreset === index && !useCustomDates && styles.presetButtonTextSelected,
            ]}>
              {preset.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom Date Toggle */}
      <View style={styles.customDateToggle}>
        <Text style={styles.toggleLabel}>Use custom date range</Text>
        <Switch
          value={useCustomDates}
          onValueChange={(value) => {
            setUseCustomDates(value);
            if (value) {
              setSelectedPreset(null);
            }
          }}
          trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
          thumbColor={useCustomDates ? theme.colors.primary : theme.colors.textTertiary}
        />
      </View>

      {/* Custom Date Inputs */}
      {useCustomDates && (
        <View style={styles.dateInputsContainer}>
          <View style={styles.dateInputGroup}>
            <Text style={styles.inputLabel}>Start Date</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              value={filters.startDate ? formatDateForInput(filters.startDate) : ''}
              onChangeText={(text) => {
                const date = parseDateFromInput(text);
                updateFilters({ startDate: date || undefined });
              }}
            />
          </View>
          
          <View style={styles.dateInputGroup}>
            <Text style={styles.inputLabel}>End Date</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              value={filters.endDate ? formatDateForInput(filters.endDate) : ''}
              onChangeText={(text) => {
                const date = parseDateFromInput(text);
                updateFilters({ endDate: date || undefined });
              }}
            />
          </View>
        </View>
      )}
    </View>
  );

  /**
   * Renders location filter section
   */
  const renderLocationFilter = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Location</Text>
      
      <TextInput
        style={styles.textInput}
        placeholder="Search dining locations..."
        value={filters.location || ''}
        onChangeText={(text) => updateFilters({ location: text || undefined })}
        clearButtonMode="while-editing"
      />

      {/* Popular Locations */}
      <Text style={styles.subsectionTitle}>Popular Locations</Text>
      <View style={styles.locationTagsContainer}>
        {POPULAR_LOCATIONS.map((location, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.locationTag,
              filters.location === location && styles.locationTagSelected,
            ]}
            onPress={() => updateFilters({ 
              location: filters.location === location ? undefined : location 
            })}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.locationTagText,
              filters.location === location && styles.locationTagTextSelected,
            ]}>
              {location}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  /**
   * Renders account type filter section
   */
  const renderAccountTypeFilter = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Account Type</Text>
      
      <View style={styles.accountTypesContainer}>
        {ACCOUNT_TYPES.map((accountType, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.accountTypeButton,
              filters.accountType === accountType && styles.accountTypeButtonSelected,
            ]}
            onPress={() => updateFilters({ 
              accountType: filters.accountType === accountType ? undefined : accountType 
            })}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.accountTypeButtonText,
              filters.accountType === accountType && styles.accountTypeButtonTextSelected,
            ]}>
              {accountType}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  /**
   * Renders amount filter section
   */
  const renderAmountFilter = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Amount Range</Text>
      
      <View style={styles.amountInputsContainer}>
        <View style={styles.amountInputGroup}>
          <Text style={styles.inputLabel}>Min Amount</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="$0.00"
            keyboardType="decimal-pad"
            value={filters.minAmount?.toString() || ''}
            onChangeText={(text) => {
              const amount = parseFloat(text) || undefined;
              updateFilters({ minAmount: amount });
            }}
          />
        </View>
        
        <Text style={styles.amountSeparator}>to</Text>
        
        <View style={styles.amountInputGroup}>
          <Text style={styles.inputLabel}>Max Amount</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="$999.99"
            keyboardType="decimal-pad"
            value={filters.maxAmount?.toString() || ''}
            onChangeText={(text) => {
              const amount = parseFloat(text) || undefined;
              updateFilters({ maxAmount: amount });
            }}
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Filter Transactions</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      </View>

      {/* Filters Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderDateFilters()}
        {renderLocationFilter()}
        {renderAccountTypeFilter()}
        {renderAmountFilter()}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={clearAllFilters}
          activeOpacity={0.7}
        >
          <Text style={styles.clearButtonText}>Clear All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.applyButton}
          onPress={handleApplyFilters}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={theme.gradients.primary}
            style={styles.applyButtonGradient}
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
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
  content: {
    flex: 1,
    paddingHorizontal: theme.layout.screenPadding,
  },
  section: {
    marginTop: theme.spacing['2xl'],
    marginBottom: theme.spacing['2xl'],
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  subsectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.lg,
  },
  presetButton: {
    backgroundColor: theme.colors.surfaceSecondary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  presetButtonSelected: {
    backgroundColor: theme.colors.primaryAlpha,
    borderColor: theme.colors.primary,
  },
  presetButtonText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  presetButtonTextSelected: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  customDateToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  toggleLabel: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.medium,
  },
  dateInputsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateInputGroup: {
    flex: 1,
    marginRight: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  dateInput: {
    ...theme.components.input.default,
    fontSize: theme.typography.sizes.base,
  },
  textInput: {
    ...theme.components.input.default,
    fontSize: theme.typography.sizes.base,
    marginBottom: theme.spacing.lg,
  },
  locationTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  locationTag: {
    backgroundColor: theme.colors.surfaceSecondary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  locationTagSelected: {
    backgroundColor: theme.colors.accentAlpha,
    borderColor: theme.colors.accent,
  },
  locationTagText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  locationTagTextSelected: {
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.semibold,
  },
  accountTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  accountTypeButton: {
    backgroundColor: theme.colors.surfaceSecondary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 100,
    alignItems: 'center',
  },
  accountTypeButtonSelected: {
    backgroundColor: theme.colors.primaryAlpha,
    borderColor: theme.colors.primary,
  },
  accountTypeButtonText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  accountTypeButtonTextSelected: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  amountInputsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  amountInputGroup: {
    flex: 1,
  },
  amountInput: {
    ...theme.components.input.default,
    fontSize: theme.typography.sizes.base,
  },
  amountSeparator: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  actionSection: {
    flexDirection: 'row',
    paddingHorizontal: theme.layout.screenPadding,
    paddingVertical: theme.spacing['2xl'],
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  clearButton: {
    flex: 1,
    paddingVertical: theme.spacing.lg,
    marginRight: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  applyButton: {
    flex: 2,
  },
  applyButtonGradient: {
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textInverse,
  },
});

export default TransactionFilters;