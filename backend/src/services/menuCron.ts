/**
 * Penn State Menu Cron Service
 * Scrapes all 3 meal periods for all 5 UP locations once per day and on server start if missing.
 */

import { MenuService, MEAL_PERIODS } from './menuService';
import { MenuModel } from '../models/Menu';
import cron from 'node-cron';

const scrapeAllMealsForToday = async () => {
  const today = new Date();
  for (const meal of MEAL_PERIODS) {
    try {
      await MenuService.scrapeMenusForDate(today, meal, { forceRefresh: true });
      console.log(`[MenuCron] Scraped ${meal} for all locations on ${today.toDateString()}`);
    } catch (err) {
      console.error(`[MenuCron] Error scraping ${meal}:`, err);
    }
  }
};

export const startMenuCron = async () => {
  // On server start, check if today's menu exists for all meals
  const today = new Date();
  for (const meal of MEAL_PERIODS) {
    const items = await MenuModel.getMenuItems({ date: today, mealPeriods: [meal] });
    if (!items || items.length === 0) {
      console.log(`[MenuCron] No cached menu for ${meal} - scraping now...`);
      await MenuService.scrapeMenusForDate(today, meal, { forceRefresh: true });
    }
  }

  // Schedule daily scrape at 3:30am
  cron.schedule('30 3 * * *', async () => {
    console.log('[MenuCron] Running daily menu scrape for all meals/locations...');
    await scrapeAllMealsForToday();
  });

  console.log('[MenuCron] Cron service initialized.');
};
