import { Account, FollowedChannel, TwitchStream } from '../core/types';
import { Queries, getDb } from '../core/database';
import { logInfo, logError, logDebug } from '../core/logger';
import { STREAM_CHECK_INTERVAL, TWITCH_API_URL } from '../core/config';

/**
 * Service for tracking followed channels on Twitch
 * Syncs followed channels and updates their status periodically
 */
export class FollowedChannelsService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private db: Database;
  private clientId: string;

  /**
   * Create followed channels service
   * @param db - Database instance
   * @param clientId - Twitch OAuth client ID
   */
  constructor(db: Database, clientId: string) {
    this.db = db;
    this.clientId = clientId;
  }

  /**
   * Get access token for a specific account from database
   * @param accountId - Account ID
   * @returns Access token
   */
  private getAccountToken(accountId: number): string {
    const account = this.db.prepare(
      'SELECT access_token FROM accounts WHERE id = ?'
    ).get(accountId) as { access_token: string } | undefined;

    if (!account?.access_token) {
      throw new Error(`No access token found for account ${accountId}`);
    }

    return account.access_token;
  }

  /**
   * Start the followed channels service
   * Begins periodic syncing of followed channels
   */
  start(): void {
    if (this.isRunning) {
      logWarn('FollowedChannelsService already running');
      return;
    }

    this.isRunning = true;
    logInfo('Starting FollowedChannelsService');

    // Initial sync
    this.syncChannels().catch(err => {
      logError('Initial channel sync failed', {}, err);
    });

    // Set up recurring interval
    this.intervalId = setInterval(() => {
      this.updateStatus().catch(err => {
        logError('Channel status update failed', {}, err);
      });
    }, STREAM_CHECK_INTERVAL);
  }

  /**
   * Stop the followed channels service
   * Stops periodic checking and performs cleanup
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logInfo('Stopping FollowedChannelsService');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
  }

  /**
   * Synchronize followed channels from Twitch API
   * Fetches all followed channels for all active accounts
   */
  async syncChannels(): Promise<void> {
    try {
      logDebug('Syncing followed channels from Twitch API');
      
      const accounts = Queries.getAccounts().all() as Account[];
      const activeAccounts = accounts.filter(acc => 
        acc.status === 'active' && acc.access_token && acc.user_id
      );

      for (const account of activeAccounts) {
        try {
          await this.syncAccountChannels(account);
        } catch (error) {
          logError('Failed to sync channels for account', 
            { accountId: account.id, username: account.username }, 
            error as Error
          );
        }
      }
      
      logInfo('Followed channels sync completed');
    } catch (error) {
      logError('Failed to sync channels', {}, error as Error);
      throw error;
    }
  }

  /**
   * Update status of tracked channels
   * Fetches current stream status for all followed channels
   */
  async updateStatus(): Promise<void> {
    try {
      logDebug('Updating followed channels status');
      
      const channels = getDb().prepare('SELECT DISTINCT streamer FROM followed_channels').all() as { streamer: string }[];
      
      for (const { streamer } of channels) {
        try {
          await this.updateChannelStatus(streamer);
        } catch (error) {
          logError('Failed to update channel status', { streamer }, error as Error);
        }
      }
      
      logDebug('Channel status update completed');
    } catch (error) {
      logError('Failed to update channel status', {}, error as Error);
      throw error;
    }
  }

  /**
   * Sync followed channels for a specific account
   * @param account - Account to sync channels for
   */
  private async syncAccountChannels(account: Account): Promise<void> {
    const response = await fetch(
      `${TWITCH_API_URL}/channels/followed?user_id=${account.user_id}&first=100`,
      {
        headers: {
          'Client-Id': this.clientId,
          'Authorization': `Bearer ${account.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twitch API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const followedChannels = data.data || [];

    const upsertChannel = getDb().prepare(`
      INSERT INTO followed_channels (account_id, streamer, streamer_id, status, game_name, viewer_count, points, bets)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, streamer) DO UPDATE SET
        status = excluded.status,
        game_name = excluded.game_name,
        viewer_count = excluded.viewer_count
    `);

    for (const channel of followedChannels) {
      upsertChannel.run(
        account.id,
        channel.broadcaster_login || channel.broadcaster_name,
        channel.broadcaster_id,
        'offline',
        null,
        0,
        0,
        0
      );
    }

    logDebug('Synced channels for account', 
      { accountId: account.id, count: followedChannels.length }
    );
  }

  /**
   * Update status for a specific channel
   * @param streamer - Streamer username to update
   */
  private async updateChannelStatus(streamer: string): Promise<void> {
    // Get a token from one of the accounts that follows this channel
    const accountData = this.db.prepare(
      'SELECT a.access_token FROM accounts a ' +
      'INNER JOIN followed_channels f ON a.id = f.account_id ' +
      'WHERE f.streamer = ? AND a.access_token IS NOT NULL ' +
      'LIMIT 1'
    ).get(streamer) as { access_token: string } | undefined;

    if (!accountData?.access_token) {
      throw new Error(`No access token found for any account following ${streamer}`);
    }

    const response = await fetch(
      `${TWITCH_API_URL}/streams?user_login=${streamer}`,
      {
        headers: {
          'Client-Id': this.clientId,
          'Authorization': `Bearer ${accountData.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twitch API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const streams = data.data || [];

    const updateChannel = getDb().prepare(`
      UPDATE followed_channels
      SET status = ?, game_name = ?, viewer_count = ?
      WHERE streamer = ?
    `);

    if (streams.length > 0) {
      const stream = streams[0];
      updateChannel.run('online', stream.game_name, stream.viewer_count, streamer);
    } else {
      updateChannel.run('offline', null, 0, streamer);
    }
  }

  /**
   * Get followed channels for an account
   * @param accountId - Account ID
   * @param filterStatus - Optional status filter ('online', 'offline')
   * @returns Array of followed channels
   */
  getFollowedChannels(accountId: number, filterStatus?: string): FollowedChannel[] {
    let query = 'SELECT * FROM followed_channels WHERE account_id = ?';
    const params: any[] = [accountId];

    if (filterStatus) {
      query += ' AND status = ?';
      params.push(filterStatus);
    }

    const channels = getDb().prepare(query).all(...params) as FollowedChannel[];
    return channels;
  }

  /**
   * Get online followed channels across all accounts
   * @returns Array of online channels
   */
  getOnlineChannels(): FollowedChannel[] {
    const channels = getDb().prepare(`
      SELECT DISTINCT streamer, streamer_id, game_name, viewer_count, status
      FROM followed_channels
      WHERE status = 'online'
      ORDER BY viewer_count DESC
    `).all() as FollowedChannel[];
    
    return channels;
  }

  /**
   * Get channel statistics
   * @returns Statistics about tracked channels
   */
  getChannelStats(): { total: number; online: number; offline: number } {
    const total = getDb().prepare('SELECT COUNT(*) as count FROM followed_channels').get() as { count: number };
    const online = getDb().prepare("SELECT COUNT(*) as count FROM followed_channels WHERE status = 'online'").get() as { count: number };
    const offline = getDb().prepare("SELECT COUNT(*) as count FROM followed_channels WHERE status = 'offline'").get() as { count: number };

    return {
      total: total.count,
      online: online.count,
      offline: offline.count
    };
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
 * Log warning helper
 */
function logWarn(message: string, context?: Record<string, unknown>): void {
  logError(message, context);
}
