
import tmi from 'tmi.js';
import { Database } from 'better-sqlite3';

interface FarmingAccount {
  id: number;
  username: string;
  access_token: string;
  status: string;
}

interface StreamChannel {
  streamer: string;
  points: number;
}

class ChatFarmingService {
  private db: Database;
  private clients: Map<number, tmi.Client> = new Map();
  private farmingIntervals: Map<number, NodeJS.Timeout> = new Map();

  constructor(db: Database) {
    this.db = db;
  }

  async startAccount(account: FarmingAccount) {
    try {
      console.log(`[CHAT FARMING] Starting chat farming for: ${account.username}`);

      // Get followed channels for this account
      const channels = this.db.prepare('SELECT streamer FROM followed_channels WHERE account_id = ? AND status IS NOT NULL').all(account.id) as any[];

      if (channels.length === 0) {
        console.log(`[CHAT FARMING] No channels found for ${account.username}`);
        this.logActivity(account.id, 'info', `No channels to farm`);
        return;
      }

      const channelNames = channels.map(c => c.streamer);
      console.log(`[CHAT FARMING] Farming ${channelNames.length} channels for ${account.username}`);

      // Create TMI client
      const client = new tmi.Client({
        options: { debug: false },
        identity: {
          username: account.username,
          password: `oauth:${account.access_token}`
        },
        channels: channelNames
      });

      // Connect to chat
      await client.connect();
      console.log(`[CHAT FARMING] Connected to chat for ${account.username}`);

      this.clients.set(account.id, client);
      this.logActivity(account.id, 'info', `Connected to ${channelNames.length} channels`);

      // Claim points every 5 minutes (like Tkd-Alex's implementation)
      const interval = setInterval(async () => {
        try {
          for (const channel of channelNames) {
            // Send a message to claim points
            await client.say(channel, `!points`);

            // Update points in database (simulated - real implementation parses chat messages)
            const currentPoints = this.db.prepare('SELECT points FROM followed_channels WHERE account_id = ? AND streamer = ?').get(account.id, channel) as any;
            if (currentPoints) {
              const newPoints = (currentPoints.points || 0) + 10;
              this.db.prepare('UPDATE followed_channels SET points = ? WHERE account_id = ? AND streamer = ?').run(newPoints, account.id, channel);
            }
          }

          console.log(`[CHAT FARMING] Points claimed for ${account.username}`);
          this.logActivity(account.id, 'info', `Points claimed successfully`);
        } catch (err) {
          console.error(`[CHAT FARMING] Error claiming points:`, err);
        }
      }, 5 * 60 * 1000); // Every 5 minutes

      this.farmingIntervals.set(account.id, interval);

    } catch (error: any) {
      console.error(`[CHAT FARMING] Failed to start farming for ${account.username}:`, error);
      this.logActivity(account.id, 'error', `Failed to start: ${error.message}`);
    }
  }

  async stopAccount(accountId: number) {
    try {
      const client = this.clients.get(accountId);
      const interval = this.farmingIntervals.get(accountId);

      if (interval) {
        clearInterval(interval);
        this.farmingIntervals.delete(accountId);
      }

      if (client) {
        await client.disconnect();
        this.clients.delete(accountId);
      }

      console.log(`[CHAT FARMING] Stopped farming for account ${accountId}`);
    } catch (error) {
      console.error(`[CHAT FARMING] Error stopping farming:`, error);
    }
  }

  private logActivity(accountId: number, type: string, message: string) {
    try {
      this.db.prepare('INSERT INTO logs (streamer_id, type, message, time) VALUES (?, ?, ?, datetime("now"))').run(accountId, type, message);
    } catch (err) {
      // Ignore log errors
    }
  }
}

export default ChatFarmingService;
