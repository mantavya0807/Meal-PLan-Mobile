/**
 * Menu Meal Picker Component
 * File Path: components/MenuMealPicker.tsx
 * 
 * Segmented control component for selecting meal periods (Breakfast, Lunch, Dinner)
 * with automatic time-based suggestions and smooth animations.
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';

/**
 * Meal period type
 */
type MealPeriod = 'Breakfast' | 'Lunch' | 'Dinner';

/**
 * Component props interface
 */
interface MenuMealPickerProps {
  selectedMeal: MealPeriod;
  onMealChange: (meal: MealPeriod) => void;
  style?: ViewStyle;
  disabled?: boolean;
}

/**
 * Meal configuration
 */
const MEALS: Array<{
  value: MealPeriod;
  label: string;
  emoji: string;
  timeRange: string;
  isCurrentMeal: () => boolean;
}> = [
  {
    value: 'Breakfast',
    label: 'Breakfast',
    emoji: '🌅',
    timeRange: '7-11 AM',
    isCurrentMeal: () => {
      const hour = new Date().getHours();
      return hour >= 6 && hour < 11;
    },
  },
  {
    value: 'Lunch',
    label: 'Lunch',
    emoji: '☀️',
    timeRange: '11-4 PM',
    isCurrentMeal: () => {
      const hour = new Date().getHours();
      return hour >= 11 && hour < 16;
    },
  },
  {
    value: 'Dinner',
    label: 'Dinner',
    emoji: '🌙',
    timeRange: '4-10 PM',
    isCurrentMeal: () => {
      const hour = new Date().getHours();
      return hour >= 16 && hour < 22;
    },
  },
];

/**
 * Menu meal picker component
 */
const MenuMealPicker: React.FC<MenuMealPickerProps> = memo(({
  selectedMeal,
  onMealChange,
  style,
  disabled = false,
}) => {
  
  /**
   * Gets the current meal based on time
   * @returns Current meal period
   */
  const getCurrentMeal = (): MealPeriod => {
    const currentMeal = MEALS.find(meal => meal.isCurrentMeal());
    return currentMeal?.value || 'Dinner';
  };

  /**
   * Handles meal selection
   * @param meal - Selected meal period
   */
  const handleMealPress = (meal: MealPeriod) => {
    if (disabled || meal === selectedMeal) return;
    
    // Add haptic feedback if available
    try {
      const { Haptics } = require('expo-haptics');
      Haptics.selectionAsync();
    } catch (error) {
      // Haptics not available, ignore
    }
    
    onMealChange(meal);
  };

  const currentMeal = getCurrentMeal();

  return (
    <View style={[styles.container, style]}>
      {/* Time-based suggestion */}
      {selectedMeal !== currentMeal && (
        <TouchableOpacity
          style={styles.suggestionContainer}
          onPress={() => handleMealPress(currentMeal)}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.suggestionText}>
            💡 Switch to {currentMeal}? It's {MEALS.find(m => m.value === currentMeal)?.timeRange}
          </Text>
        </TouchableOpacity>
      )}

      {/* Meal picker buttons */}
      <View style={[styles.pickerContainer, disabled && styles.pickerDisabled]}>
        {MEALS.map((meal, index) => {
          const isSelected = meal.value === selectedMeal;
          const isCurrent = meal.value === currentMeal;
          
          return (
            <TouchableOpacity
              key={meal.value}
              style={[
                styles.mealButton,
                isSelected && styles.mealButtonSelected,
                index === 0 && styles.firstButton,
                index === MEALS.length - 1 && styles.lastButton,
              ]}
              onPress={() => handleMealPress(meal.value)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              {isSelected && (
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.primaryLight]}
                  style={styles.selectedBackground}
                />
              )}
              
              <View style={styles.mealButtonContent}>
                <View style={styles.mealHeader}>
                  <Text style={[
                    styles.mealEmoji,
                    !isSelected && styles.mealEmojiUnselected,
                  ]}>
                    {meal.emoji}
                  </Text>
                  {isCurrent && (
                    <View style={styles.currentIndicator}>
                      <Text style={styles.currentIndicatorText}>NOW</Text>
                    </View>
                  )}
                </View>
                
                <Text style={[
                  styles.mealLabel,
                  isSelected ? styles.mealLabelSelected : styles.mealLabelUnselected,
                ]}>
                  {meal.label}
                </Text>
                
                <Text style={[
                  styles.mealTimeRange,
                  isSelected ? styles.mealTimeRangeSelected : styles.mealTimeRangeUnselected,
                ]}>
                  {meal.timeRange}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

MenuMealPicker.displayName = 'MenuMealPicker';

/**
 * Component styles
 */
const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.sm,
  },

  suggestionContainer: {
    backgroundColor: theme.colors.info + '15', // 15% opacity
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.info + '30', // 30% opacity
  },

  suggestionText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.info,
    fontWeight: theme.typography.weights.medium,
    textAlign: 'center',
  },

  pickerContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xs,
    ...theme.shadows.sm,
  },

  pickerDisabled: {
    opacity: 0.6,
  },

  mealButton: {
    flex: 1,
    position: 'relative',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.lg,
    minHeight: 80,
  },

  firstButton: {
    borderTopLeftRadius: theme.borderRadius.xl,
    borderBottomLeftRadius: theme.borderRadius.xl,
  },

  lastButton: {
    borderTopRightRadius: theme.borderRadius.xl,
    borderBottomRightRadius: theme.borderRadius.xl,
  },

  mealButtonSelected: {
    elevation: 2,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  selectedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.borderRadius.lg,
  },

  mealButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },

  mealEmoji: {
    fontSize: 20,
    marginRight: theme.spacing.xs,
  },

  mealEmojiUnselected: {
    opacity: 0.7,
  },

  currentIndicator: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.xs,
  },

  currentIndicatorText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textInverse,
    letterSpacing: 0.3,
  },

  mealLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 2,
  },

  mealLabelSelected: {
    color: theme.colors.textInverse,
  },

  mealLabelUnselected: {
    color: theme.colors.textPrimary,
  },

  mealTimeRange: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.normal,
  },

  mealTimeRangeSelected: {
    color: theme.colors.textInverse,
    opacity: 0.9,
  },

  mealTimeRangeUnselected: {
    color: theme.colors.textSecondary,
  },
});

export default MenuMealPicker;