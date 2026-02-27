import { TwitchDropCampaign, DropCampaign, CampaignStatus } from '../core/types';
import { Queries, getDb } from '../core/database';
import { logInfo, logError, logDebug } from '../core/logger';
import { DROP_CHECK_INTERVAL, TWITCH_API_URL } from '../core/config';

/**
 * Drop campaign cache entry
 */
interface CacheEntry {
  campaign: TwitchDropCampaign;
  timestamp: number;
}

/**
 * Service for monitoring and indexing Twitch drop campaigns
 * Enhanced with retry logic, caching, and adaptive polling
 */
export class DropIndexerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private clientId: string;
  private accessToken: string;
  
  // Caching
  private campaignCache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute cache TTL
  
  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 1000;
  private currentRetryCount = 0;
  
  // Adaptive polling
  private currentPollingInterval = DROP_CHECK_INTERVAL;
  private consecutiveErrors = 0;
  private lastActivityTime = Date.now();
  private readonly MIN_INTERVAL = 30000; // 30 seconds
  private readonly MAX_INTERVAL = 600000; // 10 minutes

  constructor(clientId: string, accessToken: string) {
    this.clientId = clientId;
    this.accessToken = accessToken;
  }

  start(): void {
    if (this.isRunning) {
      logWarn('DropIndexerService already running');
      return;
    }

    this.isRunning = true;
    logInfo('Starting enhanced DropIndexerService with retry logic and caching');

    this.syncCampaigns().catch(err => {
      logError('Initial campaign sync failed', {}, err);
    });

    this.resetPollingInterval();
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logInfo('Stopping DropIndexerService');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    this.campaignCache.clear();
  }

  async indexDrops(): Promise<void> {
    try {
      const campaigns = await this.fetchDropCampaignsWithRetry();
      
      const storedCampaigns = await this.storeCampaignsBatch(campaigns);
      
      this.updateDropProgress(storedCampaigns);
      
      logInfo(`Indexed ${storedCampaigns.length} drop campaigns with progress tracking`, {
        count: storedCampaigns.length,
        cached: this.campaignCache.size
      });
      
      this.consecutiveErrors = 0;
    } catch (error) {
      this.consecutiveErrors++;
      logError('Failed to index drops', { 
        attempt: this.consecutiveErrors,
        maxRetries: this.MAX_RETRIES
      }, error as Error);
      throw error;
    }
  }

  async syncCampaigns(): Promise<void> {
    try {
      logDebug('Syncing drop campaigns with adaptive polling', {
        interval: this.currentPollingInterval,
        cacheSize: this.campaignCache.size
      });
      
      const campaigns = await this.fetchDropCampaignsWithRetry();
      await this.storeCampaignsBatch(campaigns);
      
      this.adjustPollingInterval(campaigns.length);
      
      logInfo(`Synced ${campaigns.length} campaigns from Twitch`, {
        campaignCount: campaigns.length,
        fromCache: campaigns.filter(c => this.isCached(c.id)).length
      });
    } catch (error) {
      this.adjustPollingInterval(0);
      logError('Failed to sync campaigns', {}, error as Error);
      throw error;
    }
  }

  /**
   * Fetch campaigns with intelligent retry logic
   */
  private async fetchDropCampaignsWithRetry(): Promise<TwitchDropCampaign[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const campaigns = await this.fetchDropCampaigns();
        this.currentRetryCount = 0;
        return campaigns;
      } catch (error) {
        lastError = error as Error;
        logError('Campaign fetch attempt failed', {
          attempt,
          maxRetries: this.MAX_RETRIES
        }, error as Error);
        
        if (attempt < this.MAX_RETRIES) {
          const delay = this.calculateRetryDelay(attempt);
          logDebug(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(attempt: number): number {
    return this.INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1) + Math.random() * 1000;
  }

  private async fetchDropCampaigns(): Promise<TwitchDropCampaign[]> {
    const response = await fetch(`${TWITCH_API_URL}/drops/entitlements/campaigns?active_only=true`, {
      headers: {
        'Client-Id': this.clientId,
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded, implementing backoff');
      }
      if (response.status === 503) {
        throw new Error('Twitch API temporarily unavailable');
      }
      const errorText = await response.text();
      throw new Error(`Twitch API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Store campaigns in batch with transaction
   */
  private async storeCampaignsBatch(campaigns: TwitchDropCampaign[]): Promise<DropCampaign[]> {
    const db = getDb();
    const upsertCampaign = Queries.upsertCampaign();
    const now = new Date().toISOString();
    
    const transaction = db.transaction((campaigns: TwitchDropCampaign[]) => {
      const storedCampaigns: DropCampaign[] = [];
      
      for (const campaign of campaigns) {
        upsertCampaign.run(
          campaign.id,
          campaign.name,
          campaign.game.name,
          campaign.required_minutes_watch,
          0,
          'active' as CampaignStatus,
          campaign.image_url,
          now
        );
        
        this.cacheCampaign(campaign);
        storedCampaigns.push({
          id: campaign.id,
          name: campaign.name,
          game: campaign.game.name,
          required_minutes: campaign.required_minutes_watch,
          current_minutes: 0,
          status: 'active' as CampaignStatus,
          image_url: campaign.image_url,
          last_updated: now
        });
      }
      
      return storedCampaigns;
    });
    
    return transaction(campaigns);
  }

  /**
   * Update drop progress for all accounts
   */
  private updateDropProgress(campaigns: DropCampaign[]): void {
    const db = getDb();
    const accounts = Queries.getAccounts().all() as any[];
    const upsertProgress = Queries.upsertDropProgress();
    const now = new Date().toISOString();
    
    const transaction = db.transaction(() => {
      for (const account of accounts) {
        if (account.status !== 'active') continue;
        
        for (const campaign of campaigns) {
          const existing = Queries.getDropProgress(account.id, campaign.id).get();
          const currentMinutes = existing ? existing.current_minutes : 0;
          
          upsertProgress.run(
            account.id,
            campaign.id,
            currentMinutes,
            now
          );
        }
      }
    });
    
    transaction();
  }

  /**
   * Cache management
   */
  private cacheCampaign(campaign: TwitchDropCampaign): void {
    this.campaignCache.set(campaign.id, {
      campaign,
      timestamp: Date.now()
    });
    this.cleanExpiredCache();
  }

  private getCachedCampaign(id: string): TwitchDropCampaign | null {
    const entry = this.campaignCache.get(id);
    if (entry && Date.now() - entry.timestamp < this.CACHE_TTL) {
      return entry.campaign;
    }
    return null;
  }

  private isCached(id: string): boolean {
    return this.getCachedCampaign(id) !== null;
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [id, entry] of this.campaignCache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.campaignCache.delete(id);
      }
    }
  }

  /**
   * Adaptive polling based on activity
   */
  private adjustPollingInterval(activityCount: number): void {
    const now = Date.now();
    const timeSinceActivity = now - this.lastActivityTime;
    
    if (activityCount > 0) {
      this.lastActivityTime = now;
      this.currentPollingInterval = Math.max(
        this.MIN_INTERVAL,
        this.currentPollingInterval * 0.9
      );
    } else if (timeSinceActivity > 300000) { // 5 minutes inactive
      this.currentPollingInterval = Math.min(
        this.MAX_INTERVAL,
        this.currentPollingInterval * 1.1
      );
    }
    
    if (this.consecutiveErrors > 0) {
      this.currentPollingInterval = Math.min(
        this.MAX_INTERVAL,
        this.currentPollingInterval * (1 + this.consecutiveErrors * 0.5)
      );
    }
    
    this.resetPollingInterval();
  }

  private resetPollingInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    this.intervalId = setInterval(() => {
      this.syncCampaigns().catch(err => {
        logError('Campaign sync failed', {}, err);
      });
    }, this.currentPollingInterval);
  }

  getActiveCampaigns(): DropCampaign[] {
    const campaigns = Queries.getActiveCampaigns().all() as DropCampaign[];
    return campaigns;
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
