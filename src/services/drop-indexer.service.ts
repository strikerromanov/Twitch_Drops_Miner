import { getDb, Queries } from '../core/database';
import { logDebug, logInfo, logError } from '../core/logger';

interface DropCampaign {
  id: string;
  name: string;
  game: string | null;
  required_minutes: number;
  current_minutes: number;
  status: string;
  image_url?: string;
  last_updated: number;
}

class DropIndexerService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.clientId = process.env.TWITCH_CLIENT_ID || '';
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET || '';
    this.redirectUri = process.env.TWITCH_REDIRECT_URI || '';
  }

  start() {
    logInfo('Starting Drop Indexer Service...');
    this.syncCampaigns();
    this.intervalId = setInterval(() => this.syncCampaigns(), 30000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async syncCampaigns() {
    try {
      const accounts = Queries.getFarmingAccounts();
      if (!accounts || accounts.length === 0) {
        logDebug('No farming accounts, skipping sync');
        return;
      }

      const account = accounts[0];
      const drops = await this.fetchDrops(account.access_token);
      
      if (drops?.data) {
        for (const drop of drops.data) {
          await this.processDrop(drop);
        }
      }
      logInfo('Campaign sync completed');
    } catch (error: any) {
      logError(`Error syncing campaigns: ${error.message}`);
    }
  }

  private async fetchDrops(accessToken: string) {
    try {
      const response = await fetch('https://api.twitch.tv/helix/drops/entitlements/drops', {
        headers: {
          'Client-Id': this.clientId,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      return response.ok ? await response.json() : null;
    } catch (error: any) {
      logError(`Error fetching drops: ${error.message}`);
      return null;
    }
  }

  private async processDrop(drop: any) {
    try {
      Queries.upsertCampaign({
        campaign_id: drop.id,
        name: drop.name,
        game: drop.game?.name || null,
        status: drop.status || 'active',
        start_time: drop.start_at || null,
        end_time: drop.end_at || null,
        required_minutes: drop.required_minutes_watch || 0,
        current_minutes: 0,
        last_claimed_at: null
      });
    } catch (error: any) {
      logError(`Error processing drop ${drop.id}: ${error.message}`);
    }
  }
}

export default new DropIndexerService();
