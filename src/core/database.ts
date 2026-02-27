import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Query cache entry for performance optimization
 */
interface CacheEntry {
  data: any[];
  timestamp: number;
}

/**
 * Database singleton class with connection pooling and caching
 */
class DatabaseManager {
  private static instance: Database.Database | null = null;
  private static readonly DB_PATH = path.join(process.cwd(), 'data', 'farm.db');
  private static readonly CURRENT_VERSION = 3; // Bumped for performance indexes
  
  // Query result caching
  private static queryCache: Map<string, CacheEntry> = new Map();
  private static readonly CACHE_TTL = 30000; // 30 seconds

  /**
   * Get or create database connection with optimized settings
   */
  static getConnection(): Database.Database {
    if (!this.instance) {
      const dataDir = path.dirname(this.DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.instance = new Database(this.DB_PATH, {
        verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
      });
      
      // Performance optimizations
      this.instance.pragma('journal_mode = WAL');
      this.instance.pragma('foreign_keys = ON');
      this.instance.pragma('synchronous = NORMAL');
      this.instance.pragma('cache_size = -64000'); // 64MB cache
      this.instance.pragma('temp_store = MEMORY');
      this.instance.pragma('mmap_size = 30000000000');
      this.instance.pragma('page_size = 4096');
      
      this.runMigrations();
    }
    return this.instance;
  }

  /**
   * Run database migrations and performance indexes
   */
  private static runMigrations(): void {
    const db = this.getConnection();

    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT DEFAULT (datetime('now'))
      )
    `);

    const result = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as { version: number | null };
    const currentVersion = result?.version ?? 0;

    if (currentVersion < this.CURRENT_VERSION) {
      console.log(`Running migrations from v${currentVersion} to v${this.CURRENT_VERSION}`);
      
      if (currentVersion === 0) {
        this.createInitialSchema(db);
      }

      if (currentVersion === 1) {
        this.migrateToV2(db);
      }

      if (currentVersion <= 2) {
        this.migrateToV3(db);
      }

      db.prepare('INSERT OR REPLACE INTO schema_migrations (version) VALUES (?)').run(this.CURRENT_VERSION);
      console.log('Migrations completed successfully');
    }
  }

  /**
   * Migration v2 -> v3: Add performance indexes
   */
  private static migrateToV3(db: Database.Database): void {
    console.log('Running migration v2 -> v3: Adding performance indexes');
    
    // Accounts indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);');
    
    // Campaign indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_campaigns_status ON drop_campaigns(status);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_campaigns_game ON drop_campaigns(game);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_campaigns_last_updated ON drop_campaigns(last_updated);');
    
    // Drop progress indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_drop_progress_account ON drop_progress(account_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_drop_progress_campaign ON drop_progress(campaign_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_drop_progress_account_campaign ON drop_progress(account_id, campaign_id);');
    
    // Followed channels indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_followed_status ON followed_channels(status);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_followed_game ON followed_channels(game_name);');
    
    // Point claim history indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_claim_history_account ON point_claim_history(account_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_claim_history_time ON point_claim_history(claimed_at DESC);');
    
    // Active streams indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_active_streams_account ON active_streams(account_id);');
    
    console.log('Performance indexes created successfully');
  }

  /**
   * Migration v1 -> v2: Add OAuth token expiration support
   */
  private static migrateToV2(db: Database.Database): void {
    console.log('Running migration v1 -> v2: Adding OAuth token expiration support');
    
    try {
      db.exec('ALTER TABLE accounts ADD COLUMN token_expires_at INTEGER;');
      console.log('Added token_expires_at column to accounts table');
    } catch (error: any) {
      if (error.message.includes('duplicate column name')) {
        console.log('Column token_expires_at already exists, skipping...');
      } else {
        throw error;
      }
    }
  }

  /**
   * Create initial database schema with optimized structure
   */
  private static createInitialSchema(db: Database.Database): void {
    // Accounts table with OAuth support
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at INTEGER,
        status TEXT DEFAULT 'idle',
        createdAt TEXT DEFAULT (datetime('now')),
        lastActive TEXT,
        user_id TEXT
      )
    `);

    // Settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    // Logs table with optimized indexes
    db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        time TEXT DEFAULT (datetime('now')),
        level TEXT,
        message TEXT,
        streamer_id INTEGER,
        type TEXT
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_logs_time ON logs(time DESC);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);');

    // Drop campaigns table
    db.exec(`
      CREATE TABLE IF NOT EXISTS drop_campaigns (
        id TEXT PRIMARY KEY,
        name TEXT,
        game TEXT,
        required_minutes INTEGER,
        current_minutes INTEGER DEFAULT 0,
        status TEXT,
        image_url TEXT,
        last_updated TEXT
      )
    `);

    // Drop progress table
    db.exec(`
      CREATE TABLE IF NOT EXISTS drop_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        campaign_id TEXT,
        current_minutes INTEGER DEFAULT 0,
        last_updated TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES drop_campaigns(id) ON DELETE CASCADE,
        UNIQUE(account_id, campaign_id)
      )
    `);

    // Active streams table
    db.exec(`
      CREATE TABLE IF NOT EXISTS active_streams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        streamer TEXT,
        game TEXT,
        viewer_count INTEGER DEFAULT 0,
        started_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    // Stream allocations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS stream_allocations (
        account_id INTEGER,
        streamer TEXT,
        assigned_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (account_id, streamer),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    // Followed channels table
    db.exec(`
      CREATE TABLE IF NOT EXISTS followed_channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        streamer TEXT,
        streamer_id TEXT,
        status TEXT,
        game_name TEXT,
        viewer_count INTEGER DEFAULT 0,
        points INTEGER DEFAULT 0,
        bets INTEGER DEFAULT 0,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_followed_account_streamer ON followed_channels(account_id, streamer);');

    // Betting stats table
    db.exec(`
      CREATE TABLE IF NOT EXISTS betting_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        streamer TEXT,
        totalBets INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        totalProfit INTEGER DEFAULT 0,
        avgOdds REAL DEFAULT 1.0,
        UNIQUE(streamer)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_betting_streamer ON betting_stats(streamer);');

    // Betting history table
    db.exec(`
      CREATE TABLE IF NOT EXISTS betting_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        streamer TEXT,
        amount INTEGER,
        outcome TEXT,
        profit INTEGER,
        bet_time TEXT,
        strategy TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    // Games table
    db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        activeCampaigns INTEGER,
        whitelisted INTEGER,
        lastDrop TEXT
      )
    `);

    // Point claim history table
    db.exec(`
      CREATE TABLE IF NOT EXISTS point_claim_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        streamer TEXT,
        points_claimed INTEGER,
        claimed_at TEXT,
        bonus_type TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    // TMI chat status table
    db.exec(`
      CREATE TABLE IF NOT EXISTS tmi_chat_status (
        account_id INTEGER PRIMARY KEY,
        connected INTEGER DEFAULT 0,
        channel TEXT,
        last_connected TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    // Insert default settings
    const defaultSettings = [
      ['drop_check_interval', '300000'],
      ['point_claim_interval', '60000'],
      ['chat_farming_interval', '30000'],
      ['max_concurrent_streams', '3'],
      ['enable_drops', 'true'],
      ['enable_betting', 'true'],
      ['enable_chat_farming', 'true']
    ];

    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    const insertMany = db.transaction((settings) => {
      for (const [key, value] of settings) {
        insertSetting.run(key, value);
      }
    });
    insertMany(defaultSettings);
    
    // Run performance indexes migration after initial schema
    this.migrateToV3(db);
  }

  /**
   * Get cached query result or execute and cache
   */
  static cachedQuery<T>(key: string, queryFn: () => T): T {
    const cached = this.queryCache.get(key);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.data as T;
    }
    
    const result = queryFn();
    this.queryCache.set(key, {
      data: result as any[],
      timestamp: now
    });
    
    // Clean old cache entries periodically
    if (this.queryCache.size > 100) {
      this.cleanCache();
    }
    
    return result;
  }

  /**
   * Clean expired cache entries
   */
  private static cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.queryCache.entries()) {
      if ((now - entry.timestamp) > this.CACHE_TTL) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Clear query cache
   */
  static clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Close database connection
   */
  static close(): void {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
    }
    this.queryCache.clear();
  }
}

export function getDb(): Database.Database {
  return DatabaseManager.getConnection();
}

export function closeDb(): void {
  DatabaseManager.close();
}

export function clearCache(): void {
  DatabaseManager.clearCache();
}

/**
 * Optimized query builders with caching support
 */
export const Queries = {
  // Accounts - with indexes
  getAccounts: () => getDb().prepare('SELECT * FROM accounts'),
  getActiveAccounts: () => getDb().prepare("SELECT * FROM accounts WHERE status = 'active'"),
  getAccountById: (id: number) => getDb().prepare('SELECT * FROM accounts WHERE id = ?'),
  getAccountByUserId: (userId: string) => getDb().prepare('SELECT * FROM accounts WHERE user_id = ?'),
  insertAccount: () => getDb().prepare('INSERT INTO accounts (username, access_token, refresh_token, user_id, token_expires_at) VALUES (?, ?, ?, ?, ?)'),
  updateAccount: () => getDb().prepare('UPDATE accounts SET status = ?, lastActive = ?, access_token = ?, refresh_token = ?, token_expires_at = ? WHERE id = ?'),
  
  // Settings
  getSetting: (key: string) => getDb().prepare('SELECT value FROM settings WHERE key = ?'),
  setSetting: () => getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'),
  getAllSettings: () => getDb().prepare('SELECT * FROM settings'),
  
  // Logs - optimized query
  getLogs: (limit: number) => getDb().prepare('SELECT * FROM logs ORDER BY time DESC LIMIT ?'),
  getLogsByLevel: (level: string, limit: number) => 
    getDb().prepare('SELECT * FROM logs WHERE level = ? ORDER BY time DESC LIMIT ?'),
  insertLog: () => getDb().prepare('INSERT INTO logs (level, message, streamer_id, type) VALUES (?, ?, ?, ?)'),
  
  // Drop campaigns - optimized with indexes
  getActiveCampaigns: () => getDb().prepare("SELECT * FROM drop_campaigns WHERE status = 'active'"),
  getCampaignsByGame: (game: string) => getDb().prepare('SELECT * FROM drop_campaigns WHERE game = ? AND status = \'active\''),
  upsertCampaign: () => getDb().prepare(`
    INSERT OR REPLACE INTO drop_campaigns (id, name, game, required_minutes, current_minutes, status, image_url, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  // Drop progress - optimized JOIN queries
  getDropProgress: (accountId: number, campaignId: string) =>
    getDb().prepare('SELECT * FROM drop_progress WHERE account_id = ? AND campaign_id = ?'),
  
  getAllProgressForAccount: (accountId: number) =>
    getDb().prepare(`
      SELECT dp.*, dc.name as campaign_name, dc.required_minutes
      FROM drop_progress dp
      JOIN drop_campaigns dc ON dp.campaign_id = dc.id
      WHERE dp.account_id = ?
    `),
  
  upsertDropProgress: () => getDb().prepare(`
    INSERT INTO drop_progress (account_id, campaign_id, current_minutes, last_updated)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(account_id, campaign_id) DO UPDATE SET
      current_minutes = excluded.current_minutes,
      last_updated = excluded.last_updated
  `),
  
  // Active streams
  getActiveStreams: () => getDb().prepare('SELECT * FROM active_streams'),
  getActiveStreamsForAccount: (accountId: number) =>
    getDb().prepare('SELECT * FROM active_streams WHERE account_id = ?'),
  insertActiveStream: () => getDb().prepare(`
    INSERT INTO active_streams (account_id, streamer, game, viewer_count, started_at)
    VALUES (?, ?, ?, ?, ?)
  `),
  deleteActiveStream: () => getDb().prepare('DELETE FROM active_streams WHERE account_id = ?'),
  
  // Betting - optimized queries
  getBettingStats: (streamer: string) => getDb().prepare('SELECT * FROM betting_stats WHERE streamer = ?'),
  getAllBettingStats: () => getDb().prepare('SELECT * FROM betting_stats ORDER BY totalProfit DESC'),
  upsertBettingStats: () => getDb().prepare(`
    INSERT INTO betting_stats (streamer, totalBets, wins, totalProfit, avgOdds)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(streamer) DO UPDATE SET
      totalBets = totalBets + excluded.totalBets,
      wins = wins + excluded.wins,
      totalProfit = totalProfit + excluded.totalProfit
  `),
  insertBettingHistory: () => getDb().prepare(`
    INSERT INTO betting_history (account_id, streamer, amount, outcome, profit, bet_time, strategy)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  getBettingHistory: (limit: number) => getDb().prepare(`
    SELECT * FROM betting_history ORDER BY bet_time DESC LIMIT ?
  `),
  getBettingHistoryForAccount: (accountId: number, limit: number) => getDb().prepare(`
    SELECT * FROM betting_history WHERE account_id = ? ORDER BY bet_time DESC LIMIT ?
  `)
};
