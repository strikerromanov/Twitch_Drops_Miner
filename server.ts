// Import dependencies
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { createServer } from 'http';
import cron from 'node-cron';
import { PointClaimingService } from './point-claiming.js';
import { DropScrapingService } from './drop-scraping.js';
import { WebSocketService } from './websocket-server.js';
import { MultiAccountCoordinator } from './multi-account-coordinator.js';
import { BackupService } from './backup-service.js';
import { BettingEngine } from './betting-engine.js';
import tmi from 'tmi.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('dist'));

// Initialize database
const db = new Database('./data/farm.db');
db.pragma('journal_mode = WAL');

// Create tables FIRST (before migrations)
const createTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      accessToken TEXT,
      refreshToken TEXT,
      status TEXT DEFAULT 'idle',
      createdAt TEXT DEFAULT (datetime('now')),
      lastActive TEXT
    );
    
    CREATE TABLE IF NOT EXISTS followed_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      streamer TEXT,
      streamer_id TEXT,
      status TEXT,
      game_name TEXT,
      viewer_count INTEGER DEFAULT 0,
      points INTEGER DEFAULT 0,
      bets INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      activeCampaigns INTEGER,
      whitelisted INTEGER,
      lastDrop TEXT
    );
    
    CREATE TABLE IF NOT EXISTS point_claim_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      streamer TEXT,
      points_claimed INTEGER,
      claimed_at TEXT,
      bonus_type TEXT
    );
    
    CREATE TABLE IF NOT EXISTS betting_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      streamer TEXT,
      totalBets INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      totalProfit INTEGER DEFAULT 0,
      avgOdds REAL DEFAULT 1.0,
      UNIQUE(streamer)
    );
    
    CREATE TABLE IF NOT EXISTS betting_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      streamer TEXT,
      amount INTEGER,
      outcome TEXT,
      profit INTEGER,
      bet_time TEXT,
      strategy TEXT
    );
    
    CREATE TABLE IF NOT EXISTS drop_campaigns (
      id TEXT PRIMARY KEY,
      name TEXT,
      game TEXT,
      required_minutes INTEGER,
      current_minutes INTEGER DEFAULT 0,
      status TEXT,
      image_url TEXT,
      last_updated TEXT
    );
    
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT DEFAULT (datetime('now')),
      level TEXT,
      message TEXT
    );
    
    CREATE TABLE IF NOT EXISTS tmi_chat_status (
      account_id INTEGER PRIMARY KEY,
      connected INTEGER DEFAULT 0,
      channel TEXT,
      last_connected TEXT
    );
    
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    
    CREATE TABLE IF NOT EXISTS stream_allocations (
      account_id INTEGER,
      streamer TEXT,
      assigned_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (account_id, streamer)
    );
    
    CREATE TABLE IF NOT EXISTS active_streams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      streamer TEXT,
      game TEXT,
      viewer_count INTEGER DEFAULT 0,
      started_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS drop_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      campaign_id TEXT,
      current_minutes INTEGER DEFAULT 0,
      last_updated TEXT DEFAULT (datetime('now'))
    );
  `);
  
  console.log('Creating database indexes...');
  try {
    db.prepare('CREATE INDEX IF NOT EXISTS idx_followed_account_streamer ON followed_channels(account_id, streamer)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_logs_time ON logs(time DESC)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_claim_history_account_time ON point_claim_history(account_id, claimed_at DESC)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_betting_streamer ON betting_stats(streamer)').run();
    console.log('✅ Database indexes created');
  } catch (error) {
    console.log('Indexes may already exist');
  }
};

createTables();

// NOW run migrations AFTER tables exist
console.log('Running database migrations...');
try {
  const columnCheck = db.prepare("PRAGMA table_info(followed_channels)").all();
  const hasViewerCount = columnCheck.some((col: any) => col.name === 'viewer_count');
  
  if (!hasViewerCount) {
    console.log('🔧 Adding viewer_count column to followed_channels...');
    db.prepare('ALTER TABLE followed_channels ADD COLUMN viewer_count INTEGER DEFAULT 0').run();
    console.log('✅ Migration: viewer_count column added');
  } else {
    console.log('✅ viewer_count column already exists');
  }
  
  db.prepare('UPDATE followed_channels SET viewer_count = 0 WHERE viewer_count IS NULL').run();
} catch (error: any) {
  console.log('Migration check completed:', error.message);
}

  // Check if active_streams has viewer_count column
  try {
    const activeStreamsColumns = db.prepare("PRAGMA table_info(active_streams)").all();
    const hasActiveStreamsViewerCount = activeStreamsColumns.some((col: any) => col.name === 'viewer_count');
    
    if (!hasActiveStreamsViewerCount) {
      console.log('🔧 Adding viewer_count column to active_streams...');
      db.prepare('ALTER TABLE active_streams ADD COLUMN viewer_count INTEGER DEFAULT 0').run();
      console.log('✅ Migration: viewer_count column added to active_streams');
    } else {
      console.log('✅ active_streams already has viewer_count column');
    }
  } catch (error: any) {
    console.log('active_streams migration check:', error.message);
  }

// Initialize enhanced services
console.log('Initializing enhanced services...');

const pointClaimingService = new PointClaimingService(db);
const dropScrapingService = new DropScrapingService(db);
const webSocketService = new WebSocketService(server, db);
const multiAccountCoordinator = new MultiAccountCoordinator('./data/farm.db');
const backupService = new BackupService('./data/farm.db');
const bettingEngine = new BettingEngine(db);

// Initialize all services
await pointClaimingService.initialize();
await dropScrapingService.initialize();
bettingEngine.initialize();

console.log('Enhanced features loaded: Point Claiming, Betting Engine, 20/80 Allocation');
console.log('NEW: Real Point Claiming (Playwright), Drop Scraping, WebSocket, Multi-Account Coordination, Automated Backups');
console.log('Event-Driven Betting: Places bets when opportunities arise, not on schedule');

// Chat clients for point claiming
const chatClients: Map<number, any> = new Map();

// API Routes
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COALESCE((SELECT SUM(points) FROM followed_channels), 0) as totalPoints,
        (SELECT COUNT(*) FROM point_claim_history) as totalClaims,
        (SELECT COUNT(*) FROM accounts WHERE status = 'farming') as activeAccounts,
        (SELECT COUNT(*) FROM betting_history) as totalBets,
        (SELECT COUNT(*) FROM tmi_chat_status WHERE connected = 1) as connectedChats
    `).get() as any;
    
    res.json({
      totalPoints: stats.totalPoints || 0,
      dropsClaimed: 0,
      activeAccounts: stats.activeAccounts || 0,
      uptime: 'Real-time API Active',
      totalClaims: stats.totalClaims || 0,
      totalBets: stats.totalBets || 0,
      connectedChats: stats.connectedChats || 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const { username, accessToken, refreshToken } = req.body;
    
    // Validate required fields
    if (!username || !accessToken || !refreshToken) {
      return res.status(400).json({ error: 'Missing required fields: username, accessToken, refreshToken are required' });
    }
    
    const result = db.prepare(`
      INSERT INTO accounts (username, accessToken, refreshToken, status)
      VALUES (?, ?, ?, 'idle')
    `).run(username, accessToken, refreshToken);
    
    bettingEngine.setEnabled(true);
    
    res.json({ success: true, accountId: result.lastInsertRowid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/accounts', (req, res) => {
  try {
    const accounts = db.prepare('SELECT * FROM accounts').all();
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/accounts/:id', (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    if (chatClients.has(accountId)) {
      const client = chatClients.get(accountId);
      client?.disconnect();
      chatClients.delete(accountId);
    }
    
    db.prepare('DELETE FROM followed_channels WHERE account_id = ?').run(accountId);
    db.prepare('DELETE FROM tmi_chat_status WHERE account_id = ?').run(accountId);
    db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
    
    console.log(`Deleted account ${accountId}`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/accounts/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const accountId = parseInt(req.params.id);
    
    // Check if account exists first
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    db.prepare('UPDATE accounts SET status = ? WHERE id = ?').run(status, accountId);
    
    if (status === 'farming') {
      pointClaimingService.startWatchingAccount(accountId, account.accessToken);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings - Load all settings
app.get('/api/settings', (req, res) => {
  try {
    const twitchClientId = db.prepare('SELECT value FROM settings WHERE key = ?').get('twitchClientId')?.value || '';
    const concurrentStreams = db.prepare('SELECT value FROM settings WHERE key = ?').get('concurrentStreams')?.value || '10';
    const dropAllocation = db.prepare('SELECT value FROM settings WHERE key = ?').get('dropAllocation')?.value || '20';
    const bettingEnabled = db.prepare('SELECT value FROM settings WHERE key = ?').get('bettingEnabled')?.value || 'false';
    const maxBetPercentage = db.prepare('SELECT value FROM settings WHERE key = ?').get('maxBetPercentage')?.value || '5';
    const pointClaimInterval = db.prepare('SELECT value FROM settings WHERE key = ?').get('pointClaimInterval')?.value || '300';

    res.json({
      twitchClientId,
      concurrentStreams,
      dropAllocation,
      bettingEnabled,
      maxBetPercentage,
      pointClaimInterval
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const { twitchClientId, concurrentStreams, dropAllocation } = req.body;

    const insert = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    if (twitchClientId !== undefined) {
      insert.run('twitchClientId', twitchClientId);
    }
    if (concurrentStreams !== undefined) {
      insert.run('concurrentStreams', concurrentStreams.toString());
    }
    if (dropAllocation !== undefined) {
      insert.run('dropAllocation', dropAllocation.toString());
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/device - Initiate Twitch Device Authorization Flow
app.post('/api/auth/device', async (req, res) => {
  try {
    const twitchClientId = db.prepare('SELECT value FROM settings WHERE key = ?').get('twitchClientId')?.value;

    if (!twitchClientId) {
      return res.status(400).json({ error: 'Twitch Client ID is not configured. Please add it in Settings.' });
    }

    // Call Twitch Device Authorization endpoint
    const response = await fetch('https://id.twitch.tv/oauth2/device', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: twitchClientId,
        scopes: 'user:read:email chat:read chat:edit channel:read:subscriptions'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Twitch Device Auth Error:', errorData);
      return res.status(500).json({ error: 'Failed to initiate device authorization. Please check your Client ID.' });
    }

    const data = await response.json();

    // Debug logging
    console.log('[AUTH POLL] Twitch response status:', response.status, 'OK:', response.ok);
    console.log('[AUTH POLL] Twitch response data:', JSON.stringify(data, null, 2));

    res.json({
      user_code: data.user_code,
      device_code: data.device_code,
      verification_uri: data.verification_uri,
      verification_uri_complete: data.verification_uri_complete,
      expires_in: data.expires_in,
      interval: data.interval || 5
    });
  } catch (error: any) {
    console.error('Device auth error:', error);
    res.status(500).json({ error: 'Failed to initiate device authorization: ' + error.message });
  }
});

// POST /api/auth/poll - Poll for device authorization completion
app.post('/api/auth/poll', async (req, res) => {
  try {
    const { device_code } = req.body;

    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }

    const twitchClientId = db.prepare('SELECT value FROM settings WHERE key = ?').get('twitchClientId')?.value;

    if (!twitchClientId) {
      return res.status(400).json({ error: 'Twitch Client ID is not configured' });
    }

    // Poll Twitch Token endpoint
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: twitchClientId,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: device_code
      })
    });

    const data = await response.json();

    // Debug logging
    console.log('[AUTH POLL] Twitch response status:', response.status, 'OK:', response.ok);
    console.log('[AUTH POLL] Twitch response data:', JSON.stringify(data, null, 2));

    if (response.ok && data.access_token) {
      // Get user info with access token
      const userResponse = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          'Authorization': 'Bearer ' + data.access_token,
          'Client-Id': twitchClientId
        }
      });

      if (!userResponse.ok) {
        return res.status(500).json({ error: 'Failed to get user info' });
      }

      const userData = await userResponse.json();
      const username = userData.data[0].login;
      const userId = userData.data[0].id;

      // Check if account already exists
      const existing = db.prepare('SELECT id FROM accounts WHERE user_id = ?').get(userId);

      if (existing) {
        // Update existing account
        db.prepare(`
          UPDATE accounts SET 
            access_token = ?, 
            refresh_token = ?, 
            status = 'idle',
            updated_at = datetime('now')
          WHERE user_id = ?
        `).run(data.access_token, data.refresh_token || '', userId);
      } else {
        // Create new account
        db.prepare(`
          INSERT INTO accounts (username, user_id, access_token, refresh_token, status, created_at)
          VALUES (?, ?, ?, ?, 'idle', datetime('now'))
        `).run(username, userId, data.access_token, data.refresh_token || '');
      }

      res.json({
        status: 'success',
        username: username,
        user_id: userId
      });
    } else if (data.error === 'authorization_pending') {
      res.json({ status: 'pending' });
    } else if (data.error === 'slow_down') {
      res.json({ status: 'slow_down' });
    } else if (data.error === 'expired_token') {
      res.json({
        status: 'error',
        error: 'Device code has expired. Please start over and complete authentication within 30 minutes.'
      });
    } else if (data.error === 'invalid_device') {
      res.json({
        status: 'error',
        error: 'Invalid device code. Please try adding your account again.'
      });
    } else {
      // Log unknown errors for debugging
      console.error('[AUTH POLL] Unknown error from Twitch:', data);
      res.json({
        status: 'error',
        error: data.error || 'Authorization failed'
      });
    }
  } catch (error: any) {
    console.error('Auth poll error:', error);
    res.status(500).json({ error: 'Failed to poll authorization status: ' + error.message });
  }
});

app.post('/api/settings/betting', (req, res) => {
  try {
    const { enabled, maxBetPercentage } = req.body;
    
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES ('bettingEnabled', ?)
    `).run(enabled ? '1' : '0');
    
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES ('maxBetPercentage', ?)
    `).run(maxBetPercentage.toString());
    
    bettingEngine.setEnabled(enabled);
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/betting/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT streamer, totalBets, wins, totalProfit,
             CAST(wins AS REAL) / totalBets as winRate
      FROM betting_stats
      WHERE totalBets > 0
      ORDER BY totalProfit DESC
    `).all();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/drops/campaigns', async (req, res) => {
  try {
    const campaigns = await dropScrapingService.scrapeDropCampaigns();
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    features: {
      pointClaiming: pointClaimingService.isEnabled(),
      dropScraping: dropScrapingService.isEnabled(),
      betting: true,
      websocket: true
    }
  });
});

// Scheduled tasks
cron.schedule('*/5 * * * *', async () => {
  console.log('[SYSTEM] Running scheduled point claim task...');
  try {
    const accounts = db.prepare("SELECT id FROM accounts WHERE status = 'farming'").all() as any[];
    for (const account of accounts) {
      await pointClaimingService.watchAndClaim(account.id);
    }
  } catch (error) {
    console.error('Error in scheduled point claim:', error);
  }
});

cron.schedule('*/30 * * * *', async () => {
  console.log('[SYSTEM] Scraping drop campaigns...');
  try {
    await dropScrapingService.scrapeDropCampaigns();
  } catch (error) {
    console.error('Error scraping drops:', error);
  }
});

cron.schedule('0 0 * * *', () => {
  console.log('[SYSTEM] Running daily log cleanup...');
  try {
    db.prepare("DELETE FROM logs WHERE time < datetime('now', '-30 days')").run();
    db.prepare(`DELETE FROM logs WHERE id < (
      SELECT id FROM logs ORDER BY id DESC LIMIT 1 OFFSET 10000
    )`).run();
  } catch (error) {
    console.error('Error cleaning up logs:', error);
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile('dist/index.html', { root: '.' });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Mode: production');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await pointClaimingService.stop();
  await dropScrapingService.stop();
  server.close();
  process.exit(0);
});
