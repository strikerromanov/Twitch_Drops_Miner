import { Account } from '../core/types';
import { Queries, getDb } from '../core/database';
import { logInfo, logError, logDebug } from '../core/logger';
import { CHAT_FARMING_INTERVAL } from '../core/config';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

/**
 * Random chat messages for farming activity
 */
const CHAT_MESSAGES = [
  'GG', 'Nice stream!', 'PogChamp', 'Cool', 'Awesome!',
  'Let\'s go!', 'LOL', 'Nice one', 'Keep it up', 'Great content',
  'Love this', 'Quality stream', 'Sub hype!', 'Hype!', 'Nice play',
  'Respect', 'Epic moment', 'Kappa', 'MonkaS', 'LUL'
];

/**
 * Service for simulating chat activity on Twitch
 * Sends automated messages to maintain account activity
 */
export class ChatFarmerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private browser: Browser | null = null;
  private contexts: Map<number, BrowserContext> = new Map();
  private minInterval: number = 30000; // 30 seconds min between messages
  private maxInterval: number = 120000; // 2 minutes max between messages

  /**
   * Start the chat farmer service
   * Begins periodic chat message sending for all active accounts
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logWarn('ChatFarmerService already running');
      return;
    }

    this.isRunning = true;
    logInfo('Starting ChatFarmerService');

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
      await this.farmAllAccounts();
    }, CHAT_FARMING_INTERVAL);

    // Initial run
    await this.farmAllAccounts();
  }

  /**
   * Stop the chat farmer service
   * Closes browser and performs cleanup
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logInfo('Stopping ChatFarmerService');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await this.closeBrowser();
    this.isRunning = false;
  }

  /**
   * Farm chat for a specific account
   * @param accountId - ID of account to farm chat for
   */
  async farmAccount(accountId: number): Promise<void> {
    const account = Queries.getAccountById(accountId).get() as Account | undefined;
    
    if (!account) {
      logError('Account not found', { accountId });
      return;
    }

    if (!account.access_token || !account.user_id) {
      logError('Account missing access token or user ID', { accountId });
      return;
    }

    logDebug('Farming chat for account', { 
      accountId, 
      username: account.username 
    });

    try {
      // Get active streams for this account
      const streams = getDb().prepare(`
        SELECT * FROM active_streams WHERE account_id = ?
      `).all(accountId) as any[];

      if (streams.length === 0) {
        logDebug('No active streams for account', { accountId });
        return;
      }

      // Send message to random stream
      const stream = streams[Math.floor(Math.random() * streams.length)];
      await this.sendMessage(account, stream.streamer);

    } catch (error) {
      logError('Failed to farm chat for account', 
        { accountId, username: account.username }, 
        error as Error
      );
    }
  }

  /**
   * Farm chat for all active accounts
   */
  private async farmAllAccounts(): Promise<void> {
    try {
      const accounts = Queries.getAccounts().all() as Account[];
      const activeAccounts = accounts.filter(acc => 
        acc.status === 'active' && acc.access_token && acc.user_id
      );

      logDebug('Farming chat for active accounts', { 
        count: activeAccounts.length 
      });

      for (const account of activeAccounts) {
        try {
          await this.farmAccount(account.id);
          // Random delay between accounts
          await this.sleep(this.randomDelay(1000, 5000));
        } catch (error) {
          logError('Failed to farm account', 
            { accountId: account.id }, 
            error as Error
          );
        }
      }
    } catch (error) {
      logError('Failed to farm all accounts', {}, error as Error);
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
  }

  /**
   * Close browser and cleanup
   */
  private async closeBrowser(): Promise<void> {
    // Close all contexts
    for (const [accountId, context] of this.contexts) {
      await context.close();
    }
    this.contexts.clear();
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Send a chat message to a streamer
   * @param account - Account to send message from
   * @param streamer - Streamer channel to send message to
   */
  private async sendMessage(account: Account, streamer: string): Promise<void> {
    let context = this.contexts.get(account.id);
    
    if (!context) {
      context = await this.browser!.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        storageState: {
      cookies: [],
          origins: [{
            origin: 'https://www.twitch.tv',
            localStorage: [
              {
                name: 'auth-token',
                value: account.access_token!
              }
            ]
          }]
        }
      });
      this.contexts.set(account.id, context);
    }

    const page = await context.newPage();

    try {
      // Navigate to streamer channel
      await page.goto(`https://www.twitch.tv/${streamer}`);
      await this.sleep(2000);

      // Select random message
      const message = CHAT_MESSAGES[Math.floor(Math.random() * CHAT_MESSAGES.length)];

      // Try to send message (using chat input selector)
      const chatInput = await page.$('textarea[aria-label="Chat Input"]');
      
      if (chatInput) {
        await chatInput.fill(message);
        await this.sleep(500);
        
        const sendButton = await page.$('button[aria-label="Send Chat"]');
        if (sendButton) {
          await sendButton.click();
          
          logDebug('Chat message sent', 
            { accountId: account.id, streamer, message }
          );
        }
      }
    } finally {
      await page.close();
    }
  }

  /**
   * Check if service is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Generate random delay between min and max interval
   */
  private randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
