import express from "express";
import { createServer } from "http";
import { PointClaimingService } from "./point-claiming.js";
import { DropScrapingService } from "./drop-scraping.js";
import { WebSocketService } from "./websocket-server.js";
import { MultiAccountCoordinator } from "./multi-account-coordinator.js";
import { BackupService } from "./backup-service.js";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import cron from "node-cron";
import tmi from "tmi.js";

// --- TYPES & INTERFACES ---
interface Account {
  id: number;
  username: string;
  twitch_id: string;
  status: string;
  currentTarget: string;
  points: number;
  accessToken: string;
  refreshToken: string;
}

interface FollowedChannel {
  id: number;
  account_id: number;
  streamer: string;
  streamer_id: string;
  status: string;
  game_name: string;
  viewer_count: number;
  points: number;
  bets: number;
}

interface StreamerStats {
  streamer: string;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  avgBetAmount: number;
  netProfit: number;
  riskLevel: 'low' | 'medium' | 'high';
}

// --- GLOBAL STATE ---
let db: Database.Database;
const activeChatClients = new Map<number, tmi.Client>();
const bettingStats = new Map<string, StreamerStats>();

// --- MODULE SERVICES ---
let pointClaimingService: PointClaimingService | null = null;
let dropScrapingService: DropScrapingService | null = null;
let wsService: WebSocketService | null = null;
let accountCoordinator: MultiAccountCoordinator | null = null;
let backupService: BackupService | null = null;


// --- MODULE SERVICES ---\

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(path.join(dataDir, 'farm.db'));
  db.pragma('journal_mode = WAL');

  // --- ENHANCED DATABASE SCHEMA ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      twitch_id TEXT,
      status TEXT,
      currentTarget TEXT,
      points INTEGER DEFAULT 0,
      accessToken TEXT,
      refreshToken TEXT
    );
    
    CREATE TABLE IF NOT EXISTS bet_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      streamer TEXT,
      winRate REAL,
      totalBets INTEGER,
      riskLevel TEXT,
      recommendedStrategy TEXT
    );
    
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT,
      type TEXT,
      message TEXT,
      account_id INTEGER,
      streamer TEXT
    );
    
    CREATE TABLE IF NOT EXISTS favorite_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      streamer TEXT
    );
    
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game TEXT,
      name TEXT,
      streamer TEXT,
      progress INTEGER DEFAULT 0,
      status TEXT,
      timeRemaining TEXT
    );
    
    CREATE TABLE IF NOT EXISTS active_streams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      streamer TEXT,
      type TEXT
    );
    
    CREATE TABLE IF NOT EXISTS followed_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      streamer TEXT,
      streamer_id TEXT,
      status TEXT,
      game_name TEXT,
      viewer_count INTEGER,
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
      account_id INTEGER,
      bet_amount INTEGER,
      outcome TEXT,
      bet_type TEXT,
      strategy TEXT,
      placed_at TEXT,
      result_amount INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS drop_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      campaign_id TEXT,
      campaign_name TEXT,
      progress_minutes INTEGER,
      required_minutes INTEGER,
      status TEXT,
      last_updated TEXT
    );
  `);

  try { db.exec('ALTER TABLE accounts ADD COLUMN twitch_id TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE followed_channels ADD COLUMN streamer_id TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE followed_channels ADD COLUMN game_name TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE followed_channels ADD COLUMN viewer_count INTEGER'); } catch(e) {}
  try { db.exec('ALTER TABLE logs ADD COLUMN account_id INTEGER'); } catch(e) {}
  try { db.exec('ALTER TABLE logs ADD COLUMN streamer TEXT'); } catch(e) {}

  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('concurrentStreams', '10')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('pointClaimInterval', '300')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('bettingEnabled', 'false')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('maxBetPercentage', '5')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('dropAllocation', '20')").run();

  // --- MODULE INITIALIZATION ---
  console.log('Initializing enhanced services...');
  const dbPath = path.join(dataDir, 'farm.db');

  // Initialize Point Claiming Service (Playwright)
  pointClaimingService = new PointClaimingService(dbPath);
  await pointClaimingService.initialize();
  console.log('✓ Point Claiming Service initialized');

  // Initialize Drop Scraping Service
  dropScrapingService = new DropScrapingService(dbPath);
  await dropScrapingService.initialize();
  console.log('✓ Drop Scraping Service initialized');

  // Initialize Backup Service
  const backupDir = path.join(dataDir, 'backups');
  backupService = new BackupService(dbPath, backupDir);
  backupService.startAutomatedBackups(0, 0); // Daily at midnight
  console.log('✓ Backup Service initialized');

  // Initialize Multi-Account Coordinator
  accountCoordinator = new MultiAccountCoordinator(dbPath);
  accountCoordinator.startPeriodicCleanup();
  console.log('✓ Multi-Account Coordinator initialized');


  loadBettingStats();

  // --- HELPER FUNCTIONS ---
  function log(message: string, type: string = 'system', accountId?: number, streamer?: string) {
    const stmt = db.prepare('INSERT INTO logs (time, type, message, account_id, streamer) VALUES (?, ?, ?, ?, ?)');
    stmt.run(new Date().toISOString(), type, message, accountId || null, streamer || null);
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  function loadBettingStats() {
    const stats = db.prepare('SELECT * FROM betting_stats').all() as any[];
    const streamerMap = new Map<string, StreamerStats>();
    
    stats.forEach(stat => {
      if (!streamerMap.has(stat.streamer)) {
        streamerMap.set(stat.streamer, {
          streamer: stat.streamer,
          totalBets: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          avgBetAmount: 0,
          netProfit: 0,
          riskLevel: 'medium'
        });
      }
      
      const s = streamerMap.get(stat.streamer)!;
      s.totalBets++;
      if (stat.outcome === 'win') s.wins++;
      else s.losses++;
      s.netProfit += stat.result_amount || 0;
    });
    
    streamerMap.forEach((stats, streamer) => {
      stats.winRate = stats.totalBets > 0 ? (stats.wins / stats.totalBets) * 100 : 0;
      stats.avgBetAmount = stats.totalBets > 0 ? Math.abs(stats.netProfit) / stats.totalBets : 0;
      
      if (stats.totalBets < 10) {
        stats.riskLevel = 'low';
      } else if (stats.winRate >= 55) {
        stats.riskLevel = 'low';
      } else if (stats.winRate >= 45) {
        stats.riskLevel = 'medium';
      } else {
        stats.riskLevel = 'high';
      }
      
      bettingStats.set(streamer, stats);
    });
  }

  function getBettingRecommendation(streamer: string, currentPoints: number) {
    const stats = bettingStats.get(streamer);
    const maxBetPercent = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'maxBetPercentage'").get()?.value || '5');
    
    if (!stats || stats.totalBets < 10) {
      return {
        shouldBet: currentPoints > 100,
        amount: Math.floor(currentPoints * 0.01),
        strategy: 'Conservative Sample',
        reason: 'Building sample size for analysis'
      };
    }
    
    if (stats.riskLevel === 'high' && stats.totalBets > 20) {
      return {
        shouldBet: false,
        amount: 0,
        strategy: 'Avoid',
        reason: `Poor performer: ${stats.winRate.toFixed(1)}% win rate`
      };
    }
    
    const winProb = stats.winRate / 100;
    const avgReturn = 1.9;
    const kellyPercent = ((winProb * avgReturn) - 1) / (avgReturn - 1);
    
    let betPercent = Math.min(Math.max(kellyPercent * 100, 1), maxBetPercent);
    
    if (stats.riskLevel === 'low') {
      betPercent = Math.min(betPercent * 1.5, maxBetPercent);
    }
    
    return {
      shouldBet: true,
      amount: Math.floor(currentPoints * (betPercent / 100)),
      strategy: `Kelly Criterion (${betPercent.toFixed(1)}%)`,
      reason: `${stats.winRate.toFixed(1)}% win rate, ${stats.totalBets} bets tracked`
    };
  }

  // --- TWITCH CHAT CONNECTION FOR POINT CLAIMING ---
  async function connectChatAccount(account: Account) {
    if (activeChatClients.has(account.id)) {
      return;
    }

    try {
      const client = new tmi.Client({
        identity: {
          username: account.username,
          password: `oauth:${account.accessToken}`
        },
        channels: []
      });

      await client.connect();
      activeChatClients.set(account.id, client);
      
      log(`Chat client connected for ${account.username}`, 'system', account.id);
      
      client.on('message', (channel, tags, message, self) => {
        if (self) return;
        
        if (message.includes('claimed a bonus') || message.includes('points')) {
          const points = parseInt(message.match(/\d+/)?.[0] || '0');
          if (points > 0) {
            const streamer = channel.replace('#', '');
            claimPoints(account.id, streamer, points, 'bonus');
          }
        }
      });
      
    } catch (error) {
      log(`Failed to connect chat for ${account.username}: ${error}`, 'error', account.id);
    }
  }

  async function disconnectChatAccount(accountId: number) {
    const client = activeChatClients.get(accountId);
    if (client) {
      try {
        await client.disconnect();
        activeChatClients.delete(accountId);
      } catch (error) {
        console.error(`Error disconnecting chat:`, error);
      }
    }
  }

  async function joinChannelForPoints(accountId: number, streamer: string) {
    const client = activeChatClients.get(accountId);
    if (client) {
      try {
        await client.join(streamer);
        log(`Joined ${streamer}'s chat for point farming`, 'system', accountId, streamer);
      } catch (error) {
        log(`Failed to join ${streamer}'s chat: ${error}`, 'error', accountId, streamer);
      }
    }
  }

  async function claimPoints(accountId: number, streamer: string, amount: number, bonusType: string = 'claim') {
    try {
      db.prepare('UPDATE accounts SET points = points + ? WHERE id = ?').run(amount, accountId);
      db.prepare('UPDATE followed_channels SET points = points + ? WHERE account_id = ? AND streamer = ?').run(amount, accountId, streamer);
      db.prepare('INSERT INTO point_claim_history (account_id, streamer, points_claimed, claimed_at, bonus_type) VALUES (?, ?, ?, ?, ?)').run(
        accountId, streamer, amount, new Date().toISOString(), bonusType
      );
      
      log(`Claimed ${amount} points from ${streamer}`, 'success', accountId, streamer);
    } catch (error) {
      log(`Failed to record point claim: ${error}`, 'error', accountId, streamer);
    }
  }

  // --- POINT CLAIMING ENGINE ---
  async function attemptPointClaims() {
    if (pointClaimingService) {
      await pointClaimingService.claimPointsForAllAccounts();
    }
  }

  // --- BETTING ENGINE ---
  async function processBets() {
    const bettingEnabled = db.prepare("SELECT value FROM settings WHERE key = 'bettingEnabled'").get()?.value === 'true';
    if (!bettingEnabled) return;
    
    const farmingAccounts = db.prepare("SELECT * FROM accounts WHERE status = 'farming'").all() as Account[];
    
    for (const account of farmingAccounts) {
      const activeStreams = db.prepare("SELECT * FROM active_streams WHERE account_id = ?").all(account.id) as any[];
      
      for (const stream of activeStreams) {
        const recommendation = getBettingRecommendation(stream.streamer, account.points);
        
        if (recommendation.shouldBet && recommendation.amount > 10) {
          const outcome = Math.random() > 0.5 ? 'win' : 'loss';
          const resultAmount = outcome === 'win' ? Math.floor(recommendation.amount * 1.9) : -recommendation.amount;
          
          db.prepare(`
            INSERT INTO betting_stats (streamer, account_id, bet_amount, outcome, bet_type, strategy, placed_at, result_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            stream.streamer, account.id, recommendation.amount, outcome, 'auto', recommendation.strategy,
            new Date().toISOString(), resultAmount
          );
          
          db.prepare('UPDATE accounts SET points = points + ? WHERE id = ?').run(resultAmount, account.id);
          
          log(
            `Bet ${recommendation.amount} on ${stream.streamer} - ${outcome.toUpperCase()} (${recommendation.strategy}) - ${recommendation.reason}`,
            outcome === 'win' ? 'success' : 'warning', account.id, stream.streamer
          );
          
          loadBettingStats();
        }
      }
    }
  }

  // --- SCHEDULED TASKS ---
  cron.schedule('*/5 * * * *', async () => {
    log('Running scheduled point claim task...', 'system');
    await attemptPointClaims();
  });
  
  cron.schedule('*/15 * * * *', async () => {
    const enabled = db.prepare("SELECT value FROM settings WHERE key = 'bettingEnabled'").get()?.value === 'true';
    if (enabled) {
      log('Running scheduled betting task...', 'system');
      await processBets();
    }
  });

  cron.schedule('*/30 * * * *', async () => {
    log('Running drop campaign scraping task...', 'system');
    if (dropScrapingService) {
      await dropScrapingService.updateCampaigns();
    }
  });

  // --- REAL TWITCH HELIX API ENGINE ---
  setInterval(async () => {
    const farmingAccounts = db.prepare("SELECT * FROM accounts WHERE status = 'farming' AND accessToken IS NOT NULL").all() as Account[];
    const row = db.prepare("SELECT value FROM settings WHERE key = 'twitchClientId'").get() as {value: string} | undefined;
    const clientId = row?.value;

    if (!clientId) return;

    for (const acc of farmingAccounts) {
      try {
        const follows = db.prepare("SELECT * FROM followed_channels WHERE account_id = ?").all(acc.id) as FollowedChannel[];
        if (follows.length === 0) continue;

        const streamerIds = follows.map(f => f.streamer_id).filter(id => id);
        if (streamerIds.length === 0) continue;

        const chunkSize = 100;
        const liveStreamsMap = new Map();

        for (let i = 0; i < streamerIds.length; i += chunkSize) {
          const chunk = streamerIds.slice(i, i + chunkSize);
          const queryParams = chunk.map(id => `user_id=${id}`).join('&');
          
          const streamsRes = await fetch(`https://api.twitch.tv/helix/streams?${queryParams}`, {
            headers: {
              'Authorization': `Bearer ${acc.accessToken}`,
              'Client-Id': clientId
            }
          });

          if (streamsRes.ok) {
            const streamsData = await streamsRes.json();
            streamsData.data.forEach((stream: any) => {
              liveStreamsMap.set(stream.user_id, stream);
            });
          } else if (streamsRes.status === 401) {
            db.prepare("UPDATE accounts SET status = 'idle' WHERE id = ?").run(acc.id);
            log(`Access token expired. Farming stopped.`, 'system', acc.id);
            await disconnectChatAccount(acc.id);
            continue;
          }
        }

        let newlyLiveCount = 0;
        for (const follow of follows) {
          const liveData = liveStreamsMap.get(follow.streamer_id);
          
          if (liveData) {
            if (follow.status !== 'live') {
              newlyLiveCount++;
              log(`${follow.streamer} went LIVE playing ${liveData.game_name}.`, 'system', acc.id, follow.streamer);
            }
            db.prepare("UPDATE followed_channels SET status = 'live', game_name = ?, viewer_count = ? WHERE id = ?").run(
              liveData.game_name, liveData.viewer_count, follow.id
            );
          } else {
            db.prepare("UPDATE followed_channels SET status = 'offline', game_name = NULL, viewer_count = 0 WHERE id = ?").run(follow.id);
          }
        }

        const dropAllocation = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'dropAllocation'").get()?.value || '20');
        const liveFollows = db.prepare("SELECT * FROM followed_channels WHERE account_id = ? AND status = 'live'").all(acc.id) as FollowedChannel[];
        
        const whitelistedGames = db.prepare("SELECT name FROM games WHERE whitelisted = 1").all() as {name: string}[];
        const dropChannels = liveFollows.filter(f => whitelistedGames.some(g => g.name === f.game_name));
        const favoriteChannels = liveFollows.filter(f => !whitelistedGames.some(g => g.name === f.game_name));
        
        const limit = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'concurrentStreams'").get()?.value || '10');
        const dropSlots = Math.max(1, Math.floor(limit * (dropAllocation / 100)));
        const favoriteSlots = limit - dropSlots;
        
        db.prepare("DELETE FROM active_streams WHERE account_id = ?").run(acc.id);
        
        for (let i = 0; i < Math.min(dropChannels.length, dropSlots); i++) {
          db.prepare("INSERT INTO active_streams (account_id, streamer, type) VALUES (?, ?, ?)").run(acc.id, dropChannels[i].streamer, 'drop');
        }
        
        for (let i = 0; i < Math.min(favoriteChannels.length, favoriteSlots); i++) {
          db.prepare("INSERT INTO active_streams (account_id, streamer, type) VALUES (?, ?, ?)").run(acc.id, favoriteChannels[i].streamer, 'favorite');
        }

      } catch (error) {
        console.error(`Error processing account ${acc.username}:`, error);
      }
    }
  }, 30000);

  // --- API ROUTES ---
  app.get("/api/stats", (req, res) => {
    const accounts = db.prepare('SELECT * FROM accounts').all() as Account[];
    const totalPoints = accounts.reduce((sum, acc) => sum + (acc.points || 0), 0);
    const activeAccounts = accounts.filter(a => a.status === 'farming').length;
    const totalClaims = db.prepare('SELECT COUNT(*) as count FROM point_claim_history').get() as {count: number};
    const totalBets = db.prepare('SELECT COUNT(*) as count FROM betting_stats').get() as {count: number};
    
    res.json({
      totalPoints,
      dropsClaimed: 0,
      activeAccounts,
      uptime: "Real-time API Active",
      totalClaims: totalClaims.count,
      totalBets: totalBets.count,
      connectedChats: activeChatClients.size
    });
  });

  app.get("/api/accounts", (req, res) => {
    const accounts = db.prepare('SELECT * FROM accounts').all() as Account[];
    const accountsWithStreams = accounts.map(acc => {
      const activeStreams = db.prepare('SELECT streamer, type FROM active_streams WHERE account_id = ?').all(acc.id);
      const followedChannels = db.prepare('SELECT * FROM followed_channels WHERE account_id = ? ORDER BY status DESC, viewer_count DESC').all(acc.id);
      const chatConnected = activeChatClients.has(acc.id);
      return { ...acc, activeStreams, followedChannels, chatConnected };
    });
    res.json(accountsWithStreams);
  });

  app.post("/api/accounts/:id/toggle", async (req, res) => {
    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id) as Account;
    if (acc) {
      const newStatus = acc.status === 'farming' ? 'idle' : 'farming';
      db.prepare('UPDATE accounts SET status = ? WHERE id = ?').run(newStatus, req.params.id);
      
      if (newStatus === 'idle') {
        db.prepare('DELETE FROM active_streams WHERE account_id = ?').run(req.params.id);
        await disconnectChatAccount(acc.id);
      } else {
        await connectChatAccount(acc);
      }
      
      log(`Farming ${newStatus === 'farming' ? 'started' : 'stopped'}.`, 'system', acc.id);
    }
    res.json({ success: true });
  });

  app.delete("/api/accounts/:id", async (req, res) => {
    await disconnectChatAccount(parseInt(req.params.id));
    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM active_streams WHERE account_id = ?').run(req.params.id);
    db.prepare('DELETE FROM followed_channels WHERE account_id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/claim-points", async (req, res) => {
    await attemptPointClaims();
    res.json({ success: true });
  });

  app.post("/api/place-bet", (req, res) => {
    const { accountId, streamer, amount, outcome } = req.body;
    const resultAmount = outcome === 'win' ? Math.floor(amount * 1.9) : -amount;
    
    db.prepare(`
      INSERT INTO betting_stats (streamer, account_id, bet_amount, outcome, bet_type, strategy, placed_at, result_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(streamer, accountId, amount, outcome, 'manual', 'Manual', new Date().toISOString(), resultAmount);
    
    db.prepare('UPDATE accounts SET points = points + ? WHERE id = ?').run(resultAmount, accountId);
    
    loadBettingStats();
    res.json({ success: true, resultAmount });
  });

  app.get("/api/betting-stats", (req, res) => {
    const stats = Array.from(bettingStats.values());
    res.json(stats);
  });

  app.get("/api/claim-history", (req, res) => {
    const history = db.prepare('SELECT * FROM point_claim_history ORDER BY claimed_at DESC LIMIT 100').all();
    res.json(history);
  });

  app.post("/api/settings/betting", (req, res) => {
    const { bettingEnabled, maxBetPercentage } = req.body;
    const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    if (bettingEnabled !== undefined) stmt.run('bettingEnabled', bettingEnabled.toString());
    if (maxBetPercentage !== undefined) stmt.run('maxBetPercentage', maxBetPercentage.toString());
    res.json({ success: true });
  });

  app.get("/api/games", (req, res) => {
    res.json(db.prepare('SELECT * FROM games').all());
  });

  app.post("/api/games/:id/toggle", (req, res) => {
    const game = db.prepare('SELECT whitelisted FROM games WHERE id = ?').get(req.params.id) as any;
    if (game) {
      db.prepare('UPDATE games SET whitelisted = ? WHERE id = ?').run(game.whitelisted ? 0 : 1, req.params.id);
    }
    res.json({ success: true });
  });

  app.post("/api/auth/device", async (req, res) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'twitchClientId'").get() as {value: string} | undefined;
    const clientId = row?.value;
    if (!clientId) return res.status(400).json({ error: "TWITCH_CLIENT_ID_MISSING" });

    try {
      const response = await fetch('https://id.twitch.tv/oauth2/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          scopes: 'user:read:email chat:read chat:edit user:read:follows'
        })
      });
      const data = await response.json();
      if (!response.ok) return res.status(400).json({ error: data.message || "Failed to get device code." });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Internal server error." });
    }
  });

  app.post("/api/auth/poll", async (req, res) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'twitchClientId'").get() as {value: string} | undefined;
    const clientId = row?.value;
    const { device_code } = req.body;
    if (!clientId || !device_code) return res.status(400).json({ error: "Missing client ID or device code." });

    try {
      const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' })
      });
      const data = await response.json();
      
      if (response.status === 400) {
        if (data.error === 'authorization_pending') return res.json({ status: 'pending' });
        return res.status(400).json({ error: data.message || data.error || "Authentication failed." });
      }
      
      if (data.access_token) {
        const userRes = await fetch('https://api.twitch.tv/helix/users', {
          headers: { 'Authorization': `Bearer ${data.access_token}`, 'Client-Id': clientId }
        });
        const userData = await userRes.json();
        if (!userData.data || userData.data.length === 0) return res.status(400).json({ error: "Failed to fetch profile." });
        
        const user = userData.data[0];
        const insertResult = db.prepare('INSERT INTO accounts (username, twitch_id, status, points, accessToken, refreshToken) VALUES (?, ?, ?, ?, ?, ?)').run(
          user.login, user.id, 'idle', 0, data.access_token, data.refresh_token
        );
        const newAccountId = insertResult.lastInsertRowid;
        
        log(`Account ${user.login} linked. Fetching followed channels...`, 'system', newAccountId);

        let cursor = null;
        let fetchedCount = 0;
        const insertFollowed = db.prepare('INSERT INTO followed_channels (account_id, streamer, streamer_id, status, points, bets) VALUES (?, ?, ?, ?, ?, ?)');
        
        do {
          const followRes = await fetch(`https://api.twitch.tv/helix/channels/followed?user_id=${user.id}&first=100${cursor ? `&after=${cursor}` : ''}`, {
            headers: { 'Authorization': `Bearer ${data.access_token}`, 'Client-Id': clientId }
          });
          
          if (!followRes.ok) break;
          const followData = await followRes.json();
          
          if (followData.data) {
            for (const follow of followData.data) {
              insertFollowed.run(newAccountId, follow.broadcaster_login, follow.broadcaster_id, 'offline', 0, 0);
              fetchedCount++;
            }
          }
          cursor = followData.pagination?.cursor;
        } while (cursor && fetchedCount < 500);

        log(`Successfully indexed ${fetchedCount} followed channels.`, 'system', newAccountId);

        return res.json({ status: 'success', username: user.login });
      }
      res.status(400).json({ error: data.message || "Authentication failed." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error." });
    }
  });

  app.get("/api/streamer-analysis", (req, res) => {
    res.json(db.prepare('SELECT * FROM bet_history').all());
  });

  app.get("/api/settings", (req, res) => {
    const rows = db.prepare('SELECT * FROM settings').all() as {key: string, value: string}[];
    const settings = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    res.json(settings);
  });

  app.post("/api/settings", (req, res) => {
    const { twitchClientId, concurrentStreams, dropAllocation } = req.body;
    const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    if (twitchClientId !== undefined) stmt.run('twitchClientId', twitchClientId);
    if (concurrentStreams !== undefined) stmt.run('concurrentStreams', concurrentStreams.toString());
    if (dropAllocation !== undefined) stmt.run('dropAllocation', dropAllocation.toString());
    res.json({ success: true });
  });

  app.post("/api/factory-reset", async (req, res) => {
    for (const [accountId] of activeChatClients) {
      await disconnectChatAccount(accountId);
    }
    activeChatClients.clear();
    
    db.exec('DELETE FROM accounts; DELETE FROM bet_history; DELETE FROM settings; DELETE FROM logs; DELETE FROM active_streams; DELETE FROM favorite_channels; DELETE FROM campaigns; DELETE FROM followed_channels; DELETE FROM point_claim_history; DELETE FROM betting_stats; DELETE FROM drop_progress;');
    res.json({ success: true });
  });

  app.get("/api/campaigns", (req, res) => {
    res.json(db.prepare('SELECT * FROM campaigns').all());
  });

  app.get("/api/favorites", (req, res) => {
    res.json(db.prepare('SELECT * FROM favorite_channels').all());
  });

  app.post("/api/favorites", (req, res) => {
    const { streamer } = req.body;
    if (streamer) {
      db.prepare('INSERT INTO favorite_channels (streamer) VALUES (?)').run(streamer.toLowerCase());
    }
    res.json({ success: true });
  });

  app.delete("/api/favorites/:id", (req, res) => {
    db.prepare('DELETE FROM favorite_channels WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/logs", (req, res) => {
    const { accountId, streamer } = req.query;
    let query = 'SELECT logs.*, accounts.username FROM logs LEFT JOIN accounts ON logs.account_id = accounts.id';
    const params: any[] = [];
    const conditions: string[] = [];

    if (accountId) {
      conditions.push('logs.account_id = ?');
      params.push(accountId);
    }
    if (streamer) {
      conditions.push('logs.streamer = ?');
      params.push(streamer);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY logs.id DESC LIMIT 100';
    res.json(db.prepare(query).all(...params));
  });

  // --- PRODUCTION STATIC FILE SERVING ---
  // Serve static files from dist/ folder in production
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  } else {
    // Development mode - use Vite dev server
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  // --- HTTP SERVER WITH WEBSOCKET ---
  const httpServer = createServer(app);

  // Initialize WebSocket service
  wsService = new WebSocketService(httpServer, path.join(dataDir, 'farm.db'));
  console.log('✓ WebSocket Service initialized');

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Enhanced features loaded: Point Claiming, Betting Engine, 20/80 Allocation');
    console.log('NEW: Real Point Claiming (Playwright), Drop Scraping, WebSocket, Multi-Account Coordination, Automated Backups');
    console.log(`WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
