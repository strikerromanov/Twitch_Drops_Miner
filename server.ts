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
console.log('Running database migrations...');
try {
  const columnCheck = db.prepare("PRAGMA table_info(followed_channels)").all();
  const hasViewerCount = columnCheck.some((col: any) => col.name === 'viewer_count');
  
  if (!hasViewerCount) {
    console.log('🔧 Adding viewer_count column to followed_channels...');
    db.prepare('ALTER TABLE followed_channels ADD COLUMN viewer_count INTEGER DEFAULT 0').run();
    console.log('✅ Migration: viewer_count column added');
  } else {
    console.log('✅ viewer_count column already exists

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
  }');
  }
  
  db.prepare('UPDATE followed_channels SET viewer_count = 0 WHERE viewer_count IS NULL').run();
} catch (error: any) {
  console.log('Migration check completed:', error.message);
}

  // Check if accounts has user_id column
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
      const { default: Dropboxer } = await import('./drop-indexer.js');
      const { default: ChatFarmingService } = await import('./chat-farming.js');
      const { default: FollowedChannelsIndexer } = await import('./followed-channels-indexer.js');
      
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


