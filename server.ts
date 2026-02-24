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

// CRITICAL: Run database migrations immediately after initialization
console.log('Running database migrations...');
try {
  // Migration: Add viewer_count column if it does not exist
  const columnCheck = db.prepare("PRAGMA table_info(followed_channels)").all();
  const hasViewerCount = columnCheck.some((col: any) => col.name === 'viewer_count');
  
  if (!hasViewerCount) {
    console.log('🔧 Adding viewer_count column to followed_channels...');
    db.prepare('ALTER TABLE followed_channels ADD COLUMN viewer_count INTEGER DEFAULT 0').run();
    console.log('✅ Migration: viewer_count column added');
  } else {
    console.log('✅ viewer_count column already exists');
  }
  
  // Update any NULL values to 0
  db.prepare('UPDATE followed_channels SET viewer_count = 0 WHERE viewer_count IS NULL').run();
} catch (error: any) {
  console.log('Migration check completed:', error.message);
}

// Create tables
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
  `);
  
  // Create indexes
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

// Initialize enhanced services
console.log('Initializing enhanced services...');

const pointClaimingService = new PointClaimingService(db);
const dropScrapingService = new DropScrapingService(db);
const webSocketService = new WebSocketService(server, "./data/farm.db");
const multiAccountCoordinator = new MultiAccountCoordinator(db);
const backupService = new BackupService("./data/farm.db");
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
        COALESCE(SUM(points), 0) as totalPoints,
        (SELECT COUNT(*) FROM point_claim_history) as totalClaims,
        (SELECT COUNT(*) FROM accounts WHERE status = 'farming') as activeAccounts,
        (SELECT COUNT(*) FROM betting_history) as totalBets,
        (SELECT COUNT(DISTINCT account_id) FROM tmi_chat_status WHERE connected = 1) as connectedChats
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

// Add account endpoint
app.post('/api/accounts', async (req, res) => {
  try {
    const { username, accessToken, refreshToken } = req.body;
    
    const result = db.prepare(`
      INSERT INTO accounts (username, accessToken, refreshToken, status)
      VALUES (?, ?, ?, 'idle')
    `).run(username, accessToken, refreshToken);
    
    // Initialize betting stats for new streamers
    bettingEngine.setEnabled(true);
    
    res.json({ success: true, accountId: result.lastInsertRowId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get accounts endpoint
app.get('/api/accounts', (req, res) => {
  try {
    const accounts = db.prepare('SELECT * FROM accounts').all();
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update account status
app.post('/api/accounts/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const accountId = parseInt(req.params.id);
    
    db.prepare('UPDATE accounts SET status = ? WHERE id = ?').run(status, accountId);
    
    // Start/stop point claiming
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
    if (status === 'farming') {
      pointClaimingService.startWatchingAccount(accountId, account.accessToken);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Betting settings
app.post('/api/settings/betting', (req, res) => {
  try {
    const { enabled, maxBetPercentage } = req.body;
    
    // Save to settings
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

// Get betting stats
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

// Get drop campaigns
app.get('/api/drops/campaigns', async (req, res) => {
  try {
    // Scrape campaigns
    const campaigns = await dropScrapingService.scrapeDropCampaigns();
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
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
// Point claiming every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('[SYSTEM] Running scheduled point claim task...');
  try {
    const accounts = db.prepare('SELECT id FROM accounts WHERE status = "farming"').all() as any[];
    for (const account of accounts) {
      await pointClaimingService.watchAndClaim(account.id);
    }
  } catch (error) {
    console.error('Error in scheduled point claim:', error);
  }
});

// Drop scraping every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('[SYSTEM] Scraping drop campaigns...');
  try {
    await dropScrapingService.scrapeDropCampaigns();
  } catch (error) {
    console.error('Error scraping drops:', error);
  }
});

// Log cleanup daily at midnight
cron.schedule('0 0 * * *', () => {
  console.log('[SYSTEM] Running daily log cleanup...');
  try {
    db.prepare(`DELETE FROM logs WHERE time < datetime('now', '-30 days')`).run();
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
