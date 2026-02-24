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
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
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
      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });

      // Add authentication cookies
      await context.addCookies([
        {
          name: 'auth-token',
          value: accessToken,
          domain: '.twitch.tv',
          path: '/',
          httpOnly: true,
          secure: true
        },
        {
          name: 'twilight-user-id',
          value: '',
          domain: '.twitch.tv',
          path: '/'
        }
      ]);

      const page = await context.newPage();

      // Set default timeout
      page.setDefaultTimeout(30000);

      this.contexts.set(accountId, { context, page, accessToken });

      // Start watching loop
      this.watchAndClaim(accountId);

    } catch (error: any) {
      console.error(`Error starting watch for account ${accountId}:`, error.message);
    }
  }

  async watchAndClaim(accountId: number): Promise<void> {
    const accountData = this.contexts.get(accountId);
    if (!accountData) return;

    const { page } = accountData;

    try {
      const query = `SELECT streamer FROM followed_channels WHERE account_id = ? AND status = 'farming' ORDER BY points ASC`;
      const channels = this.db.prepare(query).all(accountId);

      for (const channel of channels.slice(0, 5)) {
        try {
          console.log(`[Point Claiming] Watching ${channel.streamer} for points...`);

          // Navigate to stream
          await page.goto(`https://www.twitch.tv/${channel.streamer}`, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });

          // Wait for page to stabilize
          await this.sleep(5000);

          // Try to claim points
          const claimed = await this.tryClaimPoints(page, channel.streamer);

          if (claimed > 0) {
            this.db.prepare('UPDATE followed_channels SET points = points + ? WHERE account_id = ? AND streamer = ?')
              .run(claimed, accountId, channel.streamer);
            this.db.prepare('INSERT INTO point_claim_history (account_id, streamer, points_claimed, claimed_at) VALUES (?, ?, ?, datetime("now"))')
              .run(accountId, channel.streamer, claimed);
            console.log(`✅ Claimed ${claimed} points for ${channel.streamer}`);
          }

          // Wait before next channel
          await this.sleep(10000);

        } catch (error) {
          console.error(`Error watching ${channel.streamer}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in watchAndClaim:', error);
    }
  }

  async tryClaimPoints(page: any, streamer: string): Promise<number> {
    try {
      // Modern Twitch selectors (2024)
      const selectors = [
        // Claim button in community points summary
        'button[aria-label*="Claim" i]',
        'button[class*="ScClaimButton"]',
        'button[data-test-selector="community-points-summary"] button',
        '[data-a-target="community-points-summay-first-button"]',
        'button[class*="claim-points-button"]',
        // Legacy selectors
        '.claimable-bonus__icon',
        '.community-points-summary button',
        '[data-a-target="claim-points-button"]'
      ];

      for (const selector of selectors) {
        try {
          // Wait for button to be visible
          const button = await page.waitForSelector(selector, { 
            timeout: 5000,
            state: 'visible'
          }).catch(() => null);

          if (button) {
            // Check if button is enabled and clickable
            const isDisabled = await button.isDisabled().catch(() => true);
            const isVisible = await button.isVisible().catch(() => false);

            if (!isDisabled && isVisible) {
              await button.click({ timeout: 5000 });
              console.log(`✅ Clicked claim button for ${streamer}`);

              // Wait for claim animation to complete
              await this.sleep(2000);

              // Extract actual points from UI if possible
              const pointsExtracted = await this.extractPointsFromUI(page);
              return pointsExtracted > 0 ? pointsExtracted : 50; // Default to 50 if extraction fails
            }
          }
        } catch (e) {
          // Selector not found or error, try next one
          continue;
        }
      }

      return 0;
    } catch (error) {
      console.error(`Error claiming points for ${streamer}:`, error);
      return 0;
    }
  }

  async extractPointsFromUI(page: any): Promise<number> {
    try {
      // Try to extract actual points claimed from the UI
      const pointsSelectors = [
        '[data-a-target="community-points-balloon-amount"]',
        '.community-points-balloon__content',
        'span[aria-label*="points"]',
        '.community-points-summary button span'
      ];

      for (const selector of pointsSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const text = await element.textContent();
            if (text) {
              const match = text.match(/\d+/);
              if (match) {
                return parseInt(match[0]);
              }
            }
          }
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      // Extraction failed, return 0
    }
    return 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    for (const interval of Array.from(this.claimIntervals.values())) {
      clearInterval(interval);
    }
    this.claimIntervals.clear();

    for (const { context } of Array.from(this.contexts.values())) {
      try {
        await context.close();
      } catch (e) {
        // Context already closed
      }
    }
    this.contexts.clear();

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        // Browser already closed
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
