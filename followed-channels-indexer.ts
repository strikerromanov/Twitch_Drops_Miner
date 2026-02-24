
import fetch from 'node-fetch';
import { Database } from 'better-sqlite3';

interface FollowedChannel {
  broadcaster_id: string;
  broadcaster_name: string;
  game_name: string;
  is_live: boolean;
}

class FollowedChannelsIndexer {
  private db: Database;
  private clientId: string;
  private indexingInterval: NodeJS.Timeout | null = null;

  constructor(db: Database, clientId: string) {
    this.db = db;
    this.clientId = clientId;
  }

  async indexAccount(accountId: number) {
    try {
      const account = this.db.prepare('SELECT id, username, access_token, user_id FROM accounts WHERE id = ?').get(accountId) as any;

      if (!account || !account.user_id) {
        console.log(`[FOLLOWED INDEXER] Account ${accountId} not found or no user_id`);
        return;
      }

      console.log(`[FOLLOWED INDEXER] Indexing followed channels for: ${account.username}`);

      // Fetch followed channels from Twitch API
      let follows: FollowedChannel[] = []
      let pagination = '';

      do {
        const response = await fetch(`https://api.twitch.tv/helix/channels/followed?user_id=${account.user_id}&first=100&${pagination}`, {
          headers: {
            'Client-Id': this.clientId,
            'Authorization': `Bearer ${account.access_token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch follows: ${response.statusText}`);
        }

        const data = await response.json() as any;
        follows = follows.concat(data.data || []);
        pagination = data.pagination?.cursor ? `after=${data.pagination.cursor}` : '';

      } while (pagination);

      console.log(`[FOLLOWED INDEXER] Found ${follows.length} followed channels`);

      // Save to database
      let added = 0;
      for (const channel of follows) {
        try {
          // Check if channel already exists
          const existing = this.db.prepare('SELECT id FROM followed_channels WHERE account_id = ? AND streamer = ?').get(accountId, channel.broadcaster_name);

          if (!existing) {
            this.db.prepare(`
              INSERT INTO followed_channels (account_id, streamer, streamer_id, game_name, status, points, viewer_count)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              accountId,
              channel.broadcaster_name,
              channel.broadcaster_id,
              channel.game_name || 'Unknown',
              channel.is_live ? 'favorite' : null,
              0,
              0
            );
            added++;
          }
        } catch (err) {
          console.error('[FOLLOWED INDEXER] Failed to save channel:', err);
        }
      }

      this.logActivity(accountId, 'info', `Indexed ${follows.length} channels, added ${added} new`);
      console.log(`[FOLLOWED INDEXER] Completed for ${account.username}: ${added} new channels`);

      return { total: follows.length, added };
    } catch (error: any) {
      console.error(`[FOLLOWED INDEXER] Error indexing account ${accountId}:`, error);
      this.logActivity(accountId, 'error', `Indexing failed: ${error.message}`);
      return { total: 0, added: 0 };
    }
  }

  async getLiveStreams(channelName: string) {
    try {
      const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${channelName}`, {
        headers: {
          'Client-Id': this.clientId,
          'Authorization': `Bearer ${this.getAccessToken()}`
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as any;
      return data.data?.[0] || null;
    } catch (error) {
      console.error('[FOLLOWED INDEXER] Error fetching stream:', error);
      return null;
    }
  }

  private getAccessToken(): string {
    const account = this.db.prepare('SELECT access_token FROM accounts WHERE status = ? LIMIT 1').get('farming') as any;
    return account?.access_token || '';
  }

  private logActivity(accountId: number, type: string, message: string) {
    try {
      this.db.prepare('INSERT INTO logs (streamer_id, type, message, time) VALUES (?, ?, ?, datetime("now"))').run(accountId, type, message);
    } catch (err) {
      // Ignore log errors
    }
  }

  start() {
    console.log('[FOLLOWED INDEXER] Starting periodic indexing (every 30 minutes)');

    this.indexingInterval = setInterval(async () => {
      const farmingAccounts = this.db.prepare('SELECT id FROM accounts WHERE status = ?').all('farming') as any[];

      for (const account of farmingAccounts) {
        await this.indexAccount(account.id);
      }
    }, 30 * 60 * 1000); // Every 30 minutes
  }

  stop() {
    if (this.indexingInterval) {
      clearInterval(this.indexingInterval);
      this.indexingInterval = null;
    }
  }
}

export default FollowedChannelsIndexer;
