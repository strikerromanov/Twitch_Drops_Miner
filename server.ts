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

// Import new farming and indexing services


const app = express();
// Enhanced error logging middleware
app.use((req, res, next) => {
  const bodyStr = req.body ? JSON.stringify(req.body) : 'undefined';
  console.log(`[API] ${req.method} ${req.path} | Query: ${JSON.stringify(req.query)} | Body: ${bodyStr.substring(0, 200)}`);
  next();
});


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
      lastActive TEXT,
      user_id TEXT
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
// NOW run migrations AFTER tables exist

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
  // Add missing columns to logs table for new services
  try {
    db.prepare('ALTER TABLE logs ADD COLUMN streamer_id INTEGER').run();
    console.log('✅ Added streamer_id column to logs table');
  } catch (err: any) {
    if (!err.message.includes('duplicate column')) {
      console.error('Failed to add streamer_id column:', err.message);
    }
  }
  try {
    db.prepare('ALTER TABLE logs ADD COLUMN type TEXT').run();
    console.log('✅ Added type column to logs table');
  } catch (err: any) {
    if (!err.message.includes('duplicate column')) {
      console.error('Failed to add type column:', err.message);
    }
  }
  // Check if followed_channels has all required columns
  try {
    const followedColumns = db.prepare("PRAGMA table_info(followed_channels)").all();
    const columnNames = followedColumns.map((c: any) => c.name);
    if (!columnNames.includes('streamer_id')) {
      console.log('🔧 Adding streamer_id column to followed_channels...');
      db.prepare('ALTER TABLE followed_channels ADD COLUMN streamer_id TEXT').run();
      console.log('✅ Migration: streamer_id column added');
    }
    if (!columnNames.includes('game_name')) {
      console.log('🔧 Adding game_name column to followed_channels...');
      db.prepare('ALTER TABLE followed_channels ADD COLUMN game_name TEXT').run();
      console.log('✅ Migration: game_name column added');
    }
    if (!columnNames.includes('bets')) {
      console.log('🔧 Adding bets column to followed_channels...');
      db.prepare('ALTER TABLE followed_channels ADD COLUMN bets INTEGER DEFAULT 0').run();
      console.log('✅ Migration: bets column added');
    }
  } catch (error: any) {
    console.log('Followed channels migration check completed:', error.message);
  }
  // Check if accounts has user_id column
  try {
    const accountsColumns = db.prepare("PRAGMA table_info(accounts)").all();
    const hasUserId = accountsColumns.some((col: any) => col.name === 'user_id');
    if (!hasUserId) {
      console.log('🔧 Adding user_id column to accounts...');
      db.prepare('ALTER TABLE accounts ADD COLUMN user_id TEXT').run();
      console.log('✅ Migration: user_id column added to accounts');
    } else {
      console.log('✅ accounts already has user_id column');
    }
  } catch (error: any) {
    console.log('Migration check completed:', error.message);
  }
} catch (err: any) {
  console.error('Database migration error:', err.message);
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


  // Initialize new services using dynamic imports
  (async () => {
    try {
      const settings = db.prepare('SELECT * FROM settings').all() as any[];
      const clientId = settings.find(s => s.key === 'twitchClientId')?.value || '';
      
      // Dynamic imports to avoid module format issues
// API Routes for Twitch Drops Miner
// Add these routes to server.ts before server.listen()

// ===== SETTINGS ROUTES =====
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();
    const settingsObj: Record<string, string> = {};
    settings.forEach((s: any) => {
      settingsObj[s.key] = s.value;
    });
    res.json(settingsObj);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value required' });
    }
    
    const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
    if (existing) {
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(value, key);
    } else {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
    }
    
    res.json({ success: true, key, value });
  } catch (error) {
    console.error('Error saving setting:', error);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

app.get('/api/settings/betting', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE key LIKE "betting_%"').all();
    const settingsObj: Record<string, string> = {};
    settings.forEach((s: any) => {
      settingsObj[s.key] = s.value;
    });
    res.json(settingsObj);
  } catch (error) {
    console.error('Error fetching betting settings:', error);
    res.status(500).json({ error: 'Failed to fetch betting settings' });
  }
});

app.post('/api/settings/betting', (req, res) => {
  try {
    const updates = req.body;
    console.log('[SETTINGS] Saving betting settings:', JSON.stringify(updates));
    Object.entries(updates).forEach(([key, value]) => {
      const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
      // Serialize objects/arrays to JSON strings for SQLite
      const serializedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      console.log(`[SETTINGS] Saving key=${key}, value=${serializedValue}`);
      if (existing) {
        db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(serializedValue, key);
      } else {
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, serializedValue);
      }
    });
    console.log('[SETTINGS] Settings saved successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving betting settings:', error);
    res.status(500).json({ error: 'Failed to save betting settings' });
  }
});

// ===== ACCOUNT ROUTES =====

app.get('/api/stats', (req, res) => {
  try {
    // Get account stats
    const totalAccounts = db.prepare('SELECT COUNT(*) as count FROM accounts').get().count;
    const activeAccounts = db.prepare('SELECT COUNT(*) as count FROM accounts WHERE status = "farming"').get().count;

    // Get drop stats
    const totalDrops = db.prepare('SELECT COUNT(*) as count FROM drop_progress').get().count;
    const claimedDrops = db.prepare('SELECT COUNT(*) as count FROM drop_progress WHERE claimed = 1').get().count;

    // Get recent claims (last 24 hours)
    const recentClaims = db.prepare(`
      SELECT COUNT(*) as count FROM point_claim_history 
      WHERE datetime(claimedAt) > datetime('now', '-24 hours')
    `).get().count;

    // Get active streams count
    const activeStreams = db.prepare('SELECT COUNT(*) as count FROM active_streams').get().count;

    res.json({
      activeAccounts: activeAccounts || 0,
      totalAccounts: totalAccounts || 0,
      totalDrops: totalDrops || 0,
      claimedDrops: claimedDrops || 0,
      recentClaims: recentClaims || 0,
      activeStreams: activeStreams || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    // Return default stats on error
    res.json({
      activeAccounts: 0,
      totalAccounts: 0,
      totalDrops: 0,
      claimedDrops: 0,
      recentClaims: 0,
      activeStreams: 0,
      timestamp: new Date().toISOString()
    });
  }
});


app.get('/api/accounts', (req, res) => {
  try {
    const accounts = db.prepare('SELECT id, username, status, createdAt, lastActive, user_id FROM accounts').all();
    res.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.post('/api/accounts/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const account = db.prepare('SELECT status FROM accounts WHERE id = ?').get(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const newStatus = account.status === 'farming' ? 'idle' : 'farming';
    db.prepare('UPDATE accounts SET status = ?, lastActive = datetime("now") WHERE id = ?').run(newStatus, id);
    
    res.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Error toggling account:', error);
    res.status(500).json({ error: 'Failed to toggle account' });
  }
});

app.delete('/api/accounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ===== CAMPAIGNS ROUTES =====
app.get('/api/campaigns', (req, res) => {
  try {
    const campaigns = db.prepare('SELECT * FROM drop_campaigns ORDER BY createdAt DESC').all();
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// ===== GAMES ROUTES =====
app.get('/api/games', (req, res) => {
  try {
    const games = db.prepare('SELECT * FROM games ORDER BY name').all();
    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.post('/api/games/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const game = db.prepare('SELECT enabled FROM games WHERE id = ?').get(id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const newEnabled = game.enabled ? 0 : 1;
    db.prepare('UPDATE games SET enabled = ? WHERE id = ?').run(newEnabled, id);
    
    res.json({ success: true, enabled: !!newEnabled });
  } catch (error) {
    console.error('Error toggling game:', error);
    res.status(500).json({ error: 'Failed to toggle game' });
  }
});

// ===== LOGS ROUTES =====
app.get('/api/logs', (req, res) => {
  try {
    const { streamer_id, type } = req.query;
    let query = 'SELECT * FROM logs';
    const params: any[] = [];
    const conditions: string[] = [];

    if (streamer_id) {
      conditions.push('streamer_id = ?');
      params.push(streamer_id);
    }

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY time DESC LIMIT 100';
    const logs = db.prepare(query).all(...params);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ===== AUTH ROUTES =====
app.post('/api/auth/device', async (req, res) => {
  try {
    // This would trigger Twitch device auth flow
    // For now, return a placeholder response
    res.json({ 
      success: true,
      message: 'Device auth initiated',
      userCode: 'PLACEHOLDER',
      verificationUri: 'https://www.twitch.tv/activate'
    });
  } catch (error) {
    console.error('Error initiating device auth:', error);
    res.status(500).json({ error: 'Failed to initiate device auth' });
  }
});

app.post('/api/auth/poll', async (req, res) => {
  try {
    const { userCode } = req.body;
    // This would poll Twitch for auth completion
    // For now, return a placeholder response
    res.json({ 
      success: false,
      message: 'Auth not implemented yet',
      pending: true
    });
  } catch (error) {
    console.error('Error polling auth:', error);
    res.status(500).json({ error: 'Failed to poll auth status' });
  }
});

// ===== FACTORY RESET =====
app.post('/api/factory-reset', (req, res) => {
  try {
    // Reset all settings to defaults
    db.prepare('DELETE FROM settings').run();
    
    // Set default settings
    const defaults = [
      { key: 'twitchClientId', value: '' },
      { key: 'refreshInterval', value: '600000' },
      { key: 'maxAccounts', value: '5' },
      { key: 'betting_enabled', value: 'false' },
      { key: 'betting_strategy', value: 'conservative' }
    ];
    
    defaults.forEach(setting => {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(setting.key, setting.value);
    });
    
    // Clear all accounts
    db.prepare('DELETE FROM accounts').run();
    
    res.json({ success: true, message: 'Factory reset completed' });
  } catch (error) {
    console.error('Error performing factory reset:', error);
    res.status(500).json({ error: 'Failed to perform factory reset' });
  }
});

// ===== BETTING STATS =====
app.get('/api/betting-stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as totalBets,
        SUM(CASE WHEN outcome = 'won' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome = 'lost' THEN 1 ELSE 0 END) as losses,
        SUM(amount) as totalWagered
      FROM betting_history
    `).get();
    res.json(stats || { totalBets: 0, wins: 0, losses: 0, totalWagered: 0 });
  } catch (error) {
    console.error('Error fetching betting stats:', error);
    res.status(500).json({ error: 'Failed to fetch betting stats' });
  }
});

// ===== STREAMER ANALYSIS =====
app.get('/api/streamer-analysis', (req, res) => {
  try {
    const analysis = db.prepare(`
      SELECT
        streamer_id as streamer,
        COUNT(*) as pointsClaimed,
        AVG(CAST(message AS INTEGER)) as avgPoints,
        MAX(time) as lastClaimed
      FROM logs
      WHERE type = 'points_claimed' AND time > datetime('now', '-7 days')
      GROUP BY streamer_id
      ORDER BY pointsClaimed DESC
    `).all();
    res.json(analysis);
  } catch (error) {
    console.error('Error fetching streamer analysis:', error);
    res.status(500).json({ error: 'Failed to fetch streamer analysis' });
  }
});

console.log('✅ API routes registered');
      const { default: Dropboxer } = await import('./drop-indexer.ts');
      const { default: ChatFarmingService } = await import('./chat-farming.ts');
      const { default: FollowedChannelsIndexer } = await import('./followed-channels-indexer.ts');
      
      const dropIndexer = new Dropboxer(db, clientId);
      const chatFarming = new ChatFarmingService(db);
      const followedIndexer = new FollowedChannelsIndexer(db, clientId);
      
      console.log('[SERVICES] Dropboxer initialized');
      console.log('[SERVICES] Chat Farming Service initialized');
      console.log('[SERVICES] Followed Channels Indexer initialized');
      
      // Start drop indexing
      dropIndexer.start();
      
      // Start followed channels indexing
      followedIndexer.start();
      
      // Make services globally available for API routes
      (global as any).dropIndexer = dropIndexer;
      (global as any).chatFarming = chatFarming;
      (global as any).followedIndexer = followedIndexer;
    } catch (error) {
      console.error('[SERVICES] Failed to initialize services:', error);
    }
  })();



// Start the HTTP server
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🎯 API available at http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});
