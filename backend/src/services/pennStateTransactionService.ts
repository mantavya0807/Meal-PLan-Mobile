/**
 * Penn State Transaction Fetching Service
 * File Path: backend/src/services/pennStateTransactionService.ts
 * 
 * Service for fetching transaction data from Penn State using the working extraction logic.
 * Integrates with PennStateAuthService and PennStateTransactions model.
 */

import { Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { PennStateTransactionsModel, RawPennStateTransaction, CreateTransactionData } from '../models/PennStateTransactions';

/**
 * Interface for transaction fetching options
 */
export interface TransactionFetchOptions {
  startDate?: Date;
  endDate?: Date;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Transaction fetching result
 */
export interface TransactionFetchResult {
  success: boolean;
  transactionCount: number;
  newTransactionCount: number;
  duplicateCount: number;
  transactions: RawPennStateTransaction[];
  error?: string;
  lastSyncDate: Date;
}

/**
 * Penn State Transaction Fetching Service
 * Uses the proven extraction logic from psu-transact-smoke.ts
 */
export class PennStateTransactionService {
  
  // URLs for Penn State Transact system
  private static readonly TXN_URL = 'https://psu-sp.transactcampus.com/PSU/AccountTransaction.aspx';
  private static readonly ACCOUNT_SUMMARY_URL = 'https://psu-sp.transactcampus.com/PSU/AccountSummary.aspx';
  
  // Default timeout values
  private static readonly GRID_FIRST_WAIT_MS = 60_000;
  private static readonly GRID_RETRY_WAIT_MS = 45_000;
  private static readonly NAVIGATION_TIMEOUT = 45_000;

  /**
   * Fetches transactions for a user using an authenticated browser page
   * @param page - Authenticated Puppeteer page
   * @param userId - User ID for database storage
   * @param options - Fetching options
   * @returns Transaction fetching result
   */
  static async fetchTransactions(
    page: Page, 
    userId: string, 
    options: TransactionFetchOptions = {}
  ): Promise<TransactionFetchResult> {
    const {
      startDate = this.getDefaultStartDate(),
      endDate = new Date(),
      maxRetries = 2,
      timeoutMs = 120_000
    } = options;

    console.log(`[TXN] Fetching transactions for user ${userId} from ${startDate.toDateString()} to ${endDate.toDateString()}`);

    try {
      // Ensure we're on the Transact system
      await this.ensureOnTransactSystem(page);
      
      // Navigate to transaction page
      await this.safeGoto(page, this.TXN_URL, this.NAVIGATION_TIMEOUT);
      console.log('[TXN] Navigated to transaction page');

      // Set up date filters and submit
      console.log('[TXN] Setting up transaction filters...');
      await page.waitForSelector('#MainContent_ContinueButton, #ctl00_MainContent_ResultRadGrid_ctl00', { 
        timeout: 60_000 
      }).catch(() => {});
      
      await this.setDateFiltersAndSubmit(page, startDate, endDate);

      // Wait for transaction grid with retry logic
      console.log('[TXN] Waiting for transaction grid...');
      const gridSelector = '#ctl00_MainContent_ResultRadGrid_ctl00 tbody tr';
      let gridFound = await page.waitForSelector(gridSelector, { 
        timeout: this.GRID_FIRST_WAIT_MS 
      }).catch(() => null);
      
      if (!gridFound) {
        console.log('[TXN] First attempt failed, retrying...');
        await this.safeGoto(page, this.TXN_URL, this.NAVIGATION_TIMEOUT);
        await page.waitForSelector('#MainContent_ContinueButton', { timeout: 30_000 }).catch(() => {});
        await this.setDateFiltersAndSubmit(page, startDate, endDate);
        
        gridFound = await page.waitForSelector(gridSelector, { 
          timeout: this.GRID_RETRY_WAIT_MS 
        }).catch(() => null);
        
        if (!gridFound) {
          throw new Error('Transaction grid not found after retry');
        }
      }

      // Extract transaction data from the table
      console.log('[TXN] Extracting transaction data...');
      const tableHtml = await page.$eval('#ctl00_MainContent_ResultRadGrid_ctl00', 
        (el) => (el as HTMLElement).outerHTML
      );
      
      const rawTransactions = this.extractTransactions(tableHtml);
      console.log(`[TXN] Extracted ${rawTransactions.length} transactions from Penn State`);

      // Store transactions in database
      const storeResult = await this.storeTransactions(userId, rawTransactions);

      return {
        success: true,
        transactionCount: rawTransactions.length,
        newTransactionCount: storeResult.newCount,
        duplicateCount: storeResult.duplicateCount,
        transactions: rawTransactions,
        lastSyncDate: new Date(),
      };

    } catch (error: any) {
      console.error('[TXN] Error fetching transactions:', error);
      
      return {
        success: false,
        transactionCount: 0,
        newTransactionCount: 0,
        duplicateCount: 0,
        transactions: [],
        error: error?.message || 'Unknown error occurred',
        lastSyncDate: new Date(),
      };
    }
  }

  /**
   * Ensures the page is on the Transact system
   * @param page - Puppeteer page
   */
  private static async ensureOnTransactSystem(page: Page): Promise<void> {
    const currentUrl = page.url().toLowerCase();
    
    if (!currentUrl.includes('transactcampus.com')) {
      console.log('[TXN] Not on Transact system, navigating to account summary...');
      await this.safeGoto(page, this.ACCOUNT_SUMMARY_URL, this.NAVIGATION_TIMEOUT);
      
      // Wait for page to load
      await page.waitForSelector('body', { timeout: 30_000 });
      
      const newUrl = page.url().toLowerCase();
      if (!newUrl.includes('transactcampus.com')) {
        throw new Error('Unable to access Penn State Transact system');
      }
    }
    
    console.log('[TXN] Confirmed on Transact system');
  }

  /**
   * Safely navigates to a URL with error handling
   * @param page - Puppeteer page
   * @param url - Target URL
   * @param timeout - Navigation timeout
   */
  private static async safeGoto(page: Page, url: string, timeout: number = 45_000): Promise<void> {
    try {
      console.log(`[TXN] Navigating to: ${url}`);
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout 
      });
    } catch (error: any) {
      console.warn(`[TXN] Navigation warning: ${error?.message}`);
      // Continue anyway - sometimes the page loads despite navigation errors
    }
  }

  /**
   * Sets date filters and submits the form
   * @param page - Puppeteer page
   * @param startDate - Start date for filter
   * @param endDate - End date for filter
   */
  private static async setDateFiltersAndSubmit(page: Page, startDate: Date, endDate: Date): Promise<void> {
    try {
      // Format dates as MM/DD/YYYY (Penn State format)
      const startDateStr = this.formatDateForPennState(startDate);
      const endDateStr = this.formatDateForPennState(endDate);
      
      console.log(`[TXN] Setting date range: ${startDateStr} to ${endDateStr}`);

      // Wait for and fill start date field
      const startDateSelector = '#ctl00_MainContent_StartDatePicker_dateInput, #StartDatePicker_dateInput, input[id*="StartDate"]';
      await page.waitForSelector(startDateSelector, { timeout: 15_000 });
      await page.click(startDateSelector);
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.type(startDateSelector, startDateStr, { delay: 50 });

      // Wait for and fill end date field
      const endDateSelector = '#ctl00_MainContent_EndDatePicker_dateInput, #EndDatePicker_dateInput, input[id*="EndDate"]';
      await page.waitForSelector(endDateSelector, { timeout: 15_000 });
      await page.click(endDateSelector);
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.type(endDateSelector, endDateStr, { delay: 50 });

      // Submit the form
      const submitSelector = '#MainContent_ContinueButton, #ctl00_MainContent_ContinueButton, input[value*="Continue"], button[type="submit"]';
      const submitButton = await page.$(submitSelector);
      
      if (submitButton) {
        console.log('[TXN] Clicking submit button');
        await submitButton.click();
      } else {
        console.log('[TXN] Submit button not found, trying Enter key');
        await page.keyboard.press('Enter');
      }

      // Wait for page to process
      await this.waitForNetworkIdle(page, 1000, 30_000);

    } catch (error: any) {
      console.error('[TXN] Error setting date filters:', error?.message);
      throw new Error('Failed to set date filters on transaction page');
    }
  }

  /**
   * Waits for network to be idle (no requests for specified duration)
   * @param page - Puppeteer page
   * @param idleMs - Idle duration in milliseconds
   * @param maxWaitMs - Maximum wait time
   */
  private static async waitForNetworkIdle(page: Page, idleMs: number = 500, maxWaitMs: number = 30_000): Promise<void> {
    try {
      // Use Puppeteer's networkidle0 for network idle state
      await page.waitForNavigation({ 
        waitUntil: 'networkidle0', 
        timeout: maxWaitMs 
      });
    } catch (error) {
      // If navigation wait fails, just wait for the idle time
      await new Promise(resolve => setTimeout(resolve, idleMs));
      console.warn('[TXN] Network idle timeout (non-critical)');
    }
  }

  /**
   * Extracts transaction data from the HTML table (using proven logic from psu-transact-smoke.ts)
   * @param tableHtml - HTML content of the transaction table
   * @returns Array of raw transaction data
   */
  private static extractTransactions(tableHtml: string): RawPennStateTransaction[] {
    const $ = cheerio.load(tableHtml);
    const transactions: RawPennStateTransaction[] = [];
    
    $('tbody > tr').each((_i, tr) => {
      const tds = $(tr).find('td');
      if (tds.length < 6) return; // Skip rows without enough columns
      
      const dateText = $(tds[0]).text().trim();
      const account = $(tds[1]).text().trim();
      const cardNumber = $(tds[2]).text().trim();
      const location = $(tds[3]).text().trim();
      const type = $(tds[4]).text().trim();
      const amountText = $(tds[5]).text().trim();
      
      // Parse amount using the same logic as the working script
      const { amount, currency } = this.parseAmount(amountText);
      
      // Parse date - try ISO format first, then Date constructor
      const iso = new Date(dateText);
      const date = Number.isNaN(iso.getTime()) ? dateText : iso.toISOString();
      
      transactions.push({
        date,
        account,
        cardNumber,
        location,
        type,
        amount,
        currency
      });
    });
    
    console.log(`[TXN] Extracted ${transactions.length} transactions from table HTML`);
    return transactions;
  }

  /**
   * Parses amount string to number and currency (from psu-transact-smoke.ts)
   * @param amountText - Raw amount text from Penn State
   * @returns Parsed amount and currency
   */
  private static parseAmount(amountText: string): { amount: number; currency: string } {
    const trimmed = amountText.trim();
    const currencyMatch = trimmed.match(/[\$\€\£\¥]/);
    const currency = currencyMatch ? currencyMatch[0] : "";
    const numPart = trimmed.replace(/[^\d\.\-\(\)]/g, "");
    const isNegative = /\(.*\)/.test(trimmed);
    const magnitude = parseFloat(numPart.replace(/[()]/g, "")) || 0;
    
    return { 
      amount: isNegative ? -magnitude : magnitude, 
      currency 
    };
  }

  /**
   * Stores raw transactions in the database
   * @param userId - User ID
   * @param rawTransactions - Raw transaction data from Penn State
   * @returns Storage result with counts
   */
  private static async storeTransactions(
    userId: string, 
    rawTransactions: RawPennStateTransaction[]
  ): Promise<{ newCount: number; duplicateCount: number }> {
    let newCount = 0;
    let duplicateCount = 0;

    console.log(`[TXN] Storing ${rawTransactions.length} transactions for user ${userId}`);

    // Convert and store each transaction
    for (const rawTx of rawTransactions) {
      try {
        // Convert raw transaction to our format
        const transactionData = PennStateTransactionsModel.convertRawTransaction(rawTx, userId);
        
        // Check if transaction already exists
        const exists = await PennStateTransactionsModel.exists(
          userId,
          transactionData.transactionDate,
          transactionData.location,
          transactionData.amount
        );

        if (exists) {
          duplicateCount++;
          continue;
        }

        // Create new transaction record
        await PennStateTransactionsModel.create(transactionData);
        newCount++;

      } catch (error: any) {
        if (error.message?.includes('Duplicate transaction')) {
          duplicateCount++;
        } else {
          console.error('[TXN] Error storing transaction:', error);
        }
      }
    }

    console.log(`[TXN] Storage complete - ${newCount} new, ${duplicateCount} duplicates`);
    
    return { newCount, duplicateCount };
  }

  /**
   * Gets default start date for transaction fetching (6 months ago)
   * @returns Default start date
   */
  private static getDefaultStartDate(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() - 6); // 6 months ago
    return date;
  }

  /**
   * Formats date for Penn State date inputs (MM/DD/YYYY)
   * @param date - Date to format
   * @returns Formatted date string
   */
  private static formatDateForPennState(date: Date): string {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear().toString();
    
    return `${month}/${day}/${year}`;
  }

  /**
   * Fetches only new transactions since the last sync
   * @param page - Authenticated Puppeteer page
   * @param userId - User ID
   * @returns Transaction fetching result for incremental sync
   */
  static async fetchNewTransactions(page: Page, userId: string): Promise<TransactionFetchResult> {
    try {
      // Get the latest transaction date for this user
      const latestDate = await PennStateTransactionsModel.getLatestTransactionDate(userId);
      
      // If no previous transactions, fetch last 30 days
      const startDate = latestDate || this.getDefaultStartDate();
      const endDate = new Date();

      console.log(`[TXN] Incremental sync for user ${userId} since ${startDate.toDateString()}`);

      return await this.fetchTransactions(page, userId, {
        startDate,
        endDate
      });

    } catch (error: any) {
      console.error('[TXN] Error in incremental transaction fetch:', error);
      
      return {
        success: false,
        transactionCount: 0,
        newTransactionCount: 0,
        duplicateCount: 0,
        transactions: [],
        error: error?.message || 'Incremental fetch failed',
        lastSyncDate: new Date(),
      };
    }
  }

  /**
   * Validates that the page is ready for transaction extraction
   * @param page - Puppeteer page
   * @returns True if ready for extraction
   */
  static async validateTransactionPageReady(page: Page): Promise<boolean> {
    try {
      // Check if we're on the right URL
      const url = page.url().toLowerCase();
      if (!url.includes('accounttransaction.aspx')) {
        return false;
      }

      // Check if transaction grid is present
      const gridExists = await page.$('#ctl00_MainContent_ResultRadGrid_ctl00') !== null;
      
      return gridExists;

    } catch (error) {
      console.error('[TXN] Error validating transaction page:', error);
      return false;
    }
  }
}

export default PennStateTransactionService;