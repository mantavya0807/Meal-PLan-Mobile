/**
 * Menu Screen - Penn State Dining Menu Display
 * File Path: app/(tabs)/menu.tsx
 * 
 * Modern, interactive menu display that showcases today's dining options
 * with nutrition information, filtering, and favorites functionality.
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
  ScrollView,
  Dimensions,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { theme } from '../../constants/theme';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import MenuItemCard from '../../components/MenuItemCard';
import MenuFilters from '../../components/MenuFilters';
import MenuLocationTabs from '../../components/MenuLocationTabs';
import MenuMealPicker from '../../components/MenuMealPicker';
import NutritionModal from '../../components/NutruitionModal';

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
 * Menu location interface
 */
interface MenuLocation {
  id: string;
  locationId: number;
  name: string;
  shortName: string;
}

/**
 * Meal periods
 */
const MEAL_PERIODS = ['Breakfast', 'Lunch', 'Dinner'] as const;
type MealPeriod = typeof MEAL_PERIODS[number];

/**
 * Component state interface
 */
interface MenuScreenState {
  menuItems: MenuItem[];
  locations: MenuLocation[];
  groupedMenu: Record<string, Record<string, MenuItem[]>>;
  isLoading: boolean;
  isRefreshing: boolean;
  selectedMeal: MealPeriod;
  selectedLocationId: string | null;
  showFilters: boolean;
  showNutritionModal: boolean;
  selectedMenuItem: MenuItem | null;
  searchQuery: string;
  error: string;
  lastUpdated: Date | null;
}

/**
 * Menu screen component
 */
export default function MenuScreen() {
  const { user } = useAuth();
  const [state, setState] = useState<MenuScreenState>({
    menuItems: [],
    locations: [],
    groupedMenu: {},
    isLoading: true,
    isRefreshing: false,
    selectedMeal: getCurrentMealPeriod(),
    selectedLocationId: null,
    showFilters: false,
    showNutritionModal: false,
    selectedMenuItem: null,
    searchQuery: '',
    error: '',
    lastUpdated: null,
  });

  /**
   * Updates component state
   * @param updates - Partial state updates
   */
  const updateState = useCallback((updates: Partial<MenuScreenState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Gets current meal period based on time
   */
  function getCurrentMealPeriod(): MealPeriod {
    const hour = new Date().getHours();
    if (hour < 11) return 'Breakfast';
    if (hour < 16) return 'Lunch';
    return 'Dinner';
  }

  /**
   * Loads today's menu
   * @param refresh - Whether this is a refresh operation
   */
  const loadTodaysMenu = useCallback(async (refresh: boolean = false) => {
    if (!refresh) updateState({ isLoading: true });
    else updateState({ isRefreshing: true });

    try {
      // Load locations if not already loaded
      if (state.locations.length === 0) {
        const locationsResponse = await apiService.request<{ locations: MenuLocation[] }>(
          'GET', 
          '/menu/locations'
        );
        
        if (locationsResponse.success && locationsResponse.data?.locations) {
          updateState({ locations: locationsResponse.data.locations });
        }
      }

      // Load today's menu
      const menuResponse = await apiService.request<{
        items: MenuItem[];
        grouped: Record<string, Record<string, MenuItem[]>>;
      }>('GET', `/menu/today?meal=${state.selectedMeal}&refresh=${refresh}`);

      if (menuResponse.success && menuResponse.data) {
        // Load user favorites if authenticated
        let favoriteIds: Set<string> = new Set();
        if (user) {
          try {
            const favoritesResponse = await apiService.request<{ favorites: MenuItem[] }>(
              'GET', 
              '/menu/favorites?limit=100'
            );
            if (favoritesResponse.success && favoritesResponse.data?.favorites) {
              favoriteIds = new Set(favoritesResponse.data.favorites.map(fav => fav.id));
            }
          } catch (error) {
            console.warn('Failed to load favorites:', error);
          }
        }

        // Mark favorite items
        const itemsWithFavorites = menuResponse.data.items.map(item => ({
          ...item,
          isFavorite: favoriteIds.has(item.id),
        }));

        updateState({
          menuItems: itemsWithFavorites,
          groupedMenu: menuResponse.data.grouped,
          lastUpdated: new Date(),
          error: '',
        });
      } else {
        throw new Error(menuResponse.message || 'Failed to load menu');
      }

    } catch (error) {
      console.error('Error loading menu:', error);
      updateState({
        error: error instanceof Error ? error.message : 'Failed to load menu',
      });
      
      Alert.alert(
        'Menu Loading Failed',
        'Unable to load today\'s menu. Please check your internet connection and try again.',
        [
          { text: 'Retry', onPress: () => loadTodaysMenu(true) },
          { text: 'OK' }
        ]
      );
    } finally {
      updateState({ isLoading: false, isRefreshing: false });
    }
  }, [state.selectedMeal, state.locations.length, user]);

  /**
   * Toggles favorite status for a menu item
   * @param menuItem - Menu item to toggle
   */
  const toggleFavorite = useCallback(async (menuItem: MenuItem) => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to save favorites');
      return;
    }

    try {
      const endpoint = `/menu/favorites/${menuItem.id}`;
      const method = menuItem.isFavorite ? 'DELETE' : 'POST';
      
      const response = await apiService.request(method, endpoint);
      
      if (response.success) {
        // Update local state
        updateState({
          menuItems: state.menuItems.map(item =>
            item.id === menuItem.id 
              ? { ...item, isFavorite: !item.isFavorite }
              : item
          )
        });
      } else {
        throw new Error(response.message || 'Failed to update favorite');
      }

    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  }, [user, state.menuItems]);

  /**
   * Handles meal period change
   * @param meal - Selected meal period
   */
  const handleMealChange = useCallback((meal: MealPeriod) => {
    updateState({ selectedMeal: meal });
  }, []);

  /**
   * Handles location selection
   * @param locationId - Selected location ID
   */
  const handleLocationChange = useCallback((locationId: string | null) => {
    updateState({ selectedLocationId: locationId });
  }, []);

  /**
   * Opens nutrition modal for a menu item
   * @param menuItem - Menu item to show nutrition for
   */
  const showNutritionInfo = useCallback((menuItem: MenuItem) => {
    updateState({ 
      selectedMenuItem: menuItem, 
      showNutritionModal: true 
    });
  }, []);

  /**
   * Closes nutrition modal
   */
  const closeNutritionModal = useCallback(() => {
    updateState({ 
      showNutritionModal: false, 
      selectedMenuItem: null 
    });
  }, []);

  /**
   * Filters menu items based on current filters
   */
  const getFilteredMenuItems = useCallback(() => {
    let filtered = state.menuItems;

    // Filter by meal period
    filtered = filtered.filter(item => item.mealPeriod === state.selectedMeal);

    // Filter by location
    if (state.selectedLocationId) {
      filtered = filtered.filter(item => item.locationId === state.selectedLocationId);
    }

    // Filter by search query
    if (state.searchQuery.trim()) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.ingredients || '').toLowerCase().includes(query) ||
        (item.category || '').toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [state.menuItems, state.selectedMeal, state.selectedLocationId, state.searchQuery]);

  /**
   * Groups filtered items by location
   */
  const getGroupedFilteredItems = useCallback(() => {
    const filtered = getFilteredMenuItems();
    return filtered.reduce((acc, item) => {
      if (!acc[item.locationId]) {
        acc[item.locationId] = [];
      }
      acc[item.locationId].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [getFilteredMenuItems]);

  /**
   * Load menu when component mounts or meal changes
   */
  useEffect(() => {
    loadTodaysMenu();
  }, [state.selectedMeal]);

  /**
   * Render loading state
   */
  if (state.isLoading && !state.isRefreshing) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={theme.gradients.primary}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color={theme.colors.textInverse} />
          <Text style={styles.loadingText}>Loading Today's Menu...</Text>
        </LinearGradient>
      </View>
    );
  }

  const filteredItems = getFilteredMenuItems();
  const groupedItems = getGroupedFilteredItems();

  return (
    <View style={styles.container}>
      {/* Header with gradient background */}
      <LinearGradient
        colors={theme.gradients.primary}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Today's Menu</Text>
        <Text style={styles.headerSubtitle}>
          {state.lastUpdated ? 
            `Updated ${state.lastUpdated.toLocaleTimeString()}` : 
            'Fresh dining options await!'
          }
        </Text>
      </LinearGradient>

      {/* Search and controls section */}
      <View style={styles.controlsSection}>
        {/* Search bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search menu items..."
            value={state.searchQuery}
            onChangeText={(text) => updateState({ searchQuery: text })}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Meal picker */}
        <MenuMealPicker
          selectedMeal={state.selectedMeal}
          onMealChange={handleMealChange}
          style={styles.mealPicker}
        />

        {/* Location tabs */}
        {state.locations.length > 0 && (
          <MenuLocationTabs
            locations={state.locations}
            selectedLocationId={state.selectedLocationId}
            onLocationChange={handleLocationChange}
            style={styles.locationTabs}
          />
        )}

        {/* Filter toggle */}
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => updateState({ showFilters: true })}
        >
          <Text style={styles.filterButtonText}>Filters</Text>
        </TouchableOpacity>
      </View>

      {/* Menu items list */}
      <FlatList
        style={styles.menuList}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MenuItemCard
            menuItem={item}
            onToggleFavorite={() => toggleFavorite(item)}
            onShowNutrition={() => showNutritionInfo(item)}
            style={styles.menuItemCard}
          />
        )}
        contentContainerStyle={styles.menuListContent}
        refreshControl={
          <RefreshControl
            refreshing={state.isRefreshing}
            onRefresh={() => loadTodaysMenu(true)}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {state.error ? 
                'Failed to load menu items' : 
                'No menu items found for the selected filters'
              }
            </Text>
            {state.error && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => loadTodaysMenu(true)}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Results summary */}
      <BlurView intensity={95} style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          {filteredItems.length} items • {state.selectedMeal}
          {state.selectedLocationId && (
            <Text>
              {' • '}
              {state.locations.find(loc => loc.id === state.selectedLocationId)?.shortName}
            </Text>
          )}
        </Text>
      </BlurView>

      {/* Modals */}
      <Modal
        visible={state.showFilters}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <MenuFilters
          onClose={() => updateState({ showFilters: false })}
          onApplyFilters={(filters) => {
            // Apply filters logic here
            updateState({ showFilters: false });
          }}
        />
      </Modal>

      <Modal
        visible={state.showNutritionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeNutritionModal}
      >
        {state.selectedMenuItem && (
          <NutritionModal
            menuItem={state.selectedMenuItem}
            onClose={closeNutritionModal}
          />
        )}
      </Modal>
    </View>
  );
}

/**
 * Component styles
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  loadingContainer: {
    flex: 1,
  },

  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
    marginTop: theme.spacing.md,
  },

  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    borderBottomLeftRadius: theme.borderRadius.xl,
    borderBottomRightRadius: theme.borderRadius.xl,
  },

  headerTitle: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    textAlign: 'center',
  },

  headerSubtitle: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.normal,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    opacity: 0.9,
  },

  controlsSection: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },

  searchContainer: {
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

  mealPicker: {
    marginBottom: theme.spacing.md,
  },

  locationTabs: {
    marginBottom: theme.spacing.md,
  },

  filterButton: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
  },

  filterButtonText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },

  menuList: {
    flex: 1,
  },

  menuListContent: {
    padding: theme.spacing.lg,
    paddingBottom: 100, // Space for summary bar
  },

  menuItemCard: {
    marginBottom: theme.spacing.md,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2xl'],
  },

  emptyStateText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.lg,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },

  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },

  retryButtonText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
  },

  summaryBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },

  summaryText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    textAlign: 'center',
  }
});