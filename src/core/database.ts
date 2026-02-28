import Database from 'better-sqlite3';
import { logError } from './logger';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(process.env.DATABASE_PATH || '/app/data/twitch.db');
    db.pragma('journal_mode = WAL');
    initializeDatabase();
  }
  return db;
}

function initializeDatabase() {
  const database = getDb();
  database.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      status TEXT DEFAULT 'farming'
    );
    CREATE TABLE IF NOT EXISTS drop_campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      game TEXT,
      status TEXT DEFAULT 'active',
      started_at TEXT,
      ends_at TEXT
    );
    CREATE TABLE IF NOT EXISTS drop_progress (
      account_id INTEGER NOT NULL,
      campaign_id TEXT NOT NULL,
      current_minutes INTEGER DEFAULT 0,
      required_minutes INTEGER DEFAULT 0,
      last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id, campaign_id),
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (campaign_id) REFERENCES drop_campaigns(id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS active_streams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      streamer TEXT NOT NULL UNIQUE,
      game TEXT,
      viewers INTEGER DEFAULT 0,
      drops_enabled INTEGER DEFAULT 0,
      last_checked DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS stream_allocations (
      account_id INTEGER NOT NULL,
      streamer TEXT NOT NULL,
      allocated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id, streamer),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS followed_channels (
      account_id INTEGER NOT NULL,
      channel_id TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      viewer_count INTEGER DEFAULT 0,
      points INTEGER DEFAULT 0,
      bets INTEGER DEFAULT 0,
      online INTEGER DEFAULT 0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id, channel_id),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS betting_stats (
      account_id INTEGER PRIMARY KEY,
      total_bets INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      points_won INTEGER DEFAULT 0,
      points_lost INTEGER DEFAULT 0,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS betting_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      prediction_id TEXT NOT NULL,
      outcome_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      drops_enabled INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS point_claim_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      streamer TEXT NOT NULL,
      points INTEGER NOT NULL,
      claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS tmi_chat_status (
      account_id INTEGER PRIMARY KEY,
      connected INTEGER DEFAULT 0,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      messages_sent INTEGER DEFAULT 0,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  logError('Database initialized');
}

export const Queries = {
  // Accounts
  getAccountByUserId: (userId: string) => {
    return getDb().prepare('SELECT * FROM accounts WHERE user_id = ?').get(userId);
  },
  getAllAccounts: () => {
    return getDb().prepare('SELECT * FROM accounts').all();
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
  },
  deleteAccount: (id: string) => {
    return getDb().prepare('DELETE FROM accounts WHERE id = ?').run(id);
  },
  // Campaigns
  getAllCampaigns: () => {
    return getDb().prepare('SELECT * FROM drop_campaigns').all();
  },
  upsertCampaign: (data: any) => {
    const stmt = getDb().prepare(`
      INSERT INTO drop_campaigns (id, name, game, status, started_at, ends_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        game = excluded.game,
        status = excluded.status,
        started_at = excluded.started_at,
        ends_at = excluded.ends_at
    `);
    return stmt.run(data.id, data.name, data.game, data.status, data.started_at, data.ends_at);
  },
  // Drop Progress
  getDropProgress: (accountId: number, campaignId: string) => {
    return getDb().prepare('SELECT * FROM drop_progress WHERE account_id = ? AND campaign_id = ?').get(accountId, campaignId);
  },
  upsertDropProgress: (accountId: number, campaignId: string, currentMinutes: number, requiredMinutes: number) => {
    const stmt = getDb().prepare(`
      INSERT INTO drop_progress (account_id, campaign_id, current_minutes, required_minutes)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(account_id, campaign_id) DO UPDATE SET
        current_minutes = excluded.current_minutes,
        required_minutes = excluded.required_minutes,
        last_updated = CURRENT_TIMESTAMP
    `);
    return stmt.run(accountId, campaignId, currentMinutes, requiredMinutes);
  },
  // Logs
  insertLog: (level: string, message: string) => {
    return getDb().prepare('INSERT INTO logs (level, message) VALUES (?, ?)').run(level, message);
  },
  getRecentLogs: (limit: number = 100) => {
    return getDb().prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?').all(limit);
  },
  // Settings
  getSettings: () => {
    const settings = getDb().prepare('SELECT * FROM settings').all();
    const result: any = {};
    settings.forEach((s: any) => result[s.key] = s.value);
    return result;
  },
  upsertSetting: (key: string, value: string) => {
    return getDb().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  },
  // Stats
  getStats: () => {
    const db = getDb();
    return {
      accounts: db.prepare('SELECT COUNT(*) as count FROM accounts').get(),
      campaigns: db.prepare('SELECT COUNT(*) as count FROM drop_campaigns').get(),
      logs: db.prepare('SELECT COUNT(*) as count FROM logs').get()
    };
  },
  // Active Streams
  getActiveStreams: () => {
    return getDb().prepare('SELECT * FROM active_streams').all();
  },
  upsertActiveStream: (streamer: string, game: string | null, viewers: number, dropsEnabled: number) => {
    const stmt = getDb().prepare(`
      INSERT INTO active_streams (streamer, game, viewers, drops_enabled)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(streamer) DO UPDATE SET
        game = excluded.game,
        viewers = excluded.viewers,
        drops_enabled = excluded.drops_enabled,
        last_checked = CURRENT_TIMESTAMP
    `);
    return stmt.run(streamer, game, viewers, dropsEnabled);
  },
  // Stream Allocations
  getStreamAllocations: (accountId: number) => {
    return getDb().prepare('SELECT * FROM stream_allocations WHERE account_id = ?').all(accountId);
  },
  allocateStream: (accountId: number, streamer: string) => {
    return getDb().prepare('INSERT OR IGNORE INTO stream_allocations (account_id, streamer) VALUES (?, ?)').run(accountId, streamer);
  },
  deallocateStream: (accountId: number, streamer: string) => {
    return getDb().prepare('DELETE FROM stream_allocations WHERE account_id = ? AND streamer = ?').run(accountId, streamer);
  },
  // Followed Channels
  getFollowedChannels: (accountId: number) => {
    return getDb().prepare('SELECT * FROM followed_channels WHERE account_id = ?').all(accountId);
  },
  upsertFollowedChannel: (accountId: number, channelId: string, channelName: string, viewerCount: number, points: number, bets: number, online: number) => {
    const stmt = getDb().prepare(`
      INSERT INTO followed_channels (account_id, channel_id, channel_name, viewer_count, points, bets, online)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, channel_id) DO UPDATE SET
        channel_name = excluded.channel_name,
        viewer_count = excluded.viewer_count,
        points = excluded.points,
        bets = excluded.bets,
        online = excluded.online,
        last_updated = CURRENT_TIMESTAMP
    `);
    return stmt.run(accountId, channelId, channelName, viewerCount, points, bets, online);
  },
  // Betting Stats
  getBettingStats: (accountId: number) => {
    return getDb().prepare('SELECT * FROM betting_stats WHERE account_id = ?').get(accountId);
  },
  upsertBettingStats: (accountId: number, totalBets: number, wins: number, losses: number, pointsWon: number, pointsLost: number) => {
    const stmt = getDb().prepare(`
      INSERT INTO betting_stats (account_id, total_bets, wins, losses, points_won, points_lost)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        total_bets = excluded.total_bets,
        wins = excluded.wins,
        losses = excluded.losses,
        points_won = excluded.points_won,
        points_lost = excluded.points_lost
    `);
    return stmt.run(accountId, totalBets, wins, losses, pointsWon, pointsLost);
  },
  // Point Claim History
  getPointClaimHistory: (accountId: number, limit: number = 100) => {
    return getDb().prepare('SELECT * FROM point_claim_history WHERE account_id = ? ORDER BY claimed_at DESC LIMIT ?').all(accountId, limit);
  },
  insertPointClaim: (accountId: number, streamer: string, points: number) => {
    return getDb().prepare('INSERT INTO point_claim_history (account_id, streamer, points) VALUES (?, ?, ?)').run(accountId, streamer, points);
  }
};

export default getDb;
