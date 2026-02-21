import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(path.join(dataDir, 'farm.db'));
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, status TEXT, currentTarget TEXT, points INTEGER, accessToken TEXT, refreshToken TEXT);
    CREATE TABLE IF NOT EXISTS bet_history (id INTEGER PRIMARY KEY AUTOINCREMENT, streamer TEXT, winRate REAL, totalBets INTEGER, riskLevel TEXT, recommendedStrategy TEXT);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT, type TEXT, message TEXT, account_id INTEGER, streamer TEXT);
    CREATE TABLE IF NOT EXISTS favorite_channels (id INTEGER PRIMARY KEY AUTOINCREMENT, streamer TEXT);
    CREATE TABLE IF NOT EXISTS campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT, game TEXT, name TEXT, streamer TEXT, progress INTEGER, status TEXT, timeRemaining TEXT);
    CREATE TABLE IF NOT EXISTS active_streams (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER, streamer TEXT, type TEXT);
    CREATE TABLE IF NOT EXISTS followed_channels (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER, streamer TEXT, status TEXT, points INTEGER, bets INTEGER);
    CREATE TABLE IF NOT EXISTS games (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, activeCampaigns INTEGER, whitelisted INTEGER, lastDrop TEXT);
  `);

  try { db.exec('ALTER TABLE logs ADD COLUMN account_id INTEGER'); } catch(e) {}
  try { db.exec('ALTER TABLE logs ADD COLUMN streamer TEXT'); } catch(e) {}

  // Seed initial data
  if (db.prepare('SELECT COUNT(*) as c FROM accounts').get().c === 0) {
    const insertAcc = db.prepare('INSERT INTO accounts (username, status, points) VALUES (?, ?, ?)');
    insertAcc.run('GamerOne', 'idle', 450200);
    insertAcc.run('AltAccount99', 'idle', 12050);

    const insertBet = db.prepare('INSERT INTO bet_history (streamer, winRate, totalBets, riskLevel, recommendedStrategy) VALUES (?, ?, ?, ?, ?)');
    insertBet.run('shroud', 72.5, 145, 'Low', 'Kelly Criterion');
    insertBet.run('tarik', 45.2, 89, 'High', 'Martingale');
    insertBet.run('zackrawrr', 88.1, 210, 'Very Low', 'Kelly Criterion');
    
    db.prepare('INSERT INTO logs (time, type, message) VALUES (?, ?, ?)').run(new Date().toISOString(), "system", "Database initialized. Ready to start farming.");
  }

  if (db.prepare('SELECT COUNT(*) as c FROM followed_channels').get().c === 0) {
    const insertFollowed = db.prepare('INSERT INTO followed_channels (account_id, streamer, status, points, bets) VALUES (?, ?, ?, ?, ?)');
    insertFollowed.run(1, 'shroud', 'live', 15000, 45);
    insertFollowed.run(1, 'tarik', 'live', 8200, 12);
    insertFollowed.run(1, 'zackrawrr', 'offline', 450, 0);
    insertFollowed.run(1, 'kyedae', 'offline', 1200, 3);
    
    insertFollowed.run(2, 'tarik', 'live', 5000, 10);
    insertFollowed.run(2, 'summit1g', 'offline', 200, 0);
  }

  if (db.prepare('SELECT COUNT(*) as c FROM games').get().c === 0) {
    const insertGame = db.prepare('INSERT INTO games (name, activeCampaigns, whitelisted, lastDrop) VALUES (?, ?, ?, ?)');
    insertGame.run('Valorant', 1, 1, 'Currently Active');
    insertGame.run('Rust', 0, 1, '1 week ago');
    insertGame.run('Path of Exile', 0, 0, '3 months ago');
    insertGame.run('Path of Exile 2', 0, 1, '1 month ago');
    insertGame.run('Overwatch 2', 1, 1, 'Currently Active');
    insertGame.run('Warframe', 0, 0, '2 weeks ago');
  }

  if (db.prepare('SELECT COUNT(*) as c FROM favorite_channels').get().c === 0) {
    const insertFav = db.prepare('INSERT INTO favorite_channels (streamer) VALUES (?)');
    ['shroud', 'tarik', 'zackrawrr', 'kyedae', 'summit1g', 'xQc', 'loltyler1', 'lirik', 'cohhcarnage'].forEach(s => insertFav.run(s));
  }

  if (db.prepare('SELECT COUNT(*) as c FROM campaigns').get().c === 0) {
    const insertCamp = db.prepare('INSERT INTO campaigns (game, name, streamer, progress, status, timeRemaining) VALUES (?, ?, ?, ?, ?, ?)');
    insertCamp.run('Valorant', 'VCT Masters Drops', 'valorant', 75, 'active', '45m');
    insertCamp.run('Rust', 'Rustoria Drops', 'posty', 10, 'active', '2h');
    insertCamp.run('Overwatch 2', 'Season 10 Drops', 'emongg', 0, 'active', '4h');
    insertCamp.run('Path of Exile', 'League Launch', 'zizaran', 100, 'completed', '0m');
  }

  // Ensure default settings
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('concurrentStreams', '10')").run();

  // --- BACKGROUND FARMING ENGINE (SIMULATION) ---
  setInterval(() => {
    const farmingAccounts = db.prepare("SELECT * FROM accounts WHERE status = 'farming'").all() as any[];
    const settings = db.prepare("SELECT * FROM settings").all() as any[];
    const maxConcurrent = parseInt(settings.find(s => s.key === 'concurrentStreams')?.value || '10');
    
    // 20/80 Split: 20% Drops, 80% Favorites
    const dropLimit = Math.max(1, Math.floor(maxConcurrent * 0.2));
    const favLimit = maxConcurrent - dropLimit;

    const activeCampaigns = db.prepare("SELECT * FROM campaigns WHERE status = 'active'").all() as any[];
    const favoriteChannels = db.prepare("SELECT * FROM favorite_channels").all() as any[];

    farmingAccounts.forEach(acc => {
      const currentStreams = db.prepare("SELECT * FROM active_streams WHERE account_id = ?").all(acc.id) as any[];
      const currentDrops = currentStreams.filter(s => s.type === 'drop');
      const currentFavs = currentStreams.filter(s => s.type === 'favorite');

      // 1. Assign Drop Streams
      if (currentDrops.length < dropLimit && activeCampaigns.length > 0) {
        const needed = dropLimit - currentDrops.length;
        for (let i = 0; i < needed; i++) {
          const camp = activeCampaigns[Math.floor(Math.random() * activeCampaigns.length)];
          // Avoid duplicates
          if (!currentStreams.find(s => s.streamer === camp.streamer)) {
            db.prepare("INSERT INTO active_streams (account_id, streamer, type) VALUES (?, ?, ?)").run(acc.id, camp.streamer, 'drop');
            db.prepare("INSERT INTO logs (time, type, message, account_id, streamer) VALUES (?, ?, ?, ?, ?)").run(
              new Date().toISOString(), "system", `Joined ${camp.streamer} for ${camp.game} drops.`, acc.id, camp.streamer
            );
          }
        }
      }

      // 2. Assign Favorite Streams
      if (currentFavs.length < favLimit && favoriteChannels.length > 0) {
        const needed = favLimit - currentFavs.length;
        for (let i = 0; i < needed; i++) {
          const fav = favoriteChannels[Math.floor(Math.random() * favoriteChannels.length)];
          if (!currentStreams.find(s => s.streamer === fav.streamer) && !db.prepare("SELECT 1 FROM active_streams WHERE account_id = ? AND streamer = ?").get(acc.id, fav.streamer)) {
            db.prepare("INSERT INTO active_streams (account_id, streamer, type) VALUES (?, ?, ?)").run(acc.id, fav.streamer, 'favorite');
            db.prepare("INSERT INTO logs (time, type, message, account_id, streamer) VALUES (?, ?, ?, ?, ?)").run(
              new Date().toISOString(), "system", `Joined favorite channel ${fav.streamer}.`, acc.id, fav.streamer
            );
          }
        }
      }

      // 3. Simulate Activity for Active Streams
      const active = db.prepare("SELECT * FROM active_streams WHERE account_id = ?").all(acc.id) as any[];
      active.forEach(stream => {
        const rand = Math.random();
        
        if (rand > 0.90) { // 10% chance to claim points
          const points = Math.floor(Math.random() * 50) + 10;
          db.prepare("UPDATE accounts SET points = points + ? WHERE id = ?").run(points, acc.id);
          db.prepare("INSERT INTO logs (time, type, message, account_id, streamer) VALUES (?, ?, ?, ?, ?)").run(
            new Date().toISOString(), "points", `Claimed ${points} channel points.`, acc.id, stream.streamer
          );
        } else if (stream.type === 'drop' && rand > 0.85 && rand <= 0.90) { // 5% chance to progress drop
          db.prepare("INSERT INTO logs (time, type, message, account_id, streamer) VALUES (?, ?, ?, ?, ?)").run(
            new Date().toISOString(), "drop", `Drop progress updated (approx. 15m).`, acc.id, stream.streamer
          );
        } else if (rand > 0.80 && rand <= 0.85) { // 5% chance to place a bet
          const betAmount = Math.floor(Math.random() * 500) + 100;
          db.prepare("INSERT INTO logs (time, type, message, account_id, streamer) VALUES (?, ?, ?, ?, ?)").run(
            new Date().toISOString(), "bet", `Placed ${betAmount} points bet using Kelly Criterion.`, acc.id, stream.streamer
          );
        }
      });
    });
  }, 5000);

  // API Routes
  app.get("/api/stats", (req, res) => {
    const accounts = db.prepare('SELECT * FROM accounts').all() as any[];
    const totalPoints = accounts.reduce((sum, acc) => sum + acc.points, 0);
    res.json({ 
      totalPoints, 
      dropsClaimed: 142, 
      activeAccounts: accounts.filter(a => a.status === 'farming').length, 
      uptime: "14d 5h 23m" 
    });
  });

  app.get("/api/accounts", (req, res) => {
    const accounts = db.prepare('SELECT * FROM accounts').all() as any[];
    const accountsWithStreams = accounts.map(acc => {
      const activeStreams = db.prepare('SELECT streamer, type FROM active_streams WHERE account_id = ?').all(acc.id);
      const followedChannels = db.prepare('SELECT * FROM followed_channels WHERE account_id = ?').all(acc.id);
      return { ...acc, activeStreams, followedChannels };
    });
    res.json(accountsWithStreams);
  });

  app.post("/api/accounts/:id/toggle", (req, res) => {
    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id) as any;
    if (acc) {
      const newStatus = acc.status === 'farming' ? 'idle' : 'farming';
      db.prepare('UPDATE accounts SET status = ? WHERE id = ?').run(newStatus, req.params.id);
      
      if (newStatus === 'idle') {
        db.prepare('DELETE FROM active_streams WHERE account_id = ?').run(req.params.id);
      }
      
      db.prepare('INSERT INTO logs (time, type, message, account_id) VALUES (?, ?, ?, ?)').run(
        new Date().toISOString(), "system", `Farming ${newStatus === 'farming' ? 'started' : 'stopped'}.`, acc.id
      );
    }
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
        body: new URLSearchParams({ client_id: clientId, scopes: 'user:read:email chat:read chat:edit' })
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
        
        const username = userData.data[0].login;
        db.prepare('INSERT INTO accounts (username, status, points, accessToken, refreshToken) VALUES (?, ?, ?, ?, ?)').run(username, 'idle', 0, data.access_token, data.refresh_token);
        db.prepare('INSERT INTO logs (time, type, message) VALUES (?, ?, ?)').run(new Date().toISOString(), "system", `Account ${username} linked.`);
        return res.json({ status: 'success', username });
      }
      res.status(400).json({ error: data.message || "Authentication failed." });
    } catch (error) {
      res.status(500).json({ error: "Internal server error." });
    }
  });

  app.delete("/api/accounts/:id", (req, res) => {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM active_streams WHERE account_id = ?').run(req.params.id);
    res.json({ success: true });
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
    const { twitchClientId, concurrentStreams } = req.body;
    const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    if (twitchClientId !== undefined) stmt.run('twitchClientId', twitchClientId);
    if (concurrentStreams !== undefined) stmt.run('concurrentStreams', concurrentStreams.toString());
    res.json({ success: true });
  });

  app.post("/api/factory-reset", (req, res) => {
    db.exec('DELETE FROM accounts; DELETE FROM bet_history; DELETE FROM settings; DELETE FROM logs; DELETE FROM active_streams; DELETE FROM favorite_channels; DELETE FROM campaigns;');
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

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
