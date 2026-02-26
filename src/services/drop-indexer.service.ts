import { TwitchDropCampaign, DropCampaign, CampaignStatus } from '../core/types';
import { Queries, getDb } from '../core/database';
import { logInfo, logError, logDebug } from '../core/logger';
import { DROP_CHECK_INTERVAL, TWITCH_API_URL } from '../core/config';

/**
 * Service for monitoring and indexing Twitch drop campaigns
 * Fetches active drops from Twitch API and stores them in database
 */
export class DropIndexerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private clientId: string;
  private accessToken: string;

  /**
   * Create drop indexer service
   * @param clientId - Twitch OAuth client ID
   * @param accessToken - Twitch OAuth access token
   */
  constructor(clientId: string, accessToken: string) {
    this.clientId = clientId;
    this.accessToken = accessToken;
  }

  /**
   * Start the drop indexer service
   * Begins periodic checking for new drop campaigns
   */
  start(): void {
    if (this.isRunning) {
      logWarn('DropIndexerService already running');
      return;
    }

    this.isRunning = true;
    logInfo('Starting DropIndexerService');

    // Initial sync
    this.syncCampaigns().catch(err => {
      logError('Initial campaign sync failed', {}, err);
    });

    // Set up recurring interval
    this.intervalId = setInterval(() => {
      this.syncCampaigns().catch(err => {
        logError('Campaign sync failed', {}, err);
      });
    }, DROP_CHECK_INTERVAL);
  }

  /**
   * Stop the drop indexer service
   * Stops periodic checking and performs cleanup
   */
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
  }

  /**
   * Fetch and index drop campaigns from Twitch API
   * Stores campaigns in drop_campaigns table
   */
  async indexDrops(): Promise<void> {
    try {
      const campaigns = await this.fetchDropCampaigns();
      
      for (const campaign of campaigns) {
        await this.storeCampaign(campaign);
      }
      
      logInfo(`Indexed ${campaigns.length} drop campaigns`);
    } catch (error) {
      logError('Failed to index drops', {}, error as Error);
      throw error;
    }
  }

  /**
   * Synchronize campaigns with Twitch API
   * Fetches active campaigns and updates local database
   */
  async syncCampaigns(): Promise<void> {
    try {
      logDebug('Syncing drop campaigns from Twitch API');
      
      const campaigns = await this.fetchDropCampaigns();
      const upsertCampaign = Queries.upsertCampaign();
      
      for (const campaign of campaigns) {
        const now = new Date().toISOString();
        
        upsertCampaign.run(
          campaign.id,
          campaign.name,
          campaign.game.name,
          campaign.required_minutes_watch,
          0, // current_minutes - tracked separately per account
          'active' as CampaignStatus,
          campaign.image_url,
          now
        );
      }
      
      logInfo(`Synced ${campaigns.length} campaigns from Twitch`, { 
        campaignCount: campaigns.length 
      });
    } catch (error) {
      logError('Failed to sync campaigns', {}, error as Error);
      throw error;
    }
  }

  /**
   * Fetch drop campaigns from Twitch API
   * @returns Array of Twitch drop campaigns
   */
  private async fetchDropCampaigns(): Promise<TwitchDropCampaign[]> {
    const response = await fetch(`${TWITCH_API_URL}/drops/entitlements/campaigns?active_only=true`, {
      headers: {
        'Client-Id': this.clientId,
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twitch API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Store campaign in database
   * @param campaign - Campaign to store
   */
  private async storeCampaign(campaign: TwitchDropCampaign): Promise<void> {
    const upsertCampaign = Queries.upsertCampaign();
    const now = new Date().toISOString();
    
    upsertCampaign.run(
      campaign.id,
      campaign.name,
      campaign.game.name,
      campaign.required_minutes_watch,
      0, // current_minutes
      'active' as CampaignStatus,
      campaign.image_url,
      now
    );
  }

  /**
   * Get all active campaigns from database
   * @returns Array of active drop campaigns
   */
  getActiveCampaigns(): DropCampaign[] {
    const campaigns = Queries.getActiveCampaigns().all() as DropCampaign[];
    return campaigns;
  }

  /**
   * Check if service is currently running
   * @returns true if service is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

/**
 * Log warning helper (logger function from core)
 */
function logWarn(message: string, context?: Record<string, unknown>): void {
  logError(message, context); // Using logError as fallback since logWarn not in exports
}
