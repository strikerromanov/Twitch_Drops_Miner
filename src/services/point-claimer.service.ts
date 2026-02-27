import { Account, PointClaimHistory, DropCampaign } from '../core/types';
import { Queries, getDb } from '../core/database';
import { logInfo, logError, logDebug } from '../core/logger';
import { POINT_CLAIM_INTERVAL } from '../core/config';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

/**
 * Streamer with drop priority information
 */
interface PrioritizedStreamer {
  username: string;
  priority: number;
  gameId?: string;
  activeCampaigns: number;
}

/**
 * Farming statistics for tracking performance
 */
interface FarmingStats {
  totalClaims: number;
  successfulClaims: number;
  failedClaims: number;
  totalPoints: number;
  averagePointsPerClaim: number;
  lastClaimTime: Date | null;
  accountsFarmed: number;
  streamsWatched: number;
}

/**
 * Service for automatically claiming channel points on Twitch
 * Enhanced with parallel farming and smart streamer selection
 */
export class PointClaimerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private browser: Browser | null = null;
  private contexts: Map<number, BrowserContext> = new Map();
  private maxRetries: number = 3;
  private claimTimeout: number = 15000; // Reduced from 30s to 15s
  private maxConcurrentFarms: number = 5;
  
  // Statistics tracking
  private stats: FarmingStats = {
    totalClaims: 0,
    successfulClaims: 0,
    failedClaims: 0,
    totalPoints: 0,
    averagePointsPerClaim: 0,
    lastClaimTime: null,
    accountsFarmed: 0,
    streamsWatched: 0
  };
  
  // Streamer selection cache
  private prioritizedStreamers: PrioritizedStreamer[] = [];
  private lastStreamerUpdate: number = 0;
  private readonly STREAMER_CACHE_TTL = 300000; // 5 minutes

  async start(): Promise<void> {
    if (this.isRunning) {
      logWarn('PointClaimerService already running');
      return;
    }

    this.isRunning = true;
    logInfo('Starting enhanced PointClaimerService with parallel farming');

    try {
      await this.initializeBrowser();
      await this.updatePrioritizedStreamers();
    } catch (error) {
      logError('Failed to initialize service', {}, error as Error);
      this.isRunning = false;
      return;
    }

    this.intervalId = setInterval(async () => {
      await this.extractPoints();
    }, POINT_CLAIM_INTERVAL);

    await this.extractPoints();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logInfo('Stopping PointClaimerService', { 
      stats: this.getStats() 
    });
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await this.closeBrowser();
    this.isRunning = false;
  }

  async claimPoints(accountId: number): Promise<void> {
    const account = Queries.getAccountById(accountId).get() as Account | undefined;
    
    if (!account) {
      logError('Account not found', { accountId });
      return;
    }

    if (!account.access_token || !account.user_id) {
      logError('Account missing credentials', { accountId });
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
          this.updateStats(claimed, true);
          logInfo('Successfully claimed points', {
            accountId,
            points: claimed
          });
        }
        break;
      } catch (error) {
        this.updateStats(0, false);
        logError('Point claim attempt failed', {
          accountId,
          attempt,
          maxRetries: this.maxRetries
        }, error as Error);
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        await this.sleep(2000);
      }
    }
  }

  async extractPoints(): Promise<void> {
    try {
      const accounts = Queries.getAccounts().all() as Account[];
      const activeAccounts = accounts.filter(acc =>
        acc.status === 'active' && acc.access_token && acc.user_id
      );

      if (activeAccounts.length === 0) {
        logDebug('No active accounts for point farming');
        return;
      }

      // Update prioritized streamers periodically
      if (Date.now() - this.lastStreamerUpdate > this.STREAMER_CACHE_TTL) {
        await this.updatePrioritizedStreamers();
      }

      logDebug('Extracting points with parallel farming', {
        accounts: activeAccounts.length,
        streamers: this.prioritizedStreamers.length
      });

      // Process accounts in parallel batches
      const batchSize = Math.min(this.maxConcurrentFarms, activeAccounts.length);
      for (let i = 0; i < activeAccounts.length; i += batchSize) {
        const batch = activeAccounts.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(account => this.farmAccountPoints(account))
        );
      }
      
      this.stats.accountsFarmed = activeAccounts.length;
    } catch (error) {
      logError('Failed to extract points', {}, error as Error);
    }
  }

  /**
   * Farm points for a single account with smart streamer selection
   */
  private async farmAccountPoints(account: Account): Promise<void> {
    try {
      const context = await this.getOrCreateContext(account);
      const streamer = this.selectOptimalStreamer(account.id);
      
      if (!streamer) {
        logDebug('No suitable streamer found for farming', {
          accountId: account.id
        });
        return;
      }

      const claimed = await this.claimPointsOnStream(context, account, streamer.username);
      
      if (claimed > 0) {
        this.recordClaim(account.id, claimed, streamer.username);
        this.updateStats(claimed, true);
        logInfo('Points claimed successfully', {
          accountId: account.id,
          streamer: streamer.username,
          points: claimed
        });
      }
      
      this.stats.streamsWatched++;
    } catch (error) {
      this.updateStats(0, false);
      logError('Failed to farm points for account',
        { accountId: account.id },
        error as Error
      );
    }
  }

  /**
   * Select optimal streamer based on drop campaigns and account progress
   */
  private selectOptimalStreamer(accountId: number): PrioritizedStreamer | null {
    if (this.prioritizedStreamers.length === 0) {
      return null;
    }

    // Get account's drop progress
    const activeCampaigns = Queries.getActiveCampaigns().all() as DropCampaign[];
    const accountProgress = new Map<string, number>();
    
    for (const campaign of activeCampaigns) {
      const progress = Queries.getDropProgress(accountId, campaign.id).get();
      if (progress) {
        accountProgress.set(campaign.id, progress.current_minutes);
      }
    }

    // Find streamer with highest priority that has active drops for this account
    for (const streamer of this.prioritizedStreamers) {
      const hasActiveDrops = activeCampaigns.some(
        campaign => campaign.game === streamer.gameId && 
        (accountProgress.get(campaign.id) || 0) < campaign.required_minutes
      );
      
      if (hasActiveDrops || streamer.activeCampaigns > 0) {
        return streamer;
      }
    }

    // Fallback to highest priority streamer
    return this.prioritizedStreamers[0];
  }

  /**
   * Update prioritized streamers list based on active drop campaigns
   */
  private async updatePrioritizedStreamers(): Promise<void> {
    const campaigns = Queries.getActiveCampaigns().all() as DropCampaign[];
    const gameCounts = new Map<string, number>();
    
    // Count active campaigns per game
    for (const campaign of campaigns) {
      // Normalize game to string (handle both string and Game object types)
      const gameKey = typeof campaign.game === 'string' ? campaign.game : campaign.game.name;
      const count = gameCounts.get(gameKey) || 0;
      gameCounts.set(gameKey, count + 1);
    }
    
    // Get followed channels and prioritize
    const followed = getDb().prepare(`
      SELECT DISTINCT streamer, game_name, 
             SUM(viewer_count) as total_viewers,
             COUNT(*) as channel_count
      FROM followed_channels 
      WHERE status = 'online'
      GROUP BY streamer, game_name
      ORDER BY total_viewers DESC
      LIMIT 50
    `).all() as any[];
    
    this.prioritizedStreamers = followed.map(f => ({
      username: f.streamer,
      gameId: f.game_name,
      priority: (gameCounts.get(f.game_name) || 0) * 100 + f.total_viewers,
      activeCampaigns: gameCounts.get(f.game_name) || 0
    }));
    
    // Sort by priority (active campaigns + viewer count)
    this.prioritizedStreamers.sort((a, b) => b.priority - a.priority);
    
    this.lastStreamerUpdate = Date.now();
    
    logDebug('Updated prioritized streamers', {
      count: this.prioritizedStreamers.length,
      topGames: Array.from(gameCounts.entries()).slice(0, 5)
    });
  }

  /**
   * Claim points on a specific stream with optimized automation
   */
  private async claimPointsOnStream(
    context: BrowserContext,
    account: Account,
    streamer: string
  ): Promise<number> {
    const page = await context.newPage();
    let claimedPoints = 0;

    try {
      // Set auth token and navigate directly to stream
      await page.goto(`https://www.twitch.tv/${streamer}`);
      
      // Set auth token in localStorage
      await page.evaluate((token) => {
        localStorage.setItem('auth-token', token);
      }, account.access_token);

      // Wait for page load with reduced timeout
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
      
      // Optimized selector for claim button
      const claimSelectors = [
        '[data-a-target="community-points-summary"] button',
        '[data-test-selector="community-points-summary"] button',
        'button[aria-label*="Claim"]',
        '.claimable-bonus__icon'
      ];
      
      // Try each selector with short timeout
      for (const selector of claimSelectors) {
        try {
          const claimButton = await page.$(selector);
          if (claimButton) {
            await Promise.all([
              claimButton.click(),
              page.waitForTimeout(1000)
            ]);
            
            // Check for success indicator
            const success = await page.$('[data-a-target="community-points-success"]');
            claimedPoints = success ? this.predictPoints(account.id) : 0;
            break;
          }
        } catch {
          continue;
        }
      }
      
    } catch (error) {
      logError('Error claiming points on stream', {
        streamer,
        accountId: account.id
      }, error as Error);
    } finally {
      await page.close().catch(() => {});
    }

    return claimedPoints;
  }

  /**
   * Predict points based on account history
   */
  private predictPoints(accountId: number): number {
    const history = getDb().prepare(`
      SELECT points_claimed 
      FROM point_claim_history 
      WHERE account_id = ? 
      ORDER BY claimed_at DESC 
      LIMIT 10
    `).all(accountId) as any[];
    
    if (history.length === 0) return 50;
    
    const avgPoints = history.reduce((sum, h) => sum + h.points_claimed, 0) / history.length;
    return Math.round(avgPoints);
  }

  private async initializeBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
  }

  private async getOrCreateContext(account: Account): Promise<BrowserContext> {
    if (!this.browser) {
      await this.initializeBrowser();
    }
    
    let context = this.contexts.get(account.id);
    
    if (!context) {
      context = await this.browser!.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        viewport: { width: 1280, height: 720 }
      });
      
      // Set auth token once
      await context.addInitScript((token) => {
        localStorage.setItem('auth-token', token);
      }, account.access_token);
      
      this.contexts.set(account.id, context);
    }
    
    return context;
  }

  private async closeBrowser(): Promise<void> {
    // Close all contexts
    for (const [accountId, context] of this.contexts) {
      await context.close().catch(() => {});
    }
    this.contexts.clear();
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async attemptClaim(account: Account): Promise<number> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const context = await this.getOrCreateContext(account);
    const streamer = this.selectOptimalStreamer(account.id);
    
    if (!streamer) {
      return 0;
    }

    return await this.claimPointsOnStream(context, account, streamer.username);
  }

  private recordClaim(accountId: number, points: number, streamer: string = ''): void {
    const insertClaim = getDb().prepare(`
      INSERT INTO point_claim_history (account_id, streamer, points_claimed, claimed_at, bonus_type)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    insertClaim.run(accountId, streamer, points, new Date().toISOString(), null);
  }

  private updateStats(points: number, success: boolean): void {
    this.stats.totalClaims++;
    
    if (success) {
      this.stats.successfulClaims++;
      this.stats.totalPoints += points;
      this.stats.lastClaimTime = new Date();
      this.stats.averagePointsPerClaim = 
        this.stats.totalPoints / this.stats.successfulClaims;
    } else {
      this.stats.failedClaims++;
    }
  }

  getStats(): FarmingStats {
    return { ...this.stats };
  }

  getClaimHistory(accountId: number, limit: number = 50): PointClaimHistory[] {
    const history = getDb().prepare(`
      SELECT * FROM point_claim_history
      WHERE account_id = ?
      ORDER BY claimed_at DESC
      LIMIT ?
    `).all(accountId, limit) as PointClaimHistory[];
    
    return history;
  }

  isActive(): boolean {
    return this.isRunning;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

function logWarn(message: string, context?: Record<string, unknown>): void {
  logError(message, context);
}
