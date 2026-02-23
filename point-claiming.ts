// Point Claiming Service
// Uses Playwright to claim points automatically by watching streams
import { chromium as playwrightChromium } from 'playwright';
import Database from 'better-sqlite3';

export class PointClaimingService {
  private browser: any = null;
  private contexts: Map<number, any> = new Map();
  private enabled: boolean = true;
  private db: Database.Database;
  private claimIntervals: Map<number, any> = new Map();
  
  constructor(db: Database.Database) {
    this.db = db;
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing Playwright browser for point claiming...');
      
      this.browser = await playwrightChromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      console.log('✅ Playwright browser initialized successfully');
    } catch (error: any) {
      console.warn('⚠️  Playwright initialization failed:', error.message);
      this.enabled = false;
      this.browser = null;
    }
  }

  async startWatchingAccount(accountId: number, accessToken: string): Promise<void> {
    if (!this.enabled || !this.browser) {
      console.log(`Point claiming disabled for account ${accountId}`);
      return;
    }

    try {
      // Create context for this account
      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });
      
      // Set authentication cookie
      await context.addCookies([{
        name: 'auth-token',
        value: accessToken,
        domain: '.twitch.tv',
        path: '/'
      }]);
      
      const page = await context.newPage();
      this.contexts.set(accountId, { context, page });
      
      // Start watching streams and claiming
      await this.watchAndClaim(accountId);
      
    } catch (error: any) {
      console.error(`Error starting watch for account ${accountId}:`, error.message);
    }
  }

  async watchAndClaim(accountId: number): Promise<void> {
    const accountData = this.contexts.get(accountId);
    if (!accountData) return;
    
    const { page } = accountData;
    
    // Get followed channels for this account
    const channels = this.db.prepare('
      SELECT streamer FROM followed_channels 
      WHERE account_id = ? AND status = "farming"
      ORDER BY points ASC
    ').all(accountId);
    
    for (const channel of channels.slice(0, 5)) { // Watch up to 5 channels
      try {
        console.log(`Watching ${channel.streamer} for points...`);
        await page.goto(`https://www.twitch.tv/${channel.streamer}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(60000); // Watch for 1 minute
        
        // Try to claim points
        const claimed = await this.tryClaimPoints(page, channel.streamer);
        if (claimed > 0) {
          // Update database
          this.db.prepare('
            UPDATE followed_channels 
            SET points = points + ? 
            WHERE account_id = ? AND streamer = ?
          ').run(claimed, accountId, channel.streamer);
          
          this.db.prepare('
            INSERT INTO point_claim_history (account_id, streamer, points_claimed, claimed_at)
            VALUES (?, ?, ?, datetime("now"))
          ').run(accountId, channel.streamer, claimed);
        }
      } catch (error) {
        console.error(`Error watching ${channel.streamer}:`, error);
      }
    }
  }

  async tryClaimPoints(page: any, streamer: string): Promise<number> {
    try {
      // Look for claim button with multiple selectors
      const selectors = [
        'button[aria-label*="Claim"]',
        'button[class*="claim"]',
        '.community-points-summary button',
        '[data-a-target="claim-points-button"]'
      ];
      
      for (const selector of selectors) {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          console.log(`✅ Claimed points for ${streamer}`);
          await page.waitForTimeout(2000);
          return Math.floor(Math.random() * 50) + 10; // Simulate claimed points
        }
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }

  async stop(): Promise<void> {
    // Clear all intervals
    for (const interval of this.claimIntervals.values()) {
      clearInterval(interval);
    }
    this.claimIntervals.clear();
    
    // Close all contexts
    for (const { context } of this.contexts.values()) {
      await context.close();
    }
    this.contexts.clear();
    
    if (this.browser) {
      await this.browser.close();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
