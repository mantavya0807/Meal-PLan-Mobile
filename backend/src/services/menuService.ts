/**
 * Menu Service - Penn State Dining Menu Management
 * File Path: backend/src/services/menuService.ts
 * 
 * Service for managing Penn State menu data, integrating scraping functionality
 * with database storage and providing clean API for menu operations.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { MenuModel, MenuItem, MenuLocation, CreateMenuItemData, MenuFilters, RawMenuItem } from '../models/Menu';

/**
 * Penn State UP dining locations configuration
 */
const UP_LOCATIONS = [
  { id: 11, value: '11', name: 'UP: East Food District @ Findlay', shortName: 'East @ Findlay' },
  { id: 17, value: '17', name: 'UP: North Food District @ Warnock', shortName: 'North @ Warnock' },
  { id: 14, value: '14', name: 'UP: Pollock Dining Commons', shortName: 'Pollock Commons' },
  { id: 13, value: '13', name: 'UP: South Food District @ Redifer', shortName: 'South @ Redifer' },
  { id: 16, value: '16', name: 'UP: West Food District @ Waring', shortName: 'West @ Waring' }
];

/**
 * Available meal periods
 */
export const MEAL_PERIODS = ['Breakfast', 'Lunch', 'Dinner'] as const;
export type MealPeriod = typeof MEAL_PERIODS[number];

/**
 * Menu scraping options
 */
export interface MenuScrapingOptions {
  date?: Date;
  mealPeriod?: MealPeriod;
  locationIds?: number[];
  forceRefresh?: boolean;
  skipNutritionCheck?: boolean;
}

/**
 * Menu scraping result
 */
export interface MenuScrapingResult {
  success: boolean;
  date: Date;
  mealPeriod: string;
  totalItems: number;
  newItems: number;
  updatedItems: number;
  itemsWithNutrition: number;
  processingTime: number;
  locations: Array<{
    locationName: string;
    itemCount: number;
    nutritionSuccessRate: number;
  }>;
  errors: string[];
}

/**
 * Axios client for Penn State requests
 */
const pennStateClient = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  }
});

/**
 * Menu service class
 */
export class MenuService {

  /**
   * Gets today's menu from database, scraping if necessary
   * @param options - Menu fetching options
   * @returns Today's menu items
   */
  static async getTodaysMenu(options: MenuScrapingOptions = {}): Promise<MenuItem[]> {
    const date = options.date || new Date();
    const mealPeriod = options.mealPeriod || this.getCurrentMealPeriod();

    console.log(`[Menu] Getting today's menu for ${mealPeriod} on ${date.toDateString()}`);

    try {
      // Check if we have fresh menu data
      const existingItems = await MenuModel.getMenuItems({
        date,
        mealPeriods: [mealPeriod],
        locationIds: options.locationIds?.map(String) ?? [],
      });

      // If we have data and not forcing refresh, return it
      if (existingItems.length > 0 && !options.forceRefresh) {
        console.log(`[Menu] Found ${existingItems.length} existing menu items`);
        return existingItems;
      }

      // Scrape fresh menu data
      console.log(`[Menu] Scraping fresh menu data...`);
      const scrapingResult = await this.scrapeMenusForDate(date, mealPeriod, options);

      if (!scrapingResult.success) {
        console.warn(`[Menu] Scraping failed, returning existing data`);
        return existingItems;
      }

      // Return fresh data
      return await MenuModel.getMenuItems({
        date,
        mealPeriods: [mealPeriod],
        locationIds: options.locationIds?.map(String) ?? [],
      });

    } catch (error) {
      console.error(`[Menu] Error getting today's menu:`, error);
      throw new Error('Failed to fetch today\'s menu');
    }
  }

  /**
   * Scrapes menus for a specific date and meal period
   * @param date - Target date
   * @param mealPeriod - Meal period to scrape
   * @param options - Scraping options
   * @returns Scraping result
   */
  static async scrapeMenusForDate(
    date: Date, 
    mealPeriod: MealPeriod, 
    options: MenuScrapingOptions = {}
  ): Promise<MenuScrapingResult> {
    const startTime = Date.now();
    console.log(`[Menu] Starting menu scraping for ${mealPeriod} on ${date.toDateString()}`);

    const result: MenuScrapingResult = {
      success: false,
      date,
      mealPeriod,
      totalItems: 0,
      newItems: 0,
      updatedItems: 0,
      itemsWithNutrition: 0,
      processingTime: 0,
      locations: [],
      errors: [],
    };

    try {
      // Fix: Always process all locations if locationIds is undefined or empty array
      // Always process all 5 UP locations for cron and scraping
      const locationsToProcess = UP_LOCATIONS;

      console.log(`[Menu] Found ${locationsToProcess.length} locations to process:`, locationsToProcess.map(l => l.name));
      
      for (const location of locationsToProcess) {
        try {
          console.log(`[Menu] Processing location: ${location.name}`);
          console.log(`[Menu] About to call scrapeLocationMenu for ${location.name}`);
          
          const locationResult = await this.scrapeLocationMenu(
            location, 
            date, 
            mealPeriod, 
            options
          );
          
          console.log(`[Menu] Completed scrapeLocationMenu for ${location.name}, got ${locationResult.length} items`);

          result.locations.push({
            locationName: location.name,
            itemCount: locationResult.length,
            nutritionSuccessRate: this.calculateNutritionSuccessRate(locationResult),
          });

          result.totalItems += locationResult.length;
          result.itemsWithNutrition += locationResult.filter(item => 
            item.nutrition.calories !== undefined
          ).length;

          // Store items in database
          if (locationResult.length > 0) {
            const dbLocation = await this.getOrCreateLocation(location);
            const menuItems = locationResult.map(item => 
              this.convertRawItemToCreateData(item, dbLocation.id, date, mealPeriod)
            );

            await MenuModel.upsertMenuItems(menuItems);
            console.log(`[Menu] Stored ${menuItems.length} items for ${location.name}`);
          }

          // Brief delay between locations
          await this.delay(2000);

        } catch (locationError) {
          const errorMsg = `Failed to process ${location.name}: ${locationError}`;
          console.error(`[Menu] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      result.success = result.totalItems > 0;
      result.processingTime = Date.now() - startTime;

      // Log scraping activity
      for (const locationResult of result.locations) {
        try {
          const dbLocation = await this.findLocationByName(locationResult.locationName);
          if (dbLocation) {
            await MenuModel.logScrapeActivity({
              date,
              mealPeriod,
              locationId: dbLocation.id,
              itemsFound: locationResult.itemCount,
              itemsProcessed: locationResult.itemCount,
              itemsWithNutrition: Math.round(locationResult.itemCount * locationResult.nutritionSuccessRate / 100),
              successRate: locationResult.nutritionSuccessRate,
              errors: result.errors,
              durationMs: result.processingTime,
            });
          }
        } catch (logError) {
          console.warn(`[Menu] Failed to log scraping activity:`, logError);
        }
      }

      console.log(`[Menu] Scraping completed in ${result.processingTime}ms`);
      console.log(`[Menu] Total items: ${result.totalItems}, With nutrition: ${result.itemsWithNutrition}`);

      return result;

    } catch (error) {
      result.success = false;
      result.processingTime = Date.now() - startTime;
      result.errors.push(`Scraping failed: ${error}`);
      
      console.error(`[Menu] Scraping failed:`, error);
      return result;
    }
  }

  /**
   * Scrapes menu for a specific location
   * @param location - Location configuration
   * @param date - Target date
   * @param mealPeriod - Meal period
   * @param options - Scraping options
   * @returns Array of raw menu items
   */
  private static async scrapeLocationMenu(
    location: typeof UP_LOCATIONS[0], 
    date: Date, 
    mealPeriod: MealPeriod,
    options: MenuScrapingOptions
  ): Promise<RawMenuItem[]> {
    console.log(`[Menu] Starting scrapeLocationMenu for ${location.name}`);
    try {
      // Format date for Penn State API
      const dateStr = this.formatDateForPennState(date);
      console.log(`[Menu] Formatted date: ${dateStr}`);

      // Prepare form data
      const formData = new URLSearchParams({
        selMenuDate: dateStr,
        selMeal: mealPeriod,
        selCampus: location.value
      });

      console.log(`[Menu] POST to Penn State menu API for ${location.name}`);
      console.log(`[Menu] Form data: ${formData.toString()}`);

      // Make POST request to Penn State menu API
      const menuUrl = 'https://www.absecom.psu.edu/menus/user-pages/daily-menu.cfm';
      console.log(`[Menu] Making request to: ${menuUrl}`);
      
      const response = await pennStateClient.post(menuUrl, formData);
      console.log(`[Menu] Got response status: ${response.status}, data length: ${response.data?.length || 0}`);
      
      // Parse HTML response
      const $ = cheerio.load(response.data);
      
      // Verify we got the right location menu
      const pageText = $('body').text();
      console.log(`[Menu] Page text contains location name: ${pageText.includes(location.name)}`);
      console.log(`[Menu] Page text length: ${pageText.length}`);
      if (!pageText.includes(location.name)) {
        console.warn(`[Menu] Warning: May not have correct location menu for ${location.name}`);
      }

      // Extract menu items
      const menuItems: RawMenuItem[] = [];
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        
        if (href && text && href.includes('nutrition-label')) {
          const fullUrl = href.startsWith('http') ? 
            href : `https://www.absecom.psu.edu/menus/user-pages/${href}`;
          
          const midMatch = href.match(/mid=(\d+)/);
          
          menuItems.push({
            id: typeof midMatch?.[1] === 'string' ? midMatch[1] : null,
            name: text,
            nutritionUrl: fullUrl,
            nutrition: {} // Will be populated later
          });
        }
      });

      console.log(`[Menu] Found ${menuItems.length} menu items for ${location.name}`);

      // Process nutrition data for each item
      for (let i = 0; i < menuItems.length; i++) {
  const item = menuItems[i];
  if (!item) continue;
        
        if ((i + 1) % 10 === 0) {
          console.log(`[Menu] Processing nutrition: ${i + 1}/${menuItems.length} (${Math.round((i + 1) / menuItems.length * 100)}%)`);
        }

        try {
          // Check if we should skip nutrition lookup
          if (!options.skipNutritionCheck && item.id) {
            const hasNutrition = await MenuModel.hasNutritionData(item.id, date);
            if (hasNutrition) {
              console.log(`[Menu] Skipping nutrition fetch for ${item.name} (already exists)`);
              continue;
            }
          }

          // Fetch nutrition data
          const nutritionData = await this.fetchNutritionData(item.nutritionUrl);
          item.nutrition = nutritionData;

          // Delay between nutrition requests
          await this.delay(1500);

        } catch (nutritionError) {
          console.warn(`[Menu] Failed to get nutrition for ${item.name}:`, nutritionError);
          // Continue with empty nutrition data
        }
      }

      return menuItems;

    } catch (error) {
      console.error(`[Menu] Error scraping location ${location.name}:`, error);
      throw new Error(`Failed to scrape menu for ${location.name}`);
    }
  }

  /**
   * Fetches nutrition data from Penn State nutrition URL
   * @param nutritionUrl - Penn State nutrition URL
   * @returns Nutrition data object
   */
  private static async fetchNutritionData(nutritionUrl: string): Promise<RawMenuItem['nutrition']> {
    try {
      const response = await pennStateClient.get(nutritionUrl);
      const $ = cheerio.load(response.data);
      
      // Extract nutrition information from the page
      const bodyText = $('body').text();
      
      const nutrition: RawMenuItem['nutrition'] = {};

      // Extract numeric nutrition values using regex patterns
      const nutrientPatterns = {
        calories: /(?:Calories|Energy)[^\d]*(\d+)/i,
        servingSize: /Serving Size[^\n]*?([^\n]+)/i,
        totalFat: /Total Fat[^\d]+([\d.]+)\s*g/i,
        saturatedFat: /Saturated Fat[^\d]+([\d.]+)\s*g/i,
        transFat: /Trans Fat[^\d]+([\d.]+)\s*g/i,
        cholesterol: /Cholesterol[^\d]+([\d.]+)\s*mg/i,
        sodium: /Sodium[^\d]+([\d.]+)\s*mg/i,
        totalCarbs: /Total Carbohydrate[^\d]+([\d.]+)\s*g/i,
        dietaryFiber: /Dietary Fiber[^\d]+([\d.]+)\s*g/i,
        totalSugars: /Total Sugars[^\d]+([\d.]+)\s*g/i,
        addedSugars: /Added Sugars[^\d]+([\d.]+)\s*g/i,
        protein: /Protein[^\d]+([\d.]+)\s*g/i,
      };

      // Extract nutrition values
      for (const [key, pattern] of Object.entries(nutrientPatterns)) {
        const match = bodyText.match(pattern);
        if (match && typeof match[1] === 'string') {
          if (key === 'servingSize') {
            nutrition.servingSize = match[1].trim();
          } else {
            (nutrition as any)[key] = parseFloat(match[1]);
          }
        }
      }

      // Extract ingredients
      const ingredientsMatch = bodyText.match(/Ingredients:\s*([^:]{100,}?)(?=Allergens:|Note:|$)/i);
      if (ingredientsMatch) {
        if (typeof ingredientsMatch[1] === 'string') {
          nutrition.ingredients = ingredientsMatch[1].trim();
        }
      }

      // Extract allergens
      const allergensMatch = bodyText.match(/Allergens:\s*([^:]{10,}?)(?=Note:|$)/i);
      if (allergensMatch) {
        if (typeof allergensMatch[1] === 'string') {
          const allergenText = allergensMatch[1].trim();
          nutrition.allergens = allergenText
            .split(/[,;]/)
            .map(a => a.trim())
            .filter(a => a && a.length > 1);
        }
      }

      return nutrition;

    } catch (error) {
      console.warn(`[Menu] Error fetching nutrition data:`, error);
      return {};
    }
  }

  /**
   * Gets or creates a location in the database
   * @param locationConfig - Location configuration
   * @returns Database location record
   */
  private static async getOrCreateLocation(locationConfig: typeof UP_LOCATIONS[0]): Promise<MenuLocation> {
    try {
      const locations = await MenuModel.getLocations();
      const existing = locations.find(loc => loc.locationId === locationConfig.id);
      
      if (existing) {
        return existing;
      }

      // This would require implementing location creation in MenuModel
      // For now, assume locations are already seeded in database
      throw new Error(`Location ${locationConfig.name} not found in database`);
    } catch (error) {
      console.error(`[Menu] Error getting/creating location:`, error);
      throw error;
    }
  }

  /**
   * Finds a location by name
   * @param locationName - Location name
   * @returns Database location record or null
   */
  private static async findLocationByName(locationName: string): Promise<MenuLocation | null> {
    try {
      const locations = await MenuModel.getLocations();
      return locations.find(loc => loc.name === locationName) || null;
    } catch (error) {
      console.error(`[Menu] Error finding location:`, error);
      return null;
    }
  }

  /**
   * Converts raw menu item to database format
   * @param rawItem - Raw scraped item
   * @param locationId - Database location ID
   * @param date - Menu date
   * @param mealPeriod - Meal period
   * @returns Create data object
   */
  private static convertRawItemToCreateData(
    rawItem: RawMenuItem, 
    locationId: string, 
    date: Date, 
    mealPeriod: string
  ): CreateMenuItemData {
    const { nutrition } = rawItem;
    
    // Determine dietary flags from allergens and ingredients
    const allergenList = nutrition.allergens || [];
    const ingredients = (nutrition.ingredients || '').toLowerCase();
    
    const isVegetarian = !ingredients.includes('meat') && 
                        !ingredients.includes('chicken') && 
                        !ingredients.includes('beef') && 
                        !ingredients.includes('pork') &&
                        !ingredients.includes('fish');
    
    const isVegan = isVegetarian && 
                   !allergenList.some(a => ['milk', 'eggs', 'dairy'].includes(a.toLowerCase()));
    
    const isGlutenFree = !allergenList.some(a => ['wheat', 'gluten'].includes(a.toLowerCase()));

    return {
      itemId: rawItem.id || `unknown_${Date.now()}`,
      name: rawItem.name,
      locationId,
      date,
      mealPeriod,
      calories: nutrition.calories ?? 0,
      totalFat: nutrition.totalFat ?? 0,
      saturatedFat: nutrition.saturatedFat ?? 0,
      transFat: nutrition.transFat ?? 0,
      cholesterol: nutrition.cholesterol ?? 0,
      sodium: nutrition.sodium ?? 0,
      totalCarbs: nutrition.totalCarbs ?? 0,
      dietaryFiber: nutrition.dietaryFiber ?? 0,
      totalSugars: nutrition.totalSugars ?? 0,
      addedSugars: nutrition.addedSugars ?? 0,
      protein: nutrition.protein ?? 0,
      servingSize: nutrition.servingSize ?? '',
      ingredients: nutrition.ingredients ?? '',
      allergens: nutrition.allergens ?? [],
      isVegetarian,
      isVegan,
      isGlutenFree,
      nutritionUrl: rawItem.nutritionUrl,
    };
  }

  /**
   * Gets current meal period based on time
   * @returns Current meal period
   */
  private static getCurrentMealPeriod(): MealPeriod {
    // Always default to Dinner since it has location-specific menus
    // Breakfast/Lunch often return the same menu for all locations
    return 'Dinner';
    
    /* Original time-based logic commented out since Breakfast has no location-specific menus
    const now = new Date();
    const hour = now.getHours();

    if (hour < 11) {
      return 'Breakfast';
    } else if (hour < 16) {
      return 'Lunch';
    } else {
      return 'Dinner';
    }
    */
  }

  /**
   * Formats date for Penn State API
   * @param date - Date object
   * @returns Formatted date string
   */
  private static formatDateForPennState(date: Date): string {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear().toString().slice(-2);
    
    // Format exactly like the working smoke test: 9/14/25
    return `${month}/${day}/${year}`;
  }

  /**
   * Calculates nutrition success rate for scraped items
   * @param items - Array of raw menu items
   * @returns Success rate percentage
   */
  private static calculateNutritionSuccessRate(items: RawMenuItem[]): number {
    if (items.length === 0) return 0;
    
    const itemsWithNutrition = items.filter(item => 
      item.nutrition.calories !== undefined
    ).length;
    
    return Math.round((itemsWithNutrition / items.length) * 100);
  }

  /**
   * Delay helper function
   * @param ms - Milliseconds to delay
   * @returns Promise that resolves after delay
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets menu items with advanced filtering
   * @param filters - Menu filters
   * @returns Filtered menu items
   */
  static async getMenuItems(filters: MenuFilters = {}): Promise<MenuItem[]> {
    return MenuModel.getMenuItems(filters);
  }

  /**
   * Gets menu locations
   * @returns Array of menu locations
   */
  static async getLocations(): Promise<MenuLocation[]> {
    return MenuModel.getLocations();
  }

  /**
   * Adds menu item to user favorites
   * @param userId - User ID
   * @param menuItemId - Menu item ID
   * @returns Success boolean
   */
  static async addToFavorites(userId: string, menuItemId: string): Promise<boolean> {
    try {
      await MenuModel.addToFavorites(userId, menuItemId);
      return true;
    } catch (error) {
      console.error('[Menu] Error adding to favorites:', error);
      return false;
    }
  }

  /**
   * Removes menu item from user favorites
   * @param userId - User ID
   * @param menuItemId - Menu item ID
   * @returns Success boolean
   */
  static async removeFromFavorites(userId: string, menuItemId: string): Promise<boolean> {
    return MenuModel.removeFromFavorites(userId, menuItemId);
  }

  /**
   * Gets user's favorite menu items
   * @param userId - User ID
   * @param limit - Maximum number of items to return
   * @returns Array of favorite menu items
   */
  static async getUserFavorites(userId: string, limit = 50): Promise<MenuItem[]> {
    return MenuModel.getUserFavorites(userId, limit);
  }
}