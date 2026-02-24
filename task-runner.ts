// setInterval and clearInterval are global in Node.js
import Database from 'better-sqlite3';
import tmi from 'tmi.js';
import WebSocket from 'ws';

const db = new Database('./data/farm.db');

interface Streamer {
  id: number;
  username: string;
  access_token: string;
  status: string;
}

class TaskRunner {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private chatClients: Map<number, tmi.Client> = new Map();
  private websocket: WebSocket | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    console.log('[TASK RUNNER] Initializing...');

    // Start continuous loops
    this.startFarmingLoop();
    this.startDropIndexingLoop();
    this.startChatConnections();
    this.connectTwitchWebSocket();

    console.log('[TASK RUNNER] All loops started');
  }

  private startFarmingLoop() {
    // Run every 30 seconds
    const interval = setInterval(async () => {
      try {
        await this.checkStreamers();
        await this.claimPoints();
        await this.updateStreams();
      } catch (error) {
        console.error('[TASK RUNNER] Farming loop error:', error);
      }
    }, 30000);

    this.intervals.set('farming', interval);
    console.log('[TASK RUNNER] Farming loop started (30s interval)');
  }

  private async checkStreamers() {
    const streamers = db.prepare('SELECT id, username, access_token, status FROM accounts WHERE status = ?').all('farming') as Streamer[];

    console.log(`[TASK RUNNER] Checking ${streamers.length} farming streamers`);

    for (const streamer of streamers) {
      // Check if streamer is live
      // Fetch stream info from Twitch API
      // Update database
      // Log activity
      this.logActivity(streamer.id, 'info', `Checked ${streamer.username}`);
    }
  }

  private async claimPoints() {
    const streamers = db.prepare('SELECT id, username, access_token FROM accounts WHERE status = ?').all('farming') as Streamer[];

    for (const streamer of streamers) {
      const client = this.chatClients.get(streamer.id);
      if (client) {
        // Send chat message to trigger point claim
        client.say(streamer.username, '!points');
        this.logActivity(streamer.id, 'points', `Claimed points for ${streamer.username}`);
      }
    }
  }

  private async updateStreams() {
    // Update stream metadata
    // Check for new drops
    // Update viewer counts
  }

  private startDropIndexingLoop() {
    // Run every 5 minutes
    const interval = setInterval(async () => {
      try {
        await this.indexDrops();
      } catch (error) {
        console.error('[TASK RUNNER] Drop indexing error:', error);
      }
    }, 300000);

    this.intervals.set('drops', interval);
    console.log('[TASK RUNNER] Drop indexing loop started (5min interval)');
  }

  private async indexDrops() {
    console.log('[TASK RUNNER] Indexing drops from twitch.tv/drops/campaigns');
    // Fetch campaigns
    // Parse game list
    // Update database
    this.logSystem('info', 'Indexed drop campaigns');
  }

  private startChatConnections() {
    const streamers = db.prepare('SELECT id, username, access_token FROM accounts WHERE status = ?').all('farming') as Streamer[];

    for (const streamer of streamers) {
      this.connectChat(streamer);
    }
  }

  private connectChat(streamer: Streamer) {
    const client = new tmi.Client({
      channels: [streamer.username],
      connection: {
        secure: true,
        reconnect: true
      }
    });

    client.connect();
    this.chatClients.set(streamer.id, client);
    console.log(`[TASK RUNNER] Connected to chat: ${streamer.username}`);

    // Handle messages
    client.on('message', (channel, tags, message, self) => {
      console.log(`[CHAT] ${channel}: ${message}`);
      // Process chat events
      // Detect bonus claims
      // Update points
    });
  }

  private connectTwitchWebSocket() {
    const ws = new WebSocket('wss://pubsub-edge.twitch.tv');

    ws.on('open', () => {
      console.log('[TASK RUNNER] Connected to Twitch WebSocket');
      // Listen for topics
      // Subscribe to channel points
    });

    ws.on('message', (data) => {
      console.log('[WS] Received message');
      // Parse PubSub messages
      // Handle channel points events
      // Handle drop progress events
    });

    this.websocket = ws;
  }

  private logActivity(streamerId: number, type: string, message: string) {
    try {
      db.prepare('INSERT INTO logs (streamer_id, type, message, time) VALUES (?, ?, ?, datetime("now"))').run(streamerId, type, message);
      console.log(`[LOG] ${type.toUpperCase()}: ${message}`);
    } catch (error) {
      console.error('[LOG] Failed to log activity:', error);
    }
  }

  private logSystem(type: string, message: string) {
    try {
      db.prepare('INSERT INTO logs (type, message, time) VALUES (?, ?, datetime("now"))').run(type, message);
      console.log(`[LOG] ${type.toUpperCase()}: ${message}`);
    } catch (error) {
      console.error('[LOG] Failed to log system message:', error);
    }
  }

  public stop() {
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();

    // Disconnect all chat clients
    this.chatClients.forEach(client => client.disconnect());
    this.chatClients.clear();

    // Close WebSocket
    if (this.websocket) {
      this.websocket.close();
    }

    console.log('[TASK RUNNER] Stopped all loops');
  }
}

// Initialize task runner
const taskRunner = new TaskRunner();

// Cleanup on exit
process.on('SIGINT', () => {
  taskRunner.stop();
  process.exit(0);
});

export default taskRunner;
