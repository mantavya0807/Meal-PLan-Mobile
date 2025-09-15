/**
 * Menu Model for Penn State Dining
 * File Path: backend/src/models/Menu.ts
 * 
 * Database model for Penn State menu operations using Supabase client.
 * Handles storage, retrieval, and management of menu data from Penn State dining services.
 */

import { getSupabaseClient, handleSupabaseError } from '../config/database';

/**
 * Menu location interface matching database schema
 */
export interface MenuLocation {
  id: string;
  locationId: number;
  name: string;
  shortName: string;
  campus: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Menu item interface matching database schema
 */
export interface MenuItem {
  id: string;
  itemId: string; // Penn State's mid value
  name: string;
  locationId: string;
  date: Date;
  mealPeriod: string; // Breakfast, Lunch, Dinner
  category?: string;
  description?: string;
  
  // Nutrition Information
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
  
  // Additional Information
  ingredients?: string;
  allergens?: string[];
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  
  // Metadata
  nutritionUrl?: string;
  lastScraped: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Raw menu item data from scraping
 */
export interface RawMenuItem {
  id: string | null;
  name: string;
  nutritionUrl: string;
  nutrition: {
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
  };
}

/**
 * Menu item creation data
 */
export interface CreateMenuItemData {
  itemId: string;
  name: string;
  locationId: string;
  date: Date;
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
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  nutritionUrl?: string;
}

/**
 * Menu query filters
 */
export interface MenuFilters {
  date?: Date;
  locationIds?: string[];
  mealPeriods?: string[];
  categories?: string[];
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  hasAllergens?: string[];
  excludeAllergens?: string[];
  minCalories?: number;
  maxCalories?: number;
  minProtein?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * User favorite interface
 */
export interface UserMenuFavorite {
  id: string;
  userId: string;
  menuItemId: string;
  createdAt: Date;
}

/**
 * Menu scrape log interface
 */
export interface MenuScrapeLog {
  id: string;
  date: Date;
  mealPeriod: string;
  locationId: string;
  itemsFound: number;
  itemsProcessed: number;
  itemsWithNutrition: number;
  successRate: number;
  errors: any[];
  durationMs: number;
  createdAt: Date;
}

/**
 * Menu statistics interface
 */
export interface MenuStats {
  totalItems: number;
  totalLocations: number;
  itemsByMealPeriod: Record<string, number>;
  itemsByLocation: Record<string, number>;
  averageCalories: number;
  vegetarianCount: number;
  veganCount: number;
  glutenFreeCount: number;
}

/**
 * Menu model class for database operations
 */
export class MenuModel {
  
  /**
   * Gets all active menu locations
   * @returns Array of menu locations
   */
  static async getLocations(): Promise<MenuLocation[]> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('menu_locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        throw handleSupabaseError(error);
      }

      return data.map(this.mapLocationFromDatabase);
    } catch (error) {
      console.error('Error fetching menu locations:', error);
      throw error;
    }
  }

  /**
   * Gets menu items with filters
   * @param filters - Query filters
   * @returns Array of menu items
   */
  static async getMenuItems(filters: MenuFilters = {}): Promise<MenuItem[]> {
    try {
      const supabase = getSupabaseClient();
      
      let query = supabase
        .from('menu_items')
        .select(`
          *,
          location:menu_locations(*)
        `);

      // Apply filters
      if (filters.date) {
        query = query.eq('date', filters.date ? filters.date.toISOString().split('T')[0] as any : '' as any);
      }

      if (filters.locationIds?.length) {
        query = query.in('location_id', filters.locationIds);
      }

      if (filters.mealPeriods?.length) {
        query = query.in('meal_period', filters.mealPeriods);
      }

      if (filters.categories?.length) {
        query = query.in('category', filters.categories);
      }

      if (filters.isVegetarian !== undefined) {
        query = query.eq('is_vegetarian', filters.isVegetarian);
      }

      if (filters.isVegan !== undefined) {
        query = query.eq('is_vegan', filters.isVegan);
      }

      if (filters.isGlutenFree !== undefined) {
        query = query.eq('is_gluten_free', filters.isGlutenFree);
      }

      if (filters.hasAllergens?.length) {
        query = query.overlaps('allergens', filters.hasAllergens);
      }

      if (filters.excludeAllergens?.length) {
        query = query.not('allergens', 'ov', filters.excludeAllergens);
      }

      if (filters.minCalories) {
        query = query.gte('calories', filters.minCalories);
      }

      if (filters.maxCalories) {
        query = query.lte('calories', filters.maxCalories);
      }

      if (filters.minProtein) {
        query = query.gte('protein', filters.minProtein);
      }

      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      // Order by meal period and name
      query = query.order('meal_period').order('name');

      const { data, error } = await query;

      if (error) {
        throw handleSupabaseError(error);
      }

      return data.map(this.mapMenuItemFromDatabase);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      throw error;
    }
  }

  /**
   * Gets menu items for today
   * @param locationIds - Optional location filter
   * @returns Array of today's menu items
   */
  static async getTodaysMenu(locationIds?: string[]): Promise<MenuItem[]> {
    const today = new Date();
    return this.getMenuItems({
      date: today,
      locationIds: locationIds ?? [],
    });
  }

  /**
   * Creates or updates menu items (bulk operation)
   * @param items - Array of menu items to create/update
   * @returns Created/updated menu items
   */
  static async upsertMenuItems(items: CreateMenuItemData[]): Promise<MenuItem[]> {
    try {
      const supabase = getSupabaseClient();
      
      const dbItems = items.map(this.mapMenuItemToDatabase);

      const { data, error } = await supabase
        .from('menu_items')
        .upsert(dbItems as any, {
          onConflict: 'item_id,location_id,date,meal_period',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        throw handleSupabaseError(error);
      }

      console.log(`Upserted ${data.length} menu items`);
      return data.map(this.mapMenuItemFromDatabase);
    } catch (error) {
      console.error('Error upserting menu items:', error);
      throw error;
    }
  }

  /**
   * Checks if nutrition data exists for a menu item
   * @param itemId - Penn State item ID
   * @param date - Menu date
   * @returns Boolean indicating if nutrition exists
   */
  static async hasNutritionData(itemId: string, date: Date): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('menu_items')
        .select('calories')
  .eq('item_id', itemId as any)
  .eq('date', date ? date.toISOString().split('T')[0] as any : '' as any)
        .not('calories', 'is', null)
        .limit(1);

      if (error) {
        throw handleSupabaseError(error);
      }

      return data.length > 0;
    } catch (error) {
      console.error('Error checking nutrition data:', error);
      return false;
    }
  }

  /**
   * Gets user's favorite menu items
   * @param userId - User ID
   * @param limit - Maximum number of favorites to return
   * @returns Array of favorite menu items
   */
  static async getUserFavorites(userId: string, limit = 50): Promise<MenuItem[]> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('user_menu_favorites')
        .select(`
          menu_item:menu_items(
            *,
            location:menu_locations(*)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw handleSupabaseError(error);
      }

      return (data ?? [])
        .filter((item: any) => item.menu_item)
        .map((item: any) => this.mapMenuItemFromDatabase(item.menu_item));
    } catch (error) {
      console.error('Error fetching user favorites:', error);
      throw error;
    }
  }

  /**
   * Adds a menu item to user's favorites
   * @param userId - User ID
   * @param menuItemId - Menu item ID
   * @returns Created favorite
   */
  static async addToFavorites(userId: string, menuItemId: string): Promise<UserMenuFavorite> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('user_menu_favorites')
        .insert([{ user_id: userId, menu_item_id: menuItemId }] as any)
        .select()
        .single();

      if (error) {
        throw handleSupabaseError(error);
      }

      return this.mapFavoriteFromDatabase(data);
    } catch (error) {
      console.error('Error adding to favorites:', error);
      throw error;
    }
  }

  /**
   * Removes a menu item from user's favorites
   * @param userId - User ID
   * @param menuItemId - Menu item ID
   * @returns Boolean indicating success
   */
  static async removeFromFavorites(userId: string, menuItemId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
        .from('user_menu_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('menu_item_id', menuItemId);

      if (error) {
        throw handleSupabaseError(error);
      }

      return true;
    } catch (error) {
      console.error('Error removing from favorites:', error);
      throw error;
    }
  }

  /**
   * Logs menu scraping activity
   * @param log - Scrape log data
   * @returns Created log entry
   */
  static async logScrapeActivity(log: Omit<MenuScrapeLog, 'id' | 'createdAt'>): Promise<MenuScrapeLog> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('menu_scrape_logs')
        .insert([{
          date: log.date ? log.date.toISOString().split('T')[0] : '',
          meal_period: log.mealPeriod,
          location_id: log.locationId,
          items_found: log.itemsFound,
          items_processed: log.itemsProcessed,
          items_with_nutrition: log.itemsWithNutrition,
          success_rate: log.successRate,
          errors: log.errors,
          duration_ms: log.durationMs,
        }] as any)
        .select()
        .single();

      if (error) {
        throw handleSupabaseError(error);
      }

      return this.mapScrapeLogFromDatabase(data);
    } catch (error) {
      console.error('Error logging scrape activity:', error);
      throw error;
    }
  }

  /**
   * Gets menu statistics
   * @param date - Optional date filter
   * @returns Menu statistics
   */
  static async getMenuStats(date?: Date): Promise<MenuStats> {
    try {
      const supabase = getSupabaseClient();
      
      let query = supabase
        .from('menu_items')
        .select(`
          *,
          location:menu_locations(name)
        `);

      if (date) {
        query = query.eq('date', date ? date.toISOString().split('T')[0] as any : '' as any);
      }

      const { data, error } = await query;

      if (error) {
        throw handleSupabaseError(error);
      }

      const stats: MenuStats = {
        totalItems: (data ?? []).length,
        totalLocations: new Set((data ?? []).map((item: any) => item.location_id)).size,
        itemsByMealPeriod: {},
        itemsByLocation: {},
        averageCalories: 0,
        vegetarianCount: 0,
        veganCount: 0,
        glutenFreeCount: 0,
      };

      let totalCalories = 0;
      let itemsWithCalories = 0;

      (data ?? []).forEach((item: any) => {
        // Meal period counts
        stats.itemsByMealPeriod[item.meal_period] = 
          (stats.itemsByMealPeriod[item.meal_period] || 0) + 1;

        // Location counts
        const locationName = item.location?.name || 'Unknown';
        stats.itemsByLocation[locationName] = 
          (stats.itemsByLocation[locationName] || 0) + 1;

        // Calorie calculations
        if (item.calories) {
          totalCalories += item.calories;
          itemsWithCalories++;
        }

        // Dietary counts
        if (item.is_vegetarian) stats.vegetarianCount++;
        if (item.is_vegan) stats.veganCount++;
        if (item.is_gluten_free) stats.glutenFreeCount++;
      });

      stats.averageCalories = itemsWithCalories > 0 ? 
        Math.round(totalCalories / itemsWithCalories) : 0;

      return stats;
    } catch (error) {
      console.error('Error fetching menu stats:', error);
      throw error;
    }
  }

  /**
   * Maps database location record to MenuLocation interface
   */
  private static mapLocationFromDatabase(dbRecord: any): MenuLocation {
    return {
      id: dbRecord.id,
      locationId: dbRecord.location_id,
      name: dbRecord.name,
      shortName: dbRecord.short_name,
      campus: dbRecord.campus,
      isActive: dbRecord.is_active,
      createdAt: new Date(dbRecord.created_at),
      updatedAt: new Date(dbRecord.updated_at),
    };
  }

  /**
   * Maps database menu item record to MenuItem interface
   */
  private static mapMenuItemFromDatabase(dbRecord: any): MenuItem {
    return {
      id: dbRecord.id,
      itemId: dbRecord.item_id,
      name: dbRecord.name,
      locationId: dbRecord.location_id,
      date: new Date(dbRecord.date),
      mealPeriod: dbRecord.meal_period,
      category: dbRecord.category,
      description: dbRecord.description,
      calories: dbRecord.calories,
      totalFat: dbRecord.total_fat,
      saturatedFat: dbRecord.saturated_fat,
      transFat: dbRecord.trans_fat,
      cholesterol: dbRecord.cholesterol,
      sodium: dbRecord.sodium,
      totalCarbs: dbRecord.total_carbs,
      dietaryFiber: dbRecord.dietary_fiber,
      totalSugars: dbRecord.total_sugars,
      addedSugars: dbRecord.added_sugars,
      protein: dbRecord.protein,
      servingSize: dbRecord.serving_size,
      ingredients: dbRecord.ingredients,
      allergens: dbRecord.allergens || [],
      isVegetarian: dbRecord.is_vegetarian || false,
      isVegan: dbRecord.is_vegan || false,
      isGlutenFree: dbRecord.is_gluten_free || false,
      nutritionUrl: dbRecord.nutrition_url,
      lastScraped: new Date(dbRecord.last_scraped),
      createdAt: new Date(dbRecord.created_at),
      updatedAt: new Date(dbRecord.updated_at),
    };
  }

  /**
   * Maps MenuItem to database format
   */
  private static mapMenuItemToDatabase(item: CreateMenuItemData): any {
    return {
      item_id: item.itemId,
      name: item.name,
      location_id: item.locationId,
      date: item.date.toISOString().split('T')[0],
      meal_period: item.mealPeriod,
      category: item.category,
      description: item.description,
      calories: item.calories,
      total_fat: item.totalFat,
      saturated_fat: item.saturatedFat,
      trans_fat: item.transFat,
      cholesterol: item.cholesterol,
      sodium: item.sodium,
      total_carbs: item.totalCarbs,
      dietary_fiber: item.dietaryFiber,
      total_sugars: item.totalSugars,
      added_sugars: item.addedSugars,
      protein: item.protein,
      serving_size: item.servingSize,
      ingredients: item.ingredients,
      allergens: item.allergens || [],
      is_vegetarian: item.isVegetarian || false,
      is_vegan: item.isVegan || false,
      is_gluten_free: item.isGlutenFree || false,
      nutrition_url: item.nutritionUrl,
    };
  }

  /**
   * Maps database favorite record to UserMenuFavorite interface
   */
  private static mapFavoriteFromDatabase(dbRecord: any): UserMenuFavorite {
    return {
      id: dbRecord.id,
      userId: dbRecord.user_id,
      menuItemId: dbRecord.menu_item_id,
      createdAt: new Date(dbRecord.created_at),
    };
  }

  /**
   * Maps database scrape log record to MenuScrapeLog interface
   */
  private static mapScrapeLogFromDatabase(dbRecord: any): MenuScrapeLog {
    return {
      id: dbRecord.id,
      date: new Date(dbRecord.date),
      mealPeriod: dbRecord.meal_period,
      locationId: dbRecord.location_id,
      itemsFound: dbRecord.items_found,
      itemsProcessed: dbRecord.items_processed,
      itemsWithNutrition: dbRecord.items_with_nutrition,
      successRate: dbRecord.success_rate,
      errors: dbRecord.errors,
      durationMs: dbRecord.duration_ms,
      createdAt: new Date(dbRecord.created_at),
    };
  }
}