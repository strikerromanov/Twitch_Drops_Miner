import { Account, PointClaimHistory } from '../core/types';
import { Queries, getDb } from '../core/database';
import { logInfo, logError, logDebug } from '../core/logger';
import { POINT_CLAIM_INTERVAL } from '../core/config';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

/**
 * Service for automatically claiming channel points on Twitch
 * Uses Playwright to automate the claiming process
 */
export class PointClaimerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private maxRetries: number = 3;
  private claimTimeout: number = 30000; // 30 seconds

  /**
   * Start the point claimer service
   * Begins periodic point claiming for all active accounts
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logWarn('PointClaimerService already running');
      return;
    }

    this.isRunning = true;
    logInfo('Starting PointClaimerService');

    // Initialize browser
    try {
      await this.initializeBrowser();
    } catch (error) {
      logError('Failed to initialize browser', {}, error as Error);
      this.isRunning = false;
      return;
    }

    // Set up recurring interval
    this.intervalId = setInterval(async () => {
      await this.extractPoints();
    }, POINT_CLAIM_INTERVAL);

    // Initial run
    await this.extractPoints();
  }

  /**
   * Stop the point claimer service
   * Closes browser and performs cleanup
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logInfo('Stopping PointClaimerService');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await this.closeBrowser();
    this.isRunning = false;
  }

  /**
   * Claim points for a specific account
   * @param accountId - ID of account to claim points for
   */
  async claimPoints(accountId: number): Promise<void> {
    const account = Queries.getAccountById(accountId).get() as Account | undefined;
    
    if (!account) {
      logError('Account not found', { accountId });
      return;
    }

    if (!account.access_token || !account.user_id) {
      logError('Account missing access token or user ID', { accountId });
      return;
    }

    logInfo('Claiming points for account', { 
      accountId, 
      username: account.username 
    });

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const claimed = await this.attemptClaim(account);
        
        if (claimed > 0) {
          this.recordClaim(account.id, claimed);
          logInfo('Successfully claimed points', { 
            accountId, 
            points: claimed 
          });
        }
        
        break; // Success or no points to claim
      } catch (error) {
        logError('Point claim attempt failed', { 
          accountId, 
          attempt, 
          maxRetries: this.maxRetries 
        }, error as Error);
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await this.sleep(2000);
      }
    }
  }

  /**
   * Extract points from all active accounts
   * Iterates through accounts and claims available points
   */
  async extractPoints(): Promise<void> {
    try {
      const accounts = Queries.getAccounts().all() as Account[];
      const activeAccounts = accounts.filter(acc => 
        acc.status === 'active' && acc.access_token && acc.user_id
      );

      logDebug('Extracting points for active accounts', { 
        count: activeAccounts.length 
      });

      for (const account of activeAccounts) {
        try {
          await this.claimPoints(account.id);
        } catch (error) {
          logError('Failed to claim points for account', 
            { accountId: account.id, username: account.username }, 
            error as Error
          );
        }
      }
    } catch (error) {
      logError('Failed to extract points', {}, error as Error);
    }
  }

  /**
   * Initialize Playwright browser
   */
  private async initializeBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
  }

  /**
   * Close browser and cleanup
   */
  private async closeBrowser(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Attempt to claim points for an account
   * @param account - Account to claim points for
   * @returns Number of points claimed
   */
  private async attemptClaim(account: Account): Promise<number> {
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    const page = await this.context.newPage();
    let claimedPoints = 0;

    try {
      // Set auth token in localStorage
      await page.goto('https://www.twitch.tv');
      await page.evaluate((token) => {
        localStorage.setItem('auth-token', token);
      }, account.access_token);

      // Navigate to a channel to trigger point loading
      await page.goto('https://www.twitch.tv/directory');
      await this.sleep(3000);

      // Look for claim button
      const claimButton = await page.$('[data-a-target="tw-button"]');
      
      if (claimButton) {
        await claimButton.click();
        await this.sleep(2000);
        claimedPoints = 50; // Default claim amount
      }

    } finally {
      await page.close();
    }

    return claimedPoints;
  }

  /**
   * Record point claim in database
   * @param accountId - Account ID
   * @param points - Points claimed
   * @param bonusType - Type of bonus claim
   */
  private recordClaim(accountId: number, points: number, bonusType: string | null = null): void {
    const insertClaim = getDb().prepare(`
      INSERT INTO point_claim_history (account_id, streamer, points_claimed, claimed_at, bonus_type)
      VALUES (?, '', ?, ?, ?)
    `);
    
    insertClaim.run(accountId, points, new Date().toISOString(), bonusType);
  }

  /**
   * Get claim history for an account
   * @param accountId - Account ID
   * @param limit - Max records to return
   * @returns Array of claim history records
   */
  getClaimHistory(accountId: number, limit: number = 50): PointClaimHistory[] {
    const history = getDb().prepare(`
      SELECT * FROM point_claim_history 
      WHERE account_id = ? 
      ORDER BY claimed_at DESC 
      LIMIT ?
    `).all(accountId, limit) as PointClaimHistory[];
    
    return history;
  }

  /**
   * Check if service is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Sleep helper function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Log warning helper
 */
function logWarn(message: string, context?: Record<string, unknown>): void {
  logError(message, context);
}
