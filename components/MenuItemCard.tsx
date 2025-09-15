/**
 * Menu Item Card Component
 * File Path: components/MenuItemCard.tsx
 * 
 * Interactive card component for displaying menu items with nutrition info,
 * dietary indicators, and favorite functionality in a modern design.
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';

/**
 * Menu item interface
 */
interface MenuItem {
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
  protein?: number;
  totalCarbs?: number;
  sodium?: number;
  servingSize?: string;
  ingredients?: string;
  allergens?: string[];
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isFavorite?: boolean;
}

/**
 * Component props interface
 */
interface MenuItemCardProps {
  menuItem: MenuItem;
  onToggleFavorite: () => void;
  onShowNutrition: () => void;
  style?: ViewStyle;
}

/**
 * Menu item card component
 */
const MenuItemCard: React.FC<MenuItemCardProps> = memo(({
  menuItem,
  onToggleFavorite,
  onShowNutrition,
  style,
}) => {
  
  /**
   * Gets dietary badge color based on type
   * @param type - Dietary type
   * @returns Color string
   */
  const getDietaryBadgeColor = (type: 'vegetarian' | 'vegan' | 'glutenFree'): string => {
    switch (type) {
      case 'vegan': return '#22c55e'; // Green
      case 'vegetarian': return '#84cc16'; // Light green
      case 'glutenFree': return '#3b82f6'; // Blue
      default: return theme.colors.primary;
    }
  };

  /**
   * Gets food category emoji
   * @param category - Food category
   * @returns Emoji string
   */
  const getCategoryEmoji = (category?: string): string => {
    if (!category) return '🍽️';
    
    const cat = category.toLowerCase();
    if (cat.includes('pizza')) return '🍕';
    if (cat.includes('burger') || cat.includes('sandwich')) return '🍔';
    if (cat.includes('salad')) return '🥗';
    if (cat.includes('pasta')) return '🍝';
    if (cat.includes('soup')) return '🍲';
    if (cat.includes('dessert') || cat.includes('sweet')) return '🍰';
    if (cat.includes('drink') || cat.includes('beverage')) return '🥤';
    if (cat.includes('breakfast')) return '🥞';
    if (cat.includes('grill')) return '🍖';
    if (cat.includes('seafood') || cat.includes('fish')) return '🐟';
    return '🍽️';
  };

  /**
   * Formats nutrition value with unit
   * @param value - Nutrition value
   * @param unit - Unit string
   * @returns Formatted string
   */
  const formatNutritionValue = (value?: number, unit: string = ''): string => {
    if (value === undefined || value === null) return 'N/A';
    return `${value}${unit}`;
  };

  /**
   * Gets allergen warning color
   * @param allergens - Array of allergens
   * @returns Color string or null
   */
  const getAllergenWarningColor = (allergens?: string[]): string | null => {
    if (!allergens || allergens.length === 0) return null;
    
    // Common serious allergens
    const seriousAllergens = ['peanuts', 'tree nuts', 'shellfish', 'fish', 'eggs', 'milk'];
    const hasSerious = allergens.some(allergen => 
      seriousAllergens.some(serious => allergen.toLowerCase().includes(serious))
    );
    
    return hasSerious ? theme.colors.warning : theme.colors.info;
  };

  const allergenColor = getAllergenWarningColor(menuItem.allergens);
  const hasNutritionData = Boolean(menuItem.calories);

  return (
    <View style={[styles.container, style]}>
      {/* Main card content */}
      <TouchableOpacity
        style={styles.cardContainer}
        onPress={onShowNutrition}
        activeOpacity={0.7}
      >
        {/* Card background gradient */}
        <LinearGradient
          colors={[theme.colors.surface, theme.colors.background]}
          style={styles.cardGradient}
        >
          {/* Header section */}
          <View style={styles.headerSection}>
            <View style={styles.titleRow}>
              <Text style={styles.categoryEmoji}>{getCategoryEmoji(menuItem.category)}</Text>
              <Text style={styles.itemName} numberOfLines={2}>
                {menuItem.name}
              </Text>
              <TouchableOpacity
                style={styles.favoriteButton}
                onPress={onToggleFavorite}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[
                  styles.favoriteIcon,
                  { color: menuItem.isFavorite ? theme.colors.error : theme.colors.textTertiary }
                ]}>
                  {menuItem.isFavorite ? '❤️' : '🤍'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Category and serving size */}
            {(menuItem.category || menuItem.servingSize) && (
              <View style={styles.metadataRow}>
                {menuItem.category && (
                  <Text style={styles.category}>{menuItem.category}</Text>
                )}
                {menuItem.servingSize && (
                  <Text style={styles.servingSize}>Serving: {menuItem.servingSize}</Text>
                )}
              </View>
            )}
          </View>

          {/* Nutrition summary */}
          {hasNutritionData && (
            <View style={styles.nutritionSection}>
              <View style={styles.nutritionRow}>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>
                    {formatNutritionValue(menuItem.calories)}
                  </Text>
                  <Text style={styles.nutritionLabel}>cal</Text>
                </View>
                
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>
                    {formatNutritionValue(menuItem.protein, 'g')}
                  </Text>
                  <Text style={styles.nutritionLabel}>protein</Text>
                </View>
                
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>
                    {formatNutritionValue(menuItem.totalCarbs, 'g')}
                  </Text>
                  <Text style={styles.nutritionLabel}>carbs</Text>
                </View>
                
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>
                    {formatNutritionValue(menuItem.totalFat, 'g')}
                  </Text>
                  <Text style={styles.nutritionLabel}>fat</Text>
                </View>
              </View>
            </View>
          )}

          {/* Dietary badges and allergen info */}
          <View style={styles.footerSection}>
            {/* Dietary badges */}
            <View style={styles.dietaryBadges}>
              {menuItem.isVegan && (
                <View style={[styles.dietaryBadge, { backgroundColor: getDietaryBadgeColor('vegan') }]}>
                  <Text style={styles.dietaryBadgeText}>VEGAN</Text>
                </View>
              )}
              {menuItem.isVegetarian && !menuItem.isVegan && (
                <View style={[styles.dietaryBadge, { backgroundColor: getDietaryBadgeColor('vegetarian') }]}>
                  <Text style={styles.dietaryBadgeText}>VEGETARIAN</Text>
                </View>
              )}
              {menuItem.isGlutenFree && (
                <View style={[styles.dietaryBadge, { backgroundColor: getDietaryBadgeColor('glutenFree') }]}>
                  <Text style={styles.dietaryBadgeText}>GLUTEN FREE</Text>
                </View>
              )}
            </View>

            {/* Allergen warning */}
            {menuItem.allergens && menuItem.allergens.length > 0 && (
              <View style={styles.allergenSection}>
                <View style={[
                  styles.allergenIndicator, 
                  { backgroundColor: allergenColor || theme.colors.warning }
                ]}>
                  <Text style={styles.allergenText}>
                    ⚠️ {menuItem.allergens.length} allergen{menuItem.allergens.length > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Tap for more info indicator */}
          {hasNutritionData && (
            <View style={styles.moreInfoIndicator}>
              <Text style={styles.moreInfoText}>Tap for full nutrition info</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Favorite indicator overlay */}
      {menuItem.isFavorite && (
        <View style={styles.favoriteOverlay}>
          <LinearGradient
            colors={['rgba(239, 68, 68, 0.1)', 'transparent']}
            style={styles.favoriteGradient}
          />
        </View>
      )}
    </View>
  );
});

MenuItemCard.displayName = 'MenuItemCard';

/**
 * Component styles
 */
const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },

  cardContainer: {
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.md,
  },

  cardGradient: {
    padding: theme.spacing.lg,
  },

  headerSection: {
    marginBottom: theme.spacing.md,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },

  categoryEmoji: {
    fontSize: 24,
    marginRight: theme.spacing.sm,
    marginTop: 2,
  },

  itemName: {
    flex: 1,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    lineHeight: theme.typography.sizes.lg * 1.3,
  },

  favoriteButton: {
    marginLeft: theme.spacing.sm,
  },

  favoriteIcon: {
    fontSize: 20,
  },

  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  category: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  servingSize: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },

  nutritionSection: {
    marginBottom: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },

  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },

  nutritionValue: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },

  nutritionLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  footerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },

  dietaryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    gap: theme.spacing.xs,
  },

  dietaryBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },

  dietaryBadgeText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textInverse,
    letterSpacing: 0.3,
  },

  allergenSection: {
    marginLeft: theme.spacing.sm,
  },

  allergenIndicator: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },

  allergenText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textInverse,
  },

  moreInfoIndicator: {
    marginTop: theme.spacing.sm,
    alignItems: 'center',
  },

  moreInfoText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },

  favoriteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    pointerEvents: 'none',
  },

  favoriteGradient: {
    flex: 1,
  },
});

export default MenuItemCard;