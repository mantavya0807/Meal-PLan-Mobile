/**
 * Menu Routes - Penn State Dining Menu API Routes
 * File Path: backend/src/routes/menuRoutes.ts
 * 
 * Express routes for Penn State menu functionality including fetching,
 * searching, favorites management, and manual scraping.
 */

import { Router } from 'express';
import { MenuController } from '../controllers/menuController';
import { authenticateToken } from '../middleware/auth';
import { rateLimitGeneral, rateLimitAuth } from '../middleware/rateLimiter';
import { handleValidationErrors } from '../middleware/validation';
import { body, query, param } from 'express-validator';

/**
 * Create menu routes
 */
export function createMenuRoutes(): Router {
  const router = Router();

  /**
   * Public menu endpoints (no authentication required)
   */

  // GET /api/v1/menu/today - Get today's menu
  router.get('/today',
      rateLimitGeneral,
      query('meal').optional().isIn(['Breakfast', 'Lunch', 'Dinner']).withMessage('Meal must be Breakfast, Lunch, or Dinner'),
      query('locations').optional().isString().withMessage('Locations must be comma-separated location IDs'),
      query('refresh').optional().isBoolean().withMessage('Refresh must be true or false'),
      handleValidationErrors,
    MenuController.getTodaysMenu
  );

  // GET /api/v1/menu/items - Get menu items with filtering
  router.get('/items',
      rateLimitGeneral,
      query('date').optional().isISO8601().withMessage('Date must be in YYYY-MM-DD format'),
      query('locations').optional().isString().withMessage('Locations must be comma-separated location IDs'),
      query('meals').optional().isString().withMessage('Meals must be comma-separated meal periods'),
      query('vegetarian').optional().isBoolean().withMessage('Vegetarian filter must be true or false'),
      query('vegan').optional().isBoolean().withMessage('Vegan filter must be true or false'),
      query('glutenFree').optional().isBoolean().withMessage('GlutenFree filter must be true or false'),
      query('minCalories').optional().isInt({ min: 0 }).withMessage('MinCalories must be a positive integer'),
      query('maxCalories').optional().isInt({ min: 0 }).withMessage('MaxCalories must be a positive integer'),
      query('minProtein').optional().isInt({ min: 0 }).withMessage('MinProtein must be a positive integer'),
      query('search').optional().isString().isLength({ min: 2, max: 100 }).withMessage('Search term must be between 2 and 100 characters'),
      query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
      query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be 0 or greater'),
      handleValidationErrors,
    MenuController.getMenuItems
  );

  // GET /api/v1/menu/locations - Get all dining locations
  router.get('/locations',
      rateLimitGeneral,
    MenuController.getLocations
  );

  // GET /api/v1/menu/stats - Get menu statistics
  router.get('/stats',
      rateLimitGeneral,
      query('date').optional().isISO8601().withMessage('Date must be in YYYY-MM-DD format'),
      handleValidationErrors,
    MenuController.getMenuStats
  );

  /**
   * Administrative endpoints (stricter rate limiting)
   */

  // POST /api/v1/menu/scrape - Manually trigger menu scraping
  router.post('/scrape',
      rateLimitAuth,
      body('date').optional().isISO8601().withMessage('Date must be in YYYY-MM-DD format'),
      body('meal').optional().isIn(['Breakfast', 'Lunch', 'Dinner']).withMessage('Meal must be Breakfast, Lunch, or Dinner'),
      body('locations').optional().isArray().withMessage('Locations must be an array of location IDs'),
      body('locations.*').optional().isInt({ min: 1 }).withMessage('Each location ID must be a positive integer'),
      body('force').optional().isBoolean().withMessage('Force must be true or false'),
      handleValidationErrors,
    MenuController.scrapeMenu
  );

  /**
   * User-specific endpoints (authentication required)
   */

  // GET /api/v1/menu/favorites - Get user's favorite menu items
  router.get('/favorites',
      rateLimitGeneral,
      authenticateToken,
      query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
      handleValidationErrors,
    MenuController.getUserFavorites
  );

  // POST /api/v1/menu/favorites/:itemId - Add item to favorites
  router.post('/favorites/:itemId',
      rateLimitGeneral,
      authenticateToken,
      param('itemId').isUUID().withMessage('Item ID must be a valid UUID'),
      handleValidationErrors,
    MenuController.addToFavorites
  );

  // DELETE /api/v1/menu/favorites/:itemId - Remove item from favorites
  router.delete('/favorites/:itemId',
      rateLimitGeneral,
      authenticateToken,
      param('itemId').isUUID().withMessage('Item ID must be a valid UUID'),
      handleValidationErrors,
    MenuController.removeFromFavorites
  );

  return router;
}

/**
 * Export the router instance
 */
const menuRoutes = createMenuRoutes();
export default menuRoutes;