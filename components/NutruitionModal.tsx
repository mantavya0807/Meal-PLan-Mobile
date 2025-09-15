/**
 * Nutrition Modal Component
 * File Path: components/NutritionModal.tsx
 * 
 * Full-screen modal displaying comprehensive nutrition information for a menu item
 * with visual charts, allergen warnings, and ingredient details.
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
  saturatedFat?: number;
  transFat?: number;
  cholesterol?: number;
  sodium?: number;
  totalCarbs?: number;
  dietaryFiber?: number;
  totalSugars?: number;
  addedSugars?: number;
  protein?: number;
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
interface NutritionModalProps {
  menuItem: MenuItem;
  onClose: () => void;
}

/**
 * Nutrition value interface for display
 */
interface NutritionValue {
  label: string;
  value: number | undefined;
  unit: string;
  dailyValue?: number;
  category: 'macros' | 'vitamins' | 'minerals';
  color?: string;
}

/**
 * Screen dimensions
 */
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Nutrition modal component
 */
const NutritionModal: React.FC<NutritionModalProps> = memo(({
  menuItem,
  onClose,
}) => {
  
  /**
   * Gets nutrition facts organized by category
   */
  const getNutritionFacts = (): NutritionValue[] => {
    return [
      // Macronutrients
      {
        label: 'Calories',
        value: menuItem.calories,
        unit: 'cal',
        category: 'macros' as const,
        color: theme.colors.primary,
      },
      {
        label: 'Protein',
        value: menuItem.protein,
        unit: 'g',
        dailyValue: menuItem.protein ? Math.round((menuItem.protein / 50) * 100) : undefined,
        category: 'macros' as const,
        color: '#22c55e',
      },
      {
        label: 'Total Carbs',
        value: menuItem.totalCarbs,
        unit: 'g',
        dailyValue: menuItem.totalCarbs ? Math.round((menuItem.totalCarbs / 300) * 100) : undefined,
        category: 'macros' as const,
        color: '#3b82f6',
      },
      {
        label: 'Total Fat',
        value: menuItem.totalFat,
        unit: 'g',
        dailyValue: menuItem.totalFat ? Math.round((menuItem.totalFat / 65) * 100) : undefined,
        category: 'macros' as const,
        color: '#f59e0b',
      },
      {
        label: 'Saturated Fat',
        value: menuItem.saturatedFat,
        unit: 'g',
        dailyValue: menuItem.saturatedFat ? Math.round((menuItem.saturatedFat / 20) * 100) : undefined,
        category: 'macros' as const,
        color: '#ef4444',
      },
      {
        label: 'Trans Fat',
        value: menuItem.transFat,
        unit: 'g',
        category: 'macros' as const,
        color: '#dc2626',
      },
      {
        label: 'Cholesterol',
        value: menuItem.cholesterol,
        unit: 'mg',
        dailyValue: menuItem.cholesterol ? Math.round((menuItem.cholesterol / 300) * 100) : undefined,
        category: 'macros' as const,
        color: '#8b5cf6',
      },
      {
        label: 'Sodium',
        value: menuItem.sodium,
        unit: 'mg',
        dailyValue: menuItem.sodium ? Math.round((menuItem.sodium / 2300) * 100) : undefined,
        category: 'macros' as const,
        color: '#f97316',
      },
      {
        label: 'Dietary Fiber',
        value: menuItem.dietaryFiber,
        unit: 'g',
        dailyValue: menuItem.dietaryFiber ? Math.round((menuItem.dietaryFiber / 25) * 100) : undefined,
        category: 'macros' as const,
        color: '#10b981',
      },
      {
        label: 'Total Sugars',
        value: menuItem.totalSugars,
        unit: 'g',
        category: 'macros' as const,
        color: '#ec4899',
      },
      {
        label: 'Added Sugars',
        value: menuItem.addedSugars,
        unit: 'g',
        dailyValue: menuItem.addedSugars ? Math.round((menuItem.addedSugars / 50) * 100) : undefined,
        category: 'macros' as const,
        color: '#e11d48',
      },
    ].filter(item => item.value !== undefined && item.value !== null);
  };

  /**
   * Calculates macronutrient percentages for visual chart
   */
  const getMacroPercentages = () => {
    const { calories, protein, totalCarbs, totalFat } = menuItem;
    
    if (!calories || (!protein && !totalCarbs && !totalFat)) {
      return null;
    }

    const proteinCals = (protein || 0) * 4;
    const carbCals = (totalCarbs || 0) * 4;
    const fatCals = (totalFat || 0) * 9;
    const totalMacroCals = proteinCals + carbCals + fatCals;

    if (totalMacroCals === 0) return null;

    return {
      protein: Math.round((proteinCals / totalMacroCals) * 100),
      carbs: Math.round((carbCals / totalMacroCals) * 100),
      fat: Math.round((fatCals / totalMacroCals) * 100),
    };
  };

  /**
   * Gets allergen severity level
   */
  const getAllergenSeverity = (allergen: string): 'high' | 'medium' | 'low' => {
    const high = ['peanuts', 'tree nuts', 'shellfish', 'fish'];
    const medium = ['eggs', 'milk', 'soy', 'wheat'];
    
    const allergenLower = allergen.toLowerCase();
    
    if (high.some(a => allergenLower.includes(a))) return 'high';
    if (medium.some(a => allergenLower.includes(a))) return 'medium';
    return 'low';
  };

  /**
   * Gets color for allergen severity
   */
  const getAllergenColor = (severity: 'high' | 'medium' | 'low'): string => {
    switch (severity) {
      case 'high': return theme.colors.error;
      case 'medium': return theme.colors.warning;
      case 'low': return theme.colors.info;
    }
  };

  const nutritionFacts = getNutritionFacts();
  const macroPercentages = getMacroPercentages();
  const hasNutritionData = nutritionFacts.length > 0;

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
            <Text style={styles.headerTitle} numberOfLines={2}>
              {menuItem.name}
            </Text>
            {menuItem.servingSize && (
              <Text style={styles.headerSubtitle}>
                Serving Size: {menuItem.servingSize}
              </Text>
            )}
            {menuItem.category && (
              <Text style={styles.headerCategory}>
                {menuItem.category}
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {hasNutritionData ? (
          <>
            {/* Calorie highlight */}
            {menuItem.calories && (
              <View style={styles.calorieSection}>
                <LinearGradient
                  colors={[theme.colors.primary + '20', 'transparent']}
                  style={styles.calorieGradient}
                >
                  <Text style={styles.calorieValue}>{menuItem.calories}</Text>
                  <Text style={styles.calorieLabel}>Calories</Text>
                </LinearGradient>
              </View>
            )}

            {/* Macronutrient breakdown chart */}
            {macroPercentages && (
              <View style={styles.macroSection}>
                <Text style={styles.sectionTitle}>Macronutrient Breakdown</Text>
                
                <View style={styles.macroChart}>
                  <View style={styles.macroBar}>
                    <View 
                      style={[
                        styles.macroSegment, 
                        { 
                          width: `${macroPercentages.protein}%`, 
                          backgroundColor: '#22c55e' 
                        }
                      ]} 
                    />
                    <View 
                      style={[
                        styles.macroSegment, 
                        { 
                          width: `${macroPercentages.carbs}%`, 
                          backgroundColor: '#3b82f6' 
                        }
                      ]} 
                    />
                    <View 
                      style={[
                        styles.macroSegment, 
                        { 
                          width: `${macroPercentages.fat}%`, 
                          backgroundColor: '#f59e0b' 
                        }
                      ]} 
                    />
                  </View>
                  
                  <View style={styles.macroLegend}>
                    <View style={styles.macroLegendItem}>
                      <View style={[styles.macroLegendColor, { backgroundColor: '#22c55e' }]} />
                      <Text style={styles.macroLegendText}>Protein {macroPercentages.protein}%</Text>
                    </View>
                    <View style={styles.macroLegendItem}>
                      <View style={[styles.macroLegendColor, { backgroundColor: '#3b82f6' }]} />
                      <Text style={styles.macroLegendText}>Carbs {macroPercentages.carbs}%</Text>
                    </View>
                    <View style={styles.macroLegendItem}>
                      <View style={[styles.macroLegendColor, { backgroundColor: '#f59e0b' }]} />
                      <Text style={styles.macroLegendText}>Fat {macroPercentages.fat}%</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Nutrition facts */}
            <View style={styles.nutritionSection}>
              <Text style={styles.sectionTitle}>Nutrition Facts</Text>
              
              {nutritionFacts.map((fact, index) => (
                <View key={index} style={styles.nutritionRow}>
                  <View style={styles.nutritionRowLeft}>
                    <View 
                      style={[
                        styles.nutritionIndicator, 
                        { backgroundColor: fact.color || theme.colors.textSecondary }
                      ]} 
                    />
                    <Text style={styles.nutritionLabel}>{fact.label}</Text>
                  </View>
                  
                  <View style={styles.nutritionRowRight}>
                    <Text style={styles.nutritionValue}>
                      {fact.value}{fact.unit}
                    </Text>
                    {fact.dailyValue && (
                      <Text style={styles.nutritionDailyValue}>
                        {fact.dailyValue}% DV
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.noDataSection}>
            <Text style={styles.noDataText}>
              Nutrition information is not available for this item.
            </Text>
          </View>
        )}

        {/* Dietary information */}
        <View style={styles.dietarySection}>
          <Text style={styles.sectionTitle}>Dietary Information</Text>
          
          <View style={styles.dietaryBadges}>
            {menuItem.isVegan && (
              <View style={[styles.dietaryBadge, { backgroundColor: '#22c55e' }]}>
                <Text style={styles.dietaryBadgeText}>🌱 VEGAN</Text>
              </View>
            )}
            {menuItem.isVegetarian && !menuItem.isVegan && (
              <View style={[styles.dietaryBadge, { backgroundColor: '#84cc16' }]}>
                <Text style={styles.dietaryBadgeText}>🥕 VEGETARIAN</Text>
              </View>
            )}
            {menuItem.isGlutenFree && (
              <View style={[styles.dietaryBadge, { backgroundColor: '#3b82f6' }]}>
                <Text style={styles.dietaryBadgeText}>🌾 GLUTEN FREE</Text>
              </View>
            )}
          </View>
        </View>

        {/* Allergen information */}
        {menuItem.allergens && menuItem.allergens.length > 0 && (
          <View style={styles.allergenSection}>
            <Text style={styles.sectionTitle}>⚠️ Allergen Information</Text>
            
            <View style={styles.allergenList}>
              {menuItem.allergens.map((allergen, index) => {
                const severity = getAllergenSeverity(allergen);
                const color = getAllergenColor(severity);
                
                return (
                  <View 
                    key={index} 
                    style={[styles.allergenBadge, { borderColor: color }]}
                  >
                    <View style={[styles.allergenSeverity, { backgroundColor: color }]} />
                    <Text style={styles.allergenText}>{allergen}</Text>
                  </View>
                );
              })}
            </View>
            
            <Text style={styles.allergenDisclaimer}>
              Please inform dining staff of any allergies. Cross-contamination may occur.
            </Text>
          </View>
        )}

        {/* Ingredients */}
        {menuItem.ingredients && (
          <View style={styles.ingredientsSection}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <Text style={styles.ingredientsText}>{menuItem.ingredients}</Text>
          </View>
        )}

        {/* Bottom spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Footer with close button */}
      <BlurView intensity={95} style={styles.footer}>
        <TouchableOpacity style={styles.footerCloseButton} onPress={onClose}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryLight]}
            style={styles.footerCloseGradient}
          >
            <Text style={styles.footerCloseText}>Close</Text>
          </LinearGradient>
        </TouchableOpacity>
      </BlurView>
    </SafeAreaView>
  );
});

NutritionModal.displayName = 'NutritionModal';

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
    lineHeight: theme.typography.sizes.xl * 1.2,
  },

  headerSubtitle: {
  color: theme.colors.textInverse,
    fontSize: theme.typography.sizes.sm,
    opacity: 0.9,
    marginTop: theme.spacing.xs,
  },

  headerCategory: {
  color: theme.colors.textInverse,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    opacity: 0.8,
    marginTop: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  scrollView: {
    flex: 1,
  },

  calorieSection: {
    margin: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },

  calorieGradient: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },

  calorieValue: {
    fontSize: 48,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },

  calorieLabel: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },

  macroSection: {
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
    marginBottom: theme.spacing.md,
  },

  macroChart: {
    marginTop: theme.spacing.md,
  },

  macroBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.borderLight,
    overflow: 'hidden',
  },

  macroSegment: {
    height: '100%',
  },

  macroLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing.md,
  },

  macroLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  macroLegendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing.xs,
  },

  macroLegendText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },

  nutritionSection: {
    margin: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },

  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },

  nutritionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  nutritionIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: theme.spacing.sm,
  },

  nutritionLabel: {
  fontSize: theme.typography.sizes.base,
    color: theme.colors.textPrimary,
    flex: 1,
  },

  nutritionRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },

  nutritionValue: {
  fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },

  nutritionDailyValue: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    minWidth: 50,
    textAlign: 'right',
  },

  noDataSection: {
    margin: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
  },

  noDataText: {
  fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  dietarySection: {
    margin: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },

  dietaryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },

  dietaryBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
  },

  dietaryBadgeText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
  color: theme.colors.textInverse,
  },

  allergenSection: {
    margin: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },

  allergenList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },

  allergenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    backgroundColor: theme.colors.background,
  },

  allergenSeverity: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.xs,
  },

  allergenText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
  },

  allergenDisclaimer: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  ingredientsSection: {
    margin: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },

  ingredientsText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.sizes.sm * 1.4,
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

  footerCloseButton: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },

  footerCloseGradient: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },

  footerCloseText: {
  color: theme.colors.textInverse,
  fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
  },
});

export default NutritionModal;