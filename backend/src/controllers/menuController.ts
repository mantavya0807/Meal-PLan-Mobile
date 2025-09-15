/**
 * Menu Controller - Penn State Dining Menu API Endpoints
 * File Path: backend/src/controllers/menuController.ts
 * 
 * Express controller for handling Penn State menu-related requests.
 * Provides endpoints for menu fetching, searching, favorites, and scraping.
 */

import { Request, Response } from 'express';
import { MenuService, MEAL_PERIODS } from '../services/menuService';
import { MenuModel } from '../models/Menu';

/**
 * Interface for authenticated requests (from auth middleware)
 */
interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * Menu controller class
 */
export class MenuController {

  /**
   * Gets today's menu for all locations
   * GET /api/v1/menu/today
   */
  static async getTodaysMenu(req: Request, res: Response) {
    try {
      const { meal, locations, refresh } = req.query;

      const mealPeriod = meal && MEAL_PERIODS.includes(meal as any) 
        ? meal as typeof MEAL_PERIODS[number]
        : undefined;

      const locationIds = locations 
        ? String(locations).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        : undefined;

      const forceRefresh = refresh === 'true';

      console.log(`[MenuController] Getting today's menu - Meal: ${mealPeriod}, Locations: ${locationIds}, Refresh: ${forceRefresh}`);

      const menuItems = await MenuService.getTodaysMenu({
        mealPeriod: mealPeriod ?? 'Breakfast',
        locationIds: locationIds ?? [],
        forceRefresh,
      });

      // Group items by location and meal period for better frontend consumption
      const groupedMenu = menuItems.reduce((acc, item) => {
        const locationKey = item.locationId;
        const mealKey = item.mealPeriod;

        if (!acc[locationKey]) {
          acc[locationKey] = {};
        }
        
        if (!acc[locationKey][mealKey]) {
          acc[locationKey][mealKey] = [];
        }

        acc[locationKey][mealKey].push(item);
        return acc;
      }, {} as any);

      res.status(200).json({
        success: true,
        message: `Found ${menuItems.length} menu items for today`,
        data: {
          items: menuItems,
          grouped: groupedMenu,
          date: new Date().toISOString().split('T')[0],
          mealPeriod: mealPeriod || 'All',
          locationCount: new Set(menuItems.map(item => item.locationId)).size,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('[MenuController] Error getting today\'s menu:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch today\'s menu',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Gets menu items with advanced filtering
   * GET /api/v1/menu/items
   */
  static async getMenuItems(req: Request, res: Response) {
    try {
      const {
        date,
        locations,
        meals,
        categories,
        vegetarian,
        vegan,
        glutenFree,
        allergens,
        excludeAllergens,
        minCalories,
        maxCalories,
        minProtein,
        search,
        limit,
        offset,
      } = req.query;

      // Parse date
      const targetDate = date ? new Date(String(date)) : undefined;
      if (date && isNaN(targetDate!.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD',
          timestamp: new Date().toISOString(),
        });
      }

      // Parse filters
      const filters = {
        date: targetDate ?? new Date(),
        locationIds: locations 
          ? String(locations).split(',').map(id => id.trim()).filter(id => id)
          : [],
        mealPeriods: meals 
          ? String(meals).split(',').map(meal => meal.trim()).filter(meal => MEAL_PERIODS.includes(meal as any))
          : [],
        categories: categories 
          ? String(categories).split(',').map(cat => cat.trim()).filter(cat => cat)
          : [],
        isVegetarian: vegetarian === 'true',
        isVegan: vegan === 'true',
        isGlutenFree: glutenFree === 'true',
        hasAllergens: allergens 
          ? String(allergens).split(',').map(a => a.trim()).filter(a => a)
          : [],
        excludeAllergens: excludeAllergens 
          ? String(excludeAllergens).split(',').map(a => a.trim()).filter(a => a)
          : [],
        minCalories: minCalories ? parseInt(String(minCalories)) : 0,
        maxCalories: maxCalories ? parseInt(String(maxCalories)) : 0,
        minProtein: minProtein ? parseInt(String(minProtein)) : 0,
  search: search ? String(search) : '',
        limit: limit ? parseInt(String(limit)) : 50,
        offset: offset ? parseInt(String(offset)) : 0,
      };

      console.log('[MenuController] Getting menu items with filters:', filters);

      const menuItems = await MenuService.getMenuItems(filters);

      // Get basic stats for the filtered results
      const stats = {
        totalItems: menuItems.length,
        mealBreakdown: menuItems.reduce((acc, item) => {
          acc[item.mealPeriod] = (acc[item.mealPeriod] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        locationBreakdown: menuItems.reduce((acc, item) => {
          acc[item.locationId] = (acc[item.locationId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        nutritionSummary: {
          averageCalories: menuItems.length > 0 
            ? Math.round(menuItems.filter(item => item.calories).reduce((sum, item) => sum + (item.calories || 0), 0) / menuItems.filter(item => item.calories).length)
            : 0,
          vegetarianCount: menuItems.filter(item => item.isVegetarian).length,
          veganCount: menuItems.filter(item => item.isVegan).length,
          glutenFreeCount: menuItems.filter(item => item.isGlutenFree).length,
        }
      };

      res.status(200).json({
        success: true,
        message: `Found ${menuItems.length} menu items`,
        data: {
          items: menuItems,
          stats,
          filters: {
            applied: Object.entries(filters)
              .filter(([_, value]) => value !== undefined)
              .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
          },
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('[MenuController] Error getting menu items:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch menu items',
        timestamp: new Date().toISOString(),
      });
    }
    return;
  }

  /**
   * Gets all dining locations
   * GET /api/v1/menu/locations
   */
  static async getLocations(req: Request, res: Response) {
    try {
      const locations = await MenuService.getLocations();

      res.status(200).json({
        success: true,
        message: `Found ${locations.length} dining locations`,
        data: {
          locations,
          count: locations.length,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('[MenuController] Error getting locations:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dining locations',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Manually triggers menu scraping
   * POST /api/v1/menu/scrape
   */
  static async scrapeMenu(req: Request, res: Response) {
    try {
      const { date, meal, locations, force } = req.body;

      // Parse date
      const targetDate = date ? new Date(date) : new Date();
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD',
          timestamp: new Date().toISOString(),
        });
      }

      // Validate meal period
      const mealPeriod = meal && MEAL_PERIODS.includes(meal) ? meal : undefined;
      if (meal && !mealPeriod) {
        return res.status(400).json({
          success: false,
          message: `Invalid meal period. Use one of: ${MEAL_PERIODS.join(', ')}`,
          timestamp: new Date().toISOString(),
        });
      }

      const locationIds = locations ? locations.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id)) : undefined;
      const forceRefresh = force === true;

      console.log(`[MenuController] Manual scrape triggered - Date: ${targetDate.toDateString()}, Meal: ${mealPeriod}, Locations: ${locationIds}, Force: ${forceRefresh}`);

      const result = await MenuService.scrapeMenusForDate(targetDate, mealPeriod || 'Dinner', {
        locationIds,
        forceRefresh,
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Menu scraping failed',
          data: {
            errors: result.errors,
            partialResults: result.locations,
          },
          timestamp: new Date().toISOString(),
        });
      }

      res.status(200).json({
        success: true,
        message: `Successfully scraped ${result.totalItems} menu items`,
        data: {
          scrapingResult: result,
          summary: {
            totalItems: result.totalItems,
            itemsWithNutrition: result.itemsWithNutrition,
            nutritionSuccessRate: result.totalItems > 0 ? Math.round((result.itemsWithNutrition / result.totalItems) * 100) : 0,
            processingTimeSeconds: Math.round(result.processingTime / 1000),
            locationsProcessed: result.locations.length,
          },
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('[MenuController] Error during manual scraping:', error);
      
      res.status(500).json({
        success: false,
        message: 'Menu scraping failed with error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
    return;
  }

  /**
   * Gets user's favorite menu items
   * GET /api/v1/menu/favorites
   */
  static async getUserFavorites(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
      }

      const { limit } = req.query;
      const maxLimit = limit ? parseInt(String(limit)) : 50;

      const favorites = await MenuService.getUserFavorites(req.userId, maxLimit);

      res.status(200).json({
        success: true,
        message: `Found ${favorites.length} favorite menu items`,
        data: {
          favorites,
          count: favorites.length,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('[MenuController] Error getting user favorites:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch favorite menu items',
        timestamp: new Date().toISOString(),
      });
    }
    return;
  }

  /**
   * Adds a menu item to user's favorites
   * POST /api/v1/menu/favorites/:itemId
   */
  static async addToFavorites(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
      }

      const { itemId } = req.params;

      if (!itemId) {
        return res.status(400).json({
          success: false,
          message: 'Menu item ID is required',
          timestamp: new Date().toISOString(),
        });
      }

      const success = await MenuService.addToFavorites(req.userId, itemId);

      if (!success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to add item to favorites',
          timestamp: new Date().toISOString(),
        });
      }

      res.status(201).json({
        success: true,
        message: 'Item added to favorites',
        data: {
          menuItemId: itemId,
          userId: req.userId,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('[MenuController] Error adding to favorites:', error);
      
      // Handle duplicate favorite attempt
      if (error instanceof Error && error.message.includes('duplicate')) {
        return res.status(409).json({
          success: false,
          message: 'Item is already in favorites',
          timestamp: new Date().toISOString(),
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to add item to favorites',
        timestamp: new Date().toISOString(),
      });
    }
    return;
  }

  /**
   * Removes a menu item from user's favorites
   * DELETE /api/v1/menu/favorites/:itemId
   */
  static async removeFromFavorites(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
      }

      const { itemId } = req.params;

      if (!itemId) {
        return res.status(400).json({
          success: false,
          message: 'Menu item ID is required',
          timestamp: new Date().toISOString(),
        });
      }

      const success = await MenuService.removeFromFavorites(req.userId, itemId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Favorite not found or already removed',
          timestamp: new Date().toISOString(),
        });
      }

      res.status(200).json({
        success: true,
        message: 'Item removed from favorites',
        data: {
          menuItemId: itemId,
          userId: req.userId,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('[MenuController] Error removing from favorites:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to remove item from favorites',
        timestamp: new Date().toISOString(),
      });
    }
    return;
  }

  /**
   * Gets menu statistics and analytics
   * GET /api/v1/menu/stats
   */
  static async getMenuStats(req: Request, res: Response) {
    try {
      const { date } = req.query;

      // Parse date if provided
      const targetDate = date ? new Date(String(date)) : undefined;
      if (date && isNaN(targetDate!.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD',
          timestamp: new Date().toISOString(),
        });
      }

      const stats = await MenuModel.getMenuStats(targetDate);

      res.status(200).json({
        success: true,
        message: 'Menu statistics retrieved',
        data: {
          stats,
          dateFilter: targetDate ? targetDate.toISOString().split('T')[0] : 'All dates',
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('[MenuController] Error getting menu stats:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch menu statistics',
        timestamp: new Date().toISOString(),
      });
    }
    return;
  }
}