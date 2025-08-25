/**
 * Penn State Authentication Service - Updated with Push Notification Flow
 * File Path: backend/src/services/pennStateAuthService.ts
 * 
 * Handles Penn State login with Microsoft push notifications and 2-digit number matching.
 * Based on the working script flow that successfully authenticates.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import config from '../config/environment';

/**
 * Interface for Penn State login credentials
 */
interface PennStateCredentials {
  email: string;
  password: string;
}

/**
 * Result interface for authentication attempts
 */
interface AuthResult {
  success: boolean;
  message: string;
  requiresMFA?: boolean;
  numberMatchCode?: string; // 2-digit code for push notification
  sessionId?: string; // Session ID for tracking auth state
  sessionData?: {
    cookies: any[];
    userAgent: string;
  };
  error?: string;
}

/**
 * Interface for checking push notification status
 */
interface PushApprovalResult {
  success: boolean;
  approved: boolean;
  message: string;
  sessionData?: {
    cookies: any[];
    userAgent: string;
  };
}

/**
 * Penn State Authentication Service - Using Push Notifications with Number Matching
 */
export class PennStateAuthService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private sessionId: string | null = null;

  // Static storage for active sessions (in production, use Redis)
  private static activeSessions: Map<string, PennStateAuthService> = new Map();

  // URLs that indicate we're on the Transact system
  private readonly TRANSACT_URLS = [
    'transactcampus.com',
    'accountsummary.aspx',
    'accounttransaction.aspx'
  ];

  // Target URLs for the meal plan system
  private readonly TARGET_URL = 'https://psu-sp.transactcampus.com/PSU/AccountSummary.aspx';
  private readonly TXN_URL = 'https://psu-sp.transactcampus.com/PSU/AccountTransaction.aspx';
  private readonly MICROSOFT_LOGIN = 'https://login.microsoftonline.com/';

  /**
   * Initializes the headless browser
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Penn State authentication browser...');
      
      // Generate a session ID for this auth instance
      this.sessionId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.browser = await puppeteer.launch({
        headless: false, // Set to false for debugging
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1200,900',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors',
          '--ignore-certificate-errors-spki-list',
          '--disable-web-security'
        ],
        defaultViewport: {
          width: 1200,
          height: 900
        },
      });

      this.page = await this.browser.newPage();
      
      // Set realistic user agent
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36');
      
      // Store this session for later retrieval
      PennStateAuthService.activeSessions.set(this.sessionId, this);
      
      console.log('Browser initialized successfully');
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw new Error('Browser initialization failed');
    }
  }

  /**
   * Gets session ID for this auth instance
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Retrieves an auth session by ID
   */
  static getSession(sessionId: string): PennStateAuthService | null {
    return PennStateAuthService.activeSessions.get(sessionId) || null;
  }

  /**
   * Removes a session from memory
   */
  static removeSession(sessionId: string): void {
    PennStateAuthService.activeSessions.delete(sessionId);
  }

  /**
   * Checks if current URL is on Transact system
   */
  private isOnTransact(url: string): boolean {
    const lowercaseUrl = url.toLowerCase();
    return this.TRANSACT_URLS.some(pattern => lowercaseUrl.includes(pattern));
  }

  /**
   * Waits for network to be idle
   */
  private async waitForNetworkIdle(page: Page, idleMs = 600, timeoutMs = 15000): Promise<void> {
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: timeoutMs }),
        new Promise(resolve => setTimeout(resolve, Math.min(timeoutMs, 2000)))
      ]);
    } catch (error) {
      // Network idle timeout is not critical
      console.log('Network idle timeout (non-critical)');
    }
  }

  /**
   * Safely navigates to a URL
   */
  private async safeGoto(page: Page, url: string, timeout = 45000): Promise<boolean> {
    try {
      console.log(`Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      return true;
    } catch (error: any) {
      console.log('Navigation error:', error?.message || error);
      return false;
    }
  }

  /**
   * Extracts the 2-digit number match code from the page for push notifications
   * Based on the working implementation from psu-transact-smoke.ts
   */
  private async extractNumberMatchCode(page: Page): Promise<string | undefined> {
    try {
      // Take a screenshot for debugging
      await this.takeScreenshot(`debug-2fa-${Date.now()}.png`);
      
      // Get the page content for debugging
      const pageContent = await page.evaluate(() => document.body?.innerText || '');
      console.log('Page content excerpt:', pageContent.substring(0, 500));
      
      const result = await page.evaluate(() => {
        const text = document.body?.innerText || '';
        console.log('Full page text length:', text.length);
        console.log('Text excerpt:', text.substring(0, 1000));
        
        // Look for 2-digit numbers in the page content - match the working script exactly
        const matches = Array.from(text.matchAll(/\b(\d{2})\b/g)).map((m) => m[1]);
        console.log('All 2-digit matches found:', matches);
        
        // Also look for specific Microsoft Authenticator patterns
        const authPatterns = [
          /enter\s+(?:the\s+)?number\s+(\d{2})/i,
          /number\s+(\d{2})/i,
          /code\s+(\d{2})/i,
          /(\d{2})\s+on\s+your/i,
          /(\d{2})\s+in\s+the/i
        ];
        
        for (const pattern of authPatterns) {
          const match = text.match(pattern);
          if (match) {
            console.log('Found number with pattern:', pattern, 'result:', match[1]);
            matches.unshift(match[1]); // Add to beginning
          }
        }
        
        return matches;
      });
      
      // Return the first 2-digit number found (matches working script)
      console.log('Number match codes found:', result);
      return result[0];
    } catch (error) {
      console.error('Error extracting number match code:', error);
      return undefined;
    }
  }

  /**
   * Submits Microsoft credentials using the working flow from the script
   */
  private async submitMicrosoftCredentials(page: Page, email: string, password: string): Promise<'awaiting_mfa' | 'authenticated'> {
    try {
      // Step 1: Enter email and click Next (using exact working script logic)
      await page.waitForSelector('input[type="email"], #i0116', { timeout: 45000 });
      const emailSelector = (await page.$('input[type="email"]')) ? 'input[type="email"]' : '#i0116';
      
      console.log(`Entering email: ${email}`);
      await page.click(emailSelector).catch(() => {});
      
      // Clear any existing content first
      await page.evaluate((selector) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
          input.value = '';
          input.focus();
        }
      }, emailSelector);
      
      // Wait a moment for the field to be ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Type email directly into the field
      await page.type(emailSelector, email, { delay: 10 });
      
      // Take a screenshot after entering email for debugging
      await this.takeScreenshot(`debug-email-entered-${Date.now()}.png`);
      
      // Click Next button (using working script approach)
      const nextButton = await page.$('#idSIButton9, button[type="submit"]');
      if (nextButton) {
        await nextButton.click();
      } else {
        await page.keyboard.press('Enter');
      }
      
      await this.waitForNetworkIdle(page, 800, 15000);

      // Step 2: Enter password and sign in (using exact working script logic)
      await page.waitForSelector('input[type="password"], #i0118', { timeout: 45000 });
      const passwordSelector = (await page.$('input[type="password"]')) ? 'input[type="password"]' : '#i0118';
      
      console.log(`Entering password for: ${email}`);
      await page.click(passwordSelector).catch(() => {});
      
      // Clear any existing content first
      await page.evaluate((selector) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
          input.value = '';
          input.focus();
        }
      }, passwordSelector);
      
      // Wait a moment for the field to be ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Type password directly into the field with slower delay
      await page.type(passwordSelector, password, { delay: 35 });
      
      // Verify the password was entered correctly
      const enteredPassword = await page.evaluate((selector) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        return input ? input.value : '';
      }, passwordSelector);
      
      console.log(`Password verification - entered: ${enteredPassword.length} chars, expected: ${password.length} chars`);
      
      // Take a screenshot after entering password for debugging
      await this.takeScreenshot(`debug-password-entered-${Date.now()}.png`);
      
      // Click Sign In button (using working script approach)
      const signInButton = await page.$('#idSIButton9, button[type="submit"]');
      if (signInButton) {
        await signInButton.click();
      } else {
        await page.keyboard.press('Enter');
      }
      
      await this.waitForNetworkIdle(page, 800, 20000);

      // Check if we're already authenticated (reached Transact)
      if (this.isOnTransact(page.url())) {
        return 'authenticated';
      }

      // Check for OTP input (TOTP codes) - we don't want this
      const otpInput = await page.$('input[name="otc"], #idTxtBx_SAOTCC_OTC');
      if (otpInput) {
        return 'awaiting_mfa';
      }

      // Check page content for push notification indicators (using working script logic)
      const bodyText = await page.evaluate(() => document.body?.innerText?.toLowerCase() || '');
      const pushIndicators = [
        'approve sign-in request',
        'enter the number',
        'use the microsoft authenticator'
      ];

      const requiresMFA = pushIndicators.some(indicator => bodyText.includes(indicator));
      return requiresMFA ? 'awaiting_mfa' : 'awaiting_mfa';

    } catch (error) {
      console.error('Microsoft credential submission error:', error);
      throw new Error('Failed to submit Microsoft credentials');
    }
  }

  /**
   * Waits for push notification approval with timeout
   */
  private async waitForPushApproval(page: Page, timeoutMs = 120000): Promise<boolean> {
    const endTime = Date.now() + timeoutMs;
    
    console.log('Waiting for push notification approval...');
    
    while (Date.now() < endTime) {
      const currentUrl = page.url().toLowerCase();
      
      // Check if we've reached Transact or SAML endpoints (success)
      if (this.isOnTransact(currentUrl) || 
          currentUrl.includes('/saml2') || 
          currentUrl.includes('/sas/processauth')) {
        console.log('Push notification approved - reached target system');
        return true;
      }

      // Handle "Stay signed in?" prompt if it appears
      try {
        const staySignedInNo = await page.$('#idBtn_Back');
        if (staySignedInNo) {
          console.log('Handling "Stay signed in?" prompt');
          await staySignedInNo.click();
          await this.waitForNetworkIdle(page, 600, 10000);
        }
      } catch (error) {
        // Continue waiting
      }

      // Small delay before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('Push notification approval timed out');
    return false;
  }

  /**
   * Attempts to login to Penn State with provided credentials
   */
  async login(credentials: PennStateCredentials): Promise<AuthResult> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      console.log(`Attempting Penn State login for: ${credentials.email}`);

      // Start with Microsoft login
      const success = await this.safeGoto(this.page, this.MICROSOFT_LOGIN, 60000);
      if (!success) {
        return {
          success: false,
          message: 'Unable to reach Microsoft login page',
          error: 'Navigation failed'
        };
      }

      // Submit Microsoft credentials
      const authStatus = await this.submitMicrosoftCredentials(this.page, credentials.email, credentials.password);

      if (authStatus === 'authenticated') {
        // Login successful without 2FA
        console.log('Penn State login successful without 2FA');
        
        const cookies = await this.page.cookies();
        const userAgent = await this.page.evaluate(() => navigator.userAgent);
        
        return {
          success: true,
          message: 'Login successful',
          sessionData: { cookies, userAgent }
        };

      } else {
        // 2FA required - extract the number match code
        console.log('Penn State login requires 2FA verification');
        
        // Wait a moment for the page to fully load the 2FA content
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try to extract the number match code
        const numberMatchCode = await this.extractNumberMatchCode(this.page);
        
        if (numberMatchCode) {
          console.log(`2FA number match code extracted: ${numberMatchCode}`);
          
          return {
            success: false,
            requiresMFA: true,
            numberMatchCode: numberMatchCode,
            sessionId: this.sessionId!,
            message: `Please open your Microsoft Authenticator app and approve the sign-in request. Enter the number shown: ${numberMatchCode}`
          };
        } else {
          console.log('No number match code found, using generic push notification message');
          
          return {
            success: false,
            requiresMFA: true,
            sessionId: this.sessionId!,
            message: 'Please approve the sign-in request in your Microsoft Authenticator app.'
          };
        }
      }

    } catch (error: any) {
      console.error('Penn State login error:', error);
      return {
        success: false,
        message: 'Login failed due to technical error',
        error: error?.message || 'Unknown error'
      };
    }
  }

  /**
   * Robust landing: race the current tab finishing SSO vs. a fresh tab going
   * straight to the portal. Based on landOnPortalWithRace from working script.
   * Returns the tab that actually reached Transact.
   */
  private async landOnPortalWithRace(): Promise<Page | null> {
    if (!this.page || !this.browser) return null;

    const ctx = this.browser;
    const LANDING_RACE_TIMEOUT_MS = 60000;

    try {
      // Contender #1: keep driving current tab
      const p1 = (async () => {
        // Small wait to allow SAML to settle
        await this.waitForNetworkIdle(this.page!, 800, 15000);
        if (!this.isOnTransact(this.page!.url())) {
          await this.safeGoto(this.page!, this.TARGET_URL, 45000);
        }
        if (!this.isOnTransact(this.page!.url())) {
          await this.safeGoto(this.page!, this.TXN_URL, 45000);
        }
        return this.page!;
      })();

      // Contender #2: brand new tab into TXN_URL (bypasses UI modal blocking original tab)
      const p2 = (async () => {
        const tab = await ctx.newPage();
        await tab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36');
        await this.safeGoto(tab, this.TXN_URL, 60000);
        return tab;
      })();

      // Watchdog that taps Escape while we wait (helps dismiss occasional native sheets)
      const watchdog = (async () => {
        const start = Date.now();
        while (Date.now() - start < LANDING_RACE_TIMEOUT_MS) {
          try { 
            await this.page!.keyboard.press('Escape'); 
          } catch {}
          await new Promise((r) => setTimeout(r, 1200));
        }
        throw new Error('portal race timeout');
      })();

      let winner: Page;
      try {
        winner = await Promise.race([p1, p2, watchdog]) as Page;
      } catch {
        // Last chance: prefer any tab that's on Transact
        const pages = await ctx.pages();
        const candidate = pages.find((t) => this.isOnTransact(t.url()));
        if (!candidate) throw new Error('Timed out reaching Transact');
        winner = candidate;
      }

      // Close the loser tabs if they're not the winner
      const pages = await ctx.pages();
      for (const t of pages) {
        if (t !== winner && !this.isOnTransact(t.url())) {
          try { 
            await t.close(); 
          } catch {}
        }
      }
      
      return winner;
    } catch (error) {
      console.error('landOnPortalWithRace failed:', error);
      return null;
    }
  }

  /**
   * Checks if the push notification has been approved
   */
  async checkPushApproval(): Promise<PushApprovalResult> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      console.log('Checking push notification approval status...');

      // Check current URL to see if we've been redirected to success
      const currentUrl = this.page.url().toLowerCase();
      
      if (this.isOnTransact(currentUrl) || 
          currentUrl.includes('/saml2') || 
          currentUrl.includes('/sas/processauth')) {
        
        console.log('Push notification has been approved - already on Transact');
        
        const cookies = await this.page.cookies();
        const userAgent = await this.page.evaluate(() => navigator.userAgent);
        
        return {
          success: true,
          approved: true,
          message: 'Push notification approved successfully',
          sessionData: { cookies, userAgent }
        };
      }

      // Check for success indicators in page content
      const bodyText = await this.page.evaluate(() => document.body?.innerText || '');
      
      // Check for error messages first
      if (bodyText.toLowerCase().includes('request has been denied') ||
          bodyText.toLowerCase().includes('authentication failed')) {
        return {
          success: false,
          approved: false,
          message: 'Push notification was denied'
        };
      }

      // Check if we're still on the approval page but need to wait
      if (bodyText.toLowerCase().includes('waiting for approval') ||
          bodyText.toLowerCase().includes('approve sign-in request')) {
        
        // Try the landOnPortalWithRace approach from working script
        try {
          console.log('Attempting to reach Transact portal using race strategy...');
          const portalPage = await this.landOnPortalWithRace();
          
          if (portalPage && this.isOnTransact(portalPage.url())) {
            console.log('Push notification approved - successfully reached Transact portal via race strategy');
            
            // Update our page reference to the successful one
            this.page = portalPage;
            
            const cookies = await portalPage.cookies();
            const userAgent = await portalPage.evaluate(() => navigator.userAgent);
            
            return {
              success: true,
              approved: true,
              message: 'Push notification approved successfully',
              sessionData: { cookies, userAgent }
            };
          }
        } catch (navError) {
          console.log('Race strategy failed, still waiting for approval:', navError);
        }
      }

      // Still waiting for approval
      return {
        success: true,
        approved: false,
        message: 'Still waiting for push notification approval'
      };

    } catch (error: any) {
      console.error('Error checking push approval:', error);
      return {
        success: false,
        approved: false,
        message: 'Error checking push notification status',
      };
    }
  }

  /**
   * Waits for push approval with periodic status updates
   */
  async waitForPushApprovalWithUpdates(timeoutMs = 120000): Promise<PushApprovalResult> {
    const endTime = Date.now() + timeoutMs;
    
    while (Date.now() < endTime) {
      const result = await this.checkPushApproval();
      
      if (result.approved || !result.success) {
        return result;
      }

      // Handle "Stay signed in?" prompt if it appears
      try {
        const staySignedInNo = await this.page!.$('#idBtn_Back');
        if (staySignedInNo) {
          await staySignedInNo.click();
          await this.waitForNetworkIdle(this.page!, 600, 10000);
        }
      } catch (error) {
        // Continue waiting
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return {
      success: false,
      approved: false,
      message: 'Push notification approval timed out'
    };
  }

  /**
   * Ensures we're on the Transact portal and navigates if needed
   */
  async ensureOnTransactPortal(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // If already on Transact, we're good
      if (this.isOnTransact(this.page.url())) {
        return true;
      }

      // Try to navigate to the main portal
      const success = await this.safeGoto(this.page, this.TARGET_URL, 45000);
      if (success && this.isOnTransact(this.page.url())) {
        return true;
      }

      // Try the transaction URL as backup
      const txnSuccess = await this.safeGoto(this.page, this.TXN_URL, 45000);
      return txnSuccess && this.isOnTransact(this.page.url());

    } catch (error) {
      console.error('Error navigating to Transact portal:', error);
      return false;
    }
  }

  /**
   * Takes a screenshot for debugging purposes
   */
  async takeScreenshot(filename: string = 'debug.png'): Promise<void> {
    if (!this.page) return;
    
    try {
      await this.page.screenshot({ 
        path: filename, 
        fullPage: true 
      });
      console.log(`Screenshot saved: ${filename}`);
    } catch (error) {
      console.error('Screenshot error:', error);
    }
  }

  /**
   * Gets current page information for debugging
   */
  async getPageInfo(): Promise<{
    url: string;
    title: string;
    content: string;
  }> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      const url = this.page.url();
      const title = await this.page.title();
      const content = await this.page.evaluate(() => 
        document.body.textContent?.substring(0, 1000) || ''
      );

      return { url, title, content };
    } catch (error) {
      console.error('Error getting page info:', error);
      return {
        url: 'unknown',
        title: 'unknown',
        content: 'Error retrieving page content'
      };
    }
  }

  /**
   * Closes the browser and cleans up resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        
        // Remove from active sessions
        if (this.sessionId) {
          PennStateAuthService.removeSession(this.sessionId);
        }
        
        console.log('Browser closed successfully');
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

export default PennStateAuthService;