import path from 'path';
import Database from 'better-sqlite3';
import * as fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'twitch_drops_miner.db');
let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    initializeDatabase();
  }
  return dbInstance;
}

function initializeDatabase() {
  const db = getDb();
  
  // Accounts table
  db.exec(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    status TEXT DEFAULT 'farming',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Campaigns table
  db.exec(`CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    game TEXT,
    status TEXT DEFAULT 'active',
    start_time DATETIME,
    end_time DATETIME,
    required_minutes INTEGER,
    current_minutes INTEGER DEFAULT 0,
    last_claimed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Drop progress table
  db.exec(`CREATE TABLE IF NOT EXISTS drop_progress (
    account_id INTEGER NOT NULL,
    campaign_id TEXT NOT NULL,
    minutes INTEGER DEFAULT 0,
    last_claimed_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (account_id, campaign_id),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  )`);
  
  // Logs table
  db.exec(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Settings table
  db.exec(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);
  
  // Followed channels table
  db.exec(`CREATE TABLE IF NOT EXISTS followed_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    channel_id TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    followed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  )`);
  
  // Create indexes
  db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_followed_channels_account ON followed_channels(account_id)');
}

// Export direct callable functions
export const Queries = {
  getAccountByUserId: (userId: string) => {
    return getDb().prepare('SELECT * FROM accounts WHERE user_id = ?').get(userId);
  },
  getAllAccounts: () => {
    return getDb().prepare('SELECT * FROM accounts ORDER BY created_at DESC').all();
  },
  insertLog: (level: string, message: string) => {
    return getDb().prepare('INSERT INTO logs (level, message) VALUES (?, ?)').run(level, message);
  },
  getRecentLogs: (limit: number = 50) => {
    return getDb().prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?').all(limit);
  },
  getSettings: () => {
    const settings = getDb().prepare('SELECT * FROM settings').all();
    return settings.reduce((acc: any, s: any) => { acc[s.key] = s.value; return acc; }, {});
  },
  upsertSetting: (key: string, value: string) => {
    return getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  },
  getAllCampaigns: () => {
    return getDb().prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
  },
  getActiveCampaigns: () => {
    return getDb().prepare('SELECT * FROM campaigns WHERE status = ?').all('active');
  },
  getCampaignById: (campaignId: string) => {
    return getDb().prepare('SELECT * FROM campaigns WHERE campaign_id = ?').get(campaignId);
  },
  upsertCampaign: (data: any) => {
    const stmt = getDb().prepare(`
      INSERT INTO campaigns (campaign_id, name, game, status, start_time, end_time, required_minutes, current_minutes, last_claimed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(campaign_id) DO UPDATE SET
        name = excluded.name,
        game = excluded.game,
        status = excluded.status,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        required_minutes = excluded.required_minutes,
        current_minutes = excluded.current_minutes,
        last_claimed_at = excluded.last_claimed_at
    `);
    return stmt.run(data.campaign_id, data.name, data.game || null, data.status || 'active', data.start_time || null, data.end_time || null, data.required_minutes || 0, data.current_minutes || 0, data.last_claimed_at || null);
  },
  getDropProgress: (accountId: number, campaignId: string) => {
    return getDb().prepare('SELECT * FROM drop_progress WHERE account_id = ? AND campaign_id = ?').get(accountId, campaignId);
  },
  getAllDropProgress: (accountId: number) => {
    return getDb().prepare('SELECT * FROM drop_progress WHERE account_id = ?').all(accountId);
  },
  upsertDropProgress: (accountId: number, campaignId: string, minutes: number, lastClaimedAt: string | null) => {
    const stmt = getDb().prepare(`
      INSERT INTO drop_progress (account_id, campaign_id, minutes, last_claimed_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(account_id, campaign_id) DO UPDATE SET
        minutes = excluded.minutes,
        last_claimed_at = excluded.last_claimed_at
    `);
    return stmt.run(accountId, campaignId, minutes, lastClaimedAt);
  },
  getFarmingAccounts: () => {
    return getDb().prepare('SELECT * FROM accounts WHERE status = ?').all('farming');
  },
  upsertAccount: (data: any) => {
    const stmt = getDb().prepare(`
      INSERT INTO accounts (user_id, username, access_token, refresh_token, expires_at, status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        username = excluded.username,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        status = excluded.status
    `);
    return stmt.run(data.user_id, data.username, data.access_token, data.refresh_token, data.expires_at, data.status || 'farming');
  },
  updateAccountStatus: (status: string, id: number) => {
    return getDb().prepare('UPDATE accounts SET status = ? WHERE id = ?').run(status, id);
  },
  getAccountById: (id: number) => {
    return getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  }
,  deleteAccount: (id: string) => {
    return getDb().prepare('DELETE FROM accounts WHERE id = ?').run(id);
  }};

export default getDb;
