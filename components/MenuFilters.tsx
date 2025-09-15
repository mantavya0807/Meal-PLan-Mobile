/**
 * Menu Filters Component
 * File Path: components/MenuFilters.tsx
 * 
 * Advanced filtering modal for menu items with dietary preferences,
 * nutrition ranges, allergen exclusions, and search capabilities.
 */

import React, { useState, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { theme } from '../constants/theme';

/**
 * Filter configuration interface
 */
interface MenuFilters {
  categories?: string[];
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  excludeAllergens?: string[];
  minCalories?: number;
  maxCalories?: number;
  minProtein?: number;
  maxProtein?: number;
  maxSodium?: number;
  search?: string;
}

/**
 * Component props interface
 */
interface MenuFiltersProps {
  onClose: () => void;
  onApplyFilters: (filters: MenuFilters) => void;
  initialFilters?: MenuFilters;
}

/**
 * Common allergens list
 */
const COMMON_ALLERGENS = [
  'Milk', 'Eggs', 'Fish', 'Shellfish', 'Tree Nuts', 'Peanuts', 'Wheat', 'Soy'
];

/**
 * Common food categories
 */
const FOOD_CATEGORIES = [
  'Main Course', 'Sides', 'Salads', 'Soups', 'Pizza', 'Sandwiches', 
  'Grill Items', 'Pasta', 'Desserts', 'Beverages'
];

/**
 * Menu filters component
 */
const MenuFilters: React.FC<MenuFiltersProps> = memo(({
  onClose,
  onApplyFilters,
  initialFilters = {},
}) => {
  
  // Filter state
  const [filters, setFilters] = useState<MenuFilters>(initialFilters);
  
  /**
   * Updates filter state
   * @param updates - Partial filter updates
   */
  const updateFilters = (updates: Partial<MenuFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  };

  /**
   * Toggles category selection
   * @param category - Category to toggle
   */
  const toggleCategory = (category: string) => {
    const currentCategories = filters.categories || [];
    const updatedCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];
    
    updateFilters({ categories: updatedCategories.length > 0 ? updatedCategories : undefined });
  };

  /**
   * Toggles allergen exclusion
   * @param allergen - Allergen to toggle
   */
  const toggleAllergenExclusion = (allergen: string) => {
    const currentExclusions = filters.excludeAllergens || [];
    const updatedExclusions = currentExclusions.includes(allergen)
      ? currentExclusions.filter(a => a !== allergen)
      : [...currentExclusions, allergen];
    
    updateFilters({ excludeAllergens: updatedExclusions.length > 0 ? updatedExclusions : undefined });
  };

  /**
   * Resets all filters
   */
  const resetFilters = () => {
    setFilters({});
  };

  /**
   * Applies filters and closes modal
   */
  const applyFilters = () => {
    // Validate numeric ranges
    if (filters.minCalories && filters.maxCalories && filters.minCalories > filters.maxCalories) {
      Alert.alert('Invalid Range', 'Minimum calories cannot be greater than maximum calories');
      return;
    }
    
    if (filters.minProtein && filters.maxProtein && filters.minProtein > filters.maxProtein) {
      Alert.alert('Invalid Range', 'Minimum protein cannot be greater than maximum protein');
      return;
    }

    onApplyFilters(filters);
    onClose();
  };

  /**
   * Gets active filter count
   */
  const getActiveFilterCount = (): number => {
    let count = 0;
    
    if (filters.categories?.length) count++;
    if (filters.isVegetarian) count++;
    if (filters.isVegan) count++;
    if (filters.isGlutenFree) count++;
    if (filters.excludeAllergens?.length) count++;
    if (filters.minCalories || filters.maxCalories) count++;
    if (filters.minProtein || filters.maxProtein) count++;
    if (filters.maxSodium) count++;
    if (filters.search?.trim()) count++;
    
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
  colors={[theme.colors.primary, theme.colors.primaryLight]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Menu Filters</Text>
            <Text style={styles.headerSubtitle}>
              {activeFilterCount > 0 
                ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`
                : 'Customize your menu search'
              }
            </Text>
          </View>
          
          <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        
        {/* Search */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔍 Search</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search menu items..."
            value={filters.search || ''}
            onChangeText={(text) => updateFilters({ search: text || undefined })}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Dietary Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌱 Dietary Preferences</Text>
          
          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <Text style={styles.switchLabel}>Vegetarian Only</Text>
              <Text style={styles.switchDescription}>No meat, poultry, or fish</Text>
            </View>
            <Switch
              value={filters.isVegetarian || false}
              onValueChange={(value) => updateFilters({ isVegetarian: value || undefined })}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.success + '40' }}
              thumbColor={filters.isVegetarian ? theme.colors.success : theme.colors.textSecondary}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <Text style={styles.switchLabel}>Vegan Only</Text>
              <Text style={styles.switchDescription}>No animal products</Text>
            </View>
            <Switch
              value={filters.isVegan || false}
              onValueChange={(value) => updateFilters({ isVegan: value || undefined })}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.success + '40' }}
              thumbColor={filters.isVegan ? theme.colors.success : theme.colors.textSecondary}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <Text style={styles.switchLabel}>Gluten Free Only</Text>
              <Text style={styles.switchDescription}>No wheat, barley, or rye</Text>
            </View>
            <Switch
              value={filters.isGlutenFree || false}
              onValueChange={(value) => updateFilters({ isGlutenFree: value || undefined })}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.info + '40' }}
              thumbColor={filters.isGlutenFree ? theme.colors.info : theme.colors.textSecondary}
            />
          </View>
        </View>

        {/* Food Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🍽️ Food Categories</Text>
          <View style={styles.categoryGrid}>
            {FOOD_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  filters.categories?.includes(category) && styles.categoryChipSelected,
                ]}
                onPress={() => toggleCategory(category)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.categoryChipText,
                  filters.categories?.includes(category) && styles.categoryChipTextSelected,
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Allergen Exclusions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Exclude Allergens</Text>
          <Text style={styles.sectionDescription}>
            Hide items containing these allergens
          </Text>
          
          <View style={styles.allergenGrid}>
            {COMMON_ALLERGENS.map((allergen) => (
              <TouchableOpacity
                key={allergen}
                style={[
                  styles.allergenChip,
                  filters.excludeAllergens?.includes(allergen) && styles.allergenChipSelected,
                ]}
                onPress={() => toggleAllergenExclusion(allergen)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.allergenChipText,
                  filters.excludeAllergens?.includes(allergen) && styles.allergenChipTextSelected,
                ]}>
                  {allergen}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Nutrition Ranges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Nutrition Ranges</Text>
          
          {/* Calories */}
          <View style={styles.rangeGroup}>
            <Text style={styles.rangeLabel}>Calories</Text>
            <View style={styles.rangeInputs}>
              <TextInput
                style={styles.rangeInput}
                placeholder="Min"
                value={filters.minCalories?.toString() || ''}
                onChangeText={(text) => {
                  const value = parseInt(text) || undefined;
                  updateFilters({ minCalories: value });
                }}
                keyboardType="numeric"
                maxLength={4}
              />
              <Text style={styles.rangeSeparator}>to</Text>
              <TextInput
                style={styles.rangeInput}
                placeholder="Max"
                value={filters.maxCalories?.toString() || ''}
                onChangeText={(text) => {
                  const value = parseInt(text) || undefined;
                  updateFilters({ maxCalories: value });
                }}
                keyboardType="numeric"
                maxLength={4}
              />
              <Text style={styles.rangeUnit}>cal</Text>
            </View>
          </View>

          {/* Protein */}
          <View style={styles.rangeGroup}>
            <Text style={styles.rangeLabel}>Protein</Text>
            <View style={styles.rangeInputs}>
              <TextInput
                style={styles.rangeInput}
                placeholder="Min"
                value={filters.minProtein?.toString() || ''}
                onChangeText={(text) => {
                  const value = parseInt(text) || undefined;
                  updateFilters({ minProtein: value });
                }}
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={styles.rangeSeparator}>to</Text>
              <TextInput
                style={styles.rangeInput}
                placeholder="Max"
                value={filters.maxProtein?.toString() || ''}
                onChangeText={(text) => {
                  const value = parseInt(text) || undefined;
                  updateFilters({ maxProtein: value });
                }}
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={styles.rangeUnit}>g</Text>
            </View>
          </View>

          {/* Sodium */}
          <View style={styles.rangeGroup}>
            <Text style={styles.rangeLabel}>Sodium (max)</Text>
            <View style={styles.rangeInputs}>
              <TextInput
                style={[styles.rangeInput, { flex: 1 }]}
                placeholder="Maximum sodium content"
                value={filters.maxSodium?.toString() || ''}
                onChangeText={(text) => {
                  const value = parseInt(text) || undefined;
                  updateFilters({ maxSodium: value });
                }}
                keyboardType="numeric"
                maxLength={4}
              />
              <Text style={styles.rangeUnit}>mg</Text>
            </View>
          </View>
        </View>

        {/* Bottom spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Footer with action buttons */}
      <BlurView intensity={95} style={styles.footer}>
        <View style={styles.footerButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.primaryLight]}
              style={styles.applyButtonGradient}
            >
              <Text style={styles.applyButtonText}>
                Apply{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </BlurView>
    </SafeAreaView>
  );
});

MenuFilters.displayName = 'MenuFilters';

/**
 * Component styles
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  header: {
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },

  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },

  closeButtonText: {
  color: theme.colors.textInverse,
  fontSize: theme.typography.sizes.lg,
  fontWeight: theme.typography.weights.bold,
  },

  headerInfo: {
    flex: 1,
  },

  headerTitle: {
  color: theme.colors.textInverse,
  fontSize: theme.typography.sizes.xl,
  fontWeight: theme.typography.weights.bold,
  },

  headerSubtitle: {
  color: theme.colors.textInverse,
  fontSize: theme.typography.sizes.sm,
  opacity: 0.9,
  marginTop: theme.spacing.xs,
  },

  resetButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  resetButtonText: {
  color: theme.colors.textInverse,
  fontSize: theme.typography.sizes.sm,
  fontWeight: theme.typography.weights.medium,
  },

  scrollView: {
    flex: 1,
  },

  section: {
    margin: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },

  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },

  sectionDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },

  searchInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  fontSize: theme.typography.sizes.base,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },

  switchLeft: {
    flex: 1,
    marginRight: theme.spacing.md,
  },

  switchLabel: {
  fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textPrimary,
  },

  switchDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },

  categoryChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },

  categoryChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },

  categoryChipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
  },

  categoryChipTextSelected: {
  color: theme.colors.textInverse,
  fontWeight: theme.typography.weights.medium,
  },

  allergenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },

  allergenChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },

  allergenChipSelected: {
    backgroundColor: theme.colors.error,
    borderColor: theme.colors.error,
  },

  allergenChipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
  },

  allergenChipTextSelected: {
  color: theme.colors.textInverse,
  fontWeight: theme.typography.weights.medium,
  },

  rangeGroup: {
    marginBottom: theme.spacing.md,
  },

  rangeLabel: {
  fontSize: theme.typography.sizes.base,
  fontWeight: theme.typography.weights.medium,
  color: theme.colors.textPrimary,
  marginBottom: theme.spacing.sm,
  },

  rangeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },

  rangeInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    textAlign: 'center',
  },

  rangeSeparator: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    paddingHorizontal: theme.spacing.xs,
  },

  rangeUnit: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    minWidth: 30,
  },

  bottomSpacer: {
    height: 100,
  },

  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },

  footerButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },

  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.borderLight,
  },

  cancelButtonText: {
    color: theme.colors.textSecondary,
  fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
  },

  applyButton: {
    flex: 2,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },

  applyButtonGradient: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },

  applyButtonText: {
  color: theme.colors.textInverse,
  fontSize: theme.typography.sizes.base,
  fontWeight: theme.typography.weights.bold,
  },
});

export default MenuFilters;