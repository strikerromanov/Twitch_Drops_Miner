
import fetch from 'node-fetch';
import { Database } from 'better-sqlite3';

interface DropCampaign {
  id: string;
  name: string;
  game: {
    id: string;
    name: string;
    boxArtUrl: string;
  };
  status: string;
  startsAt: string;
  endsAt: string;
  allowedChannels: string[];
  drops: Array<{
    id: string;
    name: string;
    requiredMinutesWatched: number;
    currentMinutesWatched: number;
  }>;
}

class DropIndexer {
  private db: Database;
  private clientId: string;
  private indexingInterval: NodeJS.Timeout | null = null;

  constructor(db: Database, clientId: string) {
    this.db = db;
    this.clientId = clientId;
  }

  async indexDrops() {
    try {
      console.log('[DROP INDEXER] Starting drop indexing...');

      // Fetch drop campaigns from Twitch API
      const response = await fetch('https://api.twitch.tv/helix/drops/entitlements/drops?first=100', {
        headers: {
          'Client-Id': this.clientId,
          'Authorization': `Bearer ${this.getAccessToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch drops: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const campaigns: DropCampaign[] = data.data || [];

      console.log(`[DROP INDEXER] Found ${campaigns.length} campaigns`);

      // Save to database
      campaigns.forEach(campaign => {
        try {
          this.db.prepare(`
            INSERT OR REPLACE INTO drops_campaigns (id, name, game_id, game_name, game_art, status, starts_at, ends_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            campaign.id,
            campaign.name,
            campaign.game?.id || '',
            campaign.game?.name || '',
            campaign.game?.boxArtUrl || '',
            campaign.status,
            campaign.startsAt,
            campaign.endsAt
          );
        } catch (err) {
          console.error('[DROP INDEXER] Failed to save campaign:', err);
        }
      });

      // Log activity
      this.logActivity('info', `Indexed ${campaigns.length} drop campaigns`);

      console.log('[DROP INDEXER] Indexing completed');
      return campaigns;
    } catch (error: any) {
      console.error('[DROP INDEXER] Error:', error);
      this.logActivity('error', `Drop indexing failed: ${error.message}`);
      return [];
    }
  }

  private getAccessToken(): string {
    // Get a valid access token from farming accounts
    const account = this.db.prepare('SELECT access_token FROM accounts WHERE status = ? LIMIT 1').get('farming') as any;
    return account?.access_token || '';
  }

  private logActivity(type: string, message: string) {
    try {
      this.db.prepare('INSERT INTO logs (type, message, time) VALUES (?, ?, datetime("now"))').run(type, message);
    } catch (err) {
      // Ignore log errors
    }
  }

  start() {
    console.log('[DROP INDEXER] Starting periodic drop indexing (every 10 minutes)');

    // Initial index
    this.indexDrops();

    // Periodic indexing
    this.indexingInterval = setInterval(() => {
      this.indexDrops();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  stop() {
    if (this.indexingInterval) {
      clearInterval(this.indexingInterval);
      this.indexingInterval = null;
    }
  }
}

export default DropIndexer;
