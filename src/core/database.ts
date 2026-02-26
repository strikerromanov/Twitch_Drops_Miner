import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Database singleton class for managing SQLite connection
 * Provides migration system and typed query builders
 */
class DatabaseManager {
  private static instance: Database.Database | null = null;
  private static readonly DB_PATH = path.join(process.cwd(), 'data', 'farm.db');
  private static readonly CURRENT_VERSION = 1;

  /**
   * Get or create database connection (singleton pattern)
   */
  static getConnection(): Database.Database {
    if (!this.instance) {
      // Ensure data directory exists
      const dataDir = path.dirname(this.DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.instance = new Database(this.DB_PATH);
      this.instance.pragma('journal_mode = WAL');
      this.instance.pragma('foreign_keys = ON');
      
      // Run migrations
      this.runMigrations();
    }
    return this.instance;
  }

  /**
   * Run database migrations to ensure schema is up to date
   */
  private static runMigrations(): void {
    const db = this.getConnection();

    // Create migrations table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Get current version
    const result = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as { version: number | null };
    const currentVersion = result?.version ?? 0;

    if (currentVersion < this.CURRENT_VERSION) {
      console.log(`Running migrations from v${currentVersion} to v${this.CURRENT_VERSION}`);
      
      // Create all tables if not exists (initial schema)
      if (currentVersion === 0) {
        this.createInitialSchema(db);
      }

      // Update version
      db.prepare('INSERT OR REPLACE INTO schema_migrations (version) VALUES (?)').run(this.CURRENT_VERSION);
      console.log('Migrations completed successfully');
    }
  }

  /**
   * Create initial database schema
   */
  private static createInitialSchema(db: Database.Database): void {
    // Accounts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        access_token TEXT,
        refresh_token TEXT,
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

    // Logs table
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
    db.exec('CREATE INDEX IF NOT EXISTS idx_logs_time ON logs(time DESC)');

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
        last_updated TEXT DEFAULT (datetime('now'))
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
        started_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Stream allocations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS stream_allocations (
        account_id INTEGER,
        streamer TEXT,
        assigned_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (account_id, streamer)
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
        bets INTEGER DEFAULT 0
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_followed_account_streamer ON followed_channels(account_id, streamer)');

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
    db.exec('CREATE INDEX IF NOT EXISTS idx_betting_streamer ON betting_stats(streamer)');

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
        strategy TEXT
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
        bonus_type TEXT
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_claim_history_account_time ON point_claim_history(account_id, claimed_at DESC)');

    // TMI chat status table
    db.exec(`
      CREATE TABLE IF NOT EXISTS tmi_chat_status (
        account_id INTEGER PRIMARY KEY,
        connected INTEGER DEFAULT 0,
        channel TEXT,
        last_connected TEXT
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
  }

  /**
   * Close database connection
   */
  static close(): void {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
    }
  }
}

/**
 * Get database connection
 */
export function getDb(): Database.Database {
  return DatabaseManager.getConnection();
}

/**
 * Close database connection
 */
export function closeDb(): void {
  DatabaseManager.close();
}

/**
 * Query builders for common operations
 */
export const Queries = {
  // Accounts
  getAccounts: () => getDb().prepare('SELECT * FROM accounts'),
  getAccountById: (id: number) => getDb().prepare('SELECT * FROM accounts WHERE id = ?'),
  insertAccount: () => getDb().prepare('INSERT INTO accounts (username, access_token, refresh_token, user_id) VALUES (?, ?, ?, ?)'),
  updateAccount: () => getDb().prepare('UPDATE accounts SET status = ?, lastActive = ?, access_token = ? WHERE id = ?'),
  
  // Settings
  getSetting: (key: string) => getDb().prepare('SELECT value FROM settings WHERE key = ?'),
  setSetting: () => getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'),
  getAllSettings: () => getDb().prepare('SELECT * FROM settings'),
  
  // Logs
  insertLog: () => getDb().prepare('INSERT INTO logs (level, message, streamer_id, type) VALUES (?, ?, ?, ?)'),
  getLogs: (limit: number) => getDb().prepare('SELECT * FROM logs ORDER BY time DESC LIMIT ?'),
  
  // Drop campaigns
  getActiveCampaigns: () => getDb().prepare("SELECT * FROM drop_campaigns WHERE status = 'active'"),
  upsertCampaign: () => getDb().prepare(`
    INSERT OR REPLACE INTO drop_campaigns (id, name, game, required_minutes, current_minutes, status, image_url, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  // Drop progress
  getDropProgress: (accountId: number, campaignId: string) => 
    getDb().prepare('SELECT * FROM drop_progress WHERE account_id = ? AND campaign_id = ?'),
  upsertDropProgress: () => getDb().prepare(`
    INSERT INTO drop_progress (account_id, campaign_id, current_minutes, last_updated)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(account_id, campaign_id) DO UPDATE SET
      current_minutes = excluded.current_minutes,
      last_updated = excluded.last_updated
  `),
  
  // Active streams
  getActiveStreams: () => getDb().prepare('SELECT * FROM active_streams'),
  insertActiveStream: () => getDb().prepare(`
    INSERT INTO active_streams (account_id, streamer, game, viewer_count, started_at)
    VALUES (?, ?, ?, ?, ?)
  `),
  deleteActiveStream: () => getDb().prepare('DELETE FROM active_streams WHERE account_id = ?'),
  
  // Betting
  getBettingStats: (streamer: string) => getDb().prepare('SELECT * FROM betting_stats WHERE streamer = ?'),
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
  `)
};
