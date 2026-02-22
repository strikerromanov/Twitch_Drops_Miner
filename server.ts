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
    CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, twitch_id TEXT, status TEXT, currentTarget TEXT, points INTEGER, accessToken TEXT, refreshToken TEXT);
    CREATE TABLE IF NOT EXISTS bet_history (id INTEGER PRIMARY KEY AUTOINCREMENT, streamer TEXT, winRate REAL, totalBets INTEGER, riskLevel TEXT, recommendedStrategy TEXT);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT, type TEXT, message TEXT, account_id INTEGER, streamer TEXT);
    CREATE TABLE IF NOT EXISTS favorite_channels (id INTEGER PRIMARY KEY AUTOINCREMENT, streamer TEXT);
    CREATE TABLE IF NOT EXISTS campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT, game TEXT, name TEXT, streamer TEXT, progress INTEGER, status TEXT, timeRemaining TEXT);
    CREATE TABLE IF NOT EXISTS active_streams (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER, streamer TEXT, type TEXT);
    CREATE TABLE IF NOT EXISTS followed_channels (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER, streamer TEXT, streamer_id TEXT, status TEXT, game_name TEXT, viewer_count INTEGER, points INTEGER, bets INTEGER);
    CREATE TABLE IF NOT EXISTS games (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, activeCampaigns INTEGER, whitelisted INTEGER, lastDrop TEXT);
  `);

  try { db.exec('ALTER TABLE accounts ADD COLUMN twitch_id TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE followed_channels ADD COLUMN streamer_id TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE followed_channels ADD COLUMN game_name TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE followed_channels ADD COLUMN viewer_count INTEGER'); } catch(e) {}
  try { db.exec('ALTER TABLE logs ADD COLUMN account_id INTEGER'); } catch(e) {}
  try { db.exec('ALTER TABLE logs ADD COLUMN streamer TEXT'); } catch(e) {}

  // Ensure default settings
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('concurrentStreams', '10')").run();

  // --- REAL TWITCH HELIX API ENGINE ---
  // This engine uses the official Twitch API to fetch real live statuses of your followed channels.
  setInterval(async () => {
    const farmingAccounts = db.prepare("SELECT * FROM accounts WHERE status = 'farming' AND accessToken IS NOT NULL").all() as any[];
    const row = db.prepare("SELECT value FROM settings WHERE key = 'twitchClientId'").get() as {value: string} | undefined;
    const clientId = row?.value;

    if (!clientId) return;

    for (const acc of farmingAccounts) {
      try {
        // 1. Get all followed channels for this account
        const follows = db.prepare("SELECT * FROM followed_channels WHERE account_id = ?").all(acc.id) as any[];
        if (follows.length === 0) continue;

        // Helix allows up to 100 user_ids per request
        const streamerIds = follows.map(f => f.streamer_id).filter(id => id);
        if (streamerIds.length === 0) continue;

        // Chunk into 100s
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
            // Token expired - in a full production app, implement refresh token flow here
            db.prepare("UPDATE accounts SET status = 'idle' WHERE id = ?").run(acc.id);
            db.prepare("INSERT INTO logs (time, type, message, account_id) VALUES (?, ?, ?, ?)").run(
              new Date().toISOString(), "system", `Access token expired. Farming stopped.`, acc.id
            );
            continue;
          }
        }

        // 2. Update DB with real live status
        let newlyLiveCount = 0;
        for (const follow of follows) {
          const liveData = liveStreamsMap.get(follow.streamer_id);
          
          if (liveData) {
            if (follow.status !== 'live') {
              newlyLiveCount++;
              db.prepare("INSERT INTO logs (time, type, message, account_id, streamer) VALUES (?, ?, ?, ?, ?)").run(
                new Date().toISOString(), "system", `${follow.streamer} went LIVE playing ${liveData.game_name}.`, acc.id, follow.streamer
              );
            }
            db.prepare("UPDATE followed_channels SET status = 'live', game_name = ?, viewer_count = ? WHERE id = ?").run(
              liveData.game_name, liveData.viewer_count, follow.id
            );
          } else {
            db.prepare("UPDATE followed_channels SET status = 'offline', game_name = NULL, viewer_count = 0 WHERE id = ?").run(follow.id);
          }
        }

        // 3. Update Active Streams (The ones we are "watching")
        const liveFollows = db.prepare("SELECT * FROM followed_channels WHERE account_id = ? AND status = 'live'").all(acc.id) as any[];
        db.prepare("DELETE FROM active_streams WHERE account_id = ?").run(acc.id); // Clear old
        
        // Watch up to concurrent limit
        const limit = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'concurrentStreams'").get()?.value || '10');
        const toWatch = liveFollows.slice(0, limit);
        
        for (const watch of toWatch) {
          db.prepare("INSERT INTO active_streams (account_id, streamer, type) VALUES (?, ?, ?)").run(acc.id, watch.streamer, 'favorite');
        }

      } catch (error) {
        console.error(`Error processing account ${acc.username}:`, error);
      }
    }
  }, 30000); // Poll Twitch API every 30 seconds

  // API Routes
  app.get("/api/stats", (req, res) => {
    const accounts = db.prepare('SELECT * FROM accounts').all() as any[];
    const totalPoints = accounts.reduce((sum, acc) => sum + acc.points, 0);
    res.json({ 
      totalPoints, 
      dropsClaimed: 0, // Real drops require headless browser
      activeAccounts: accounts.filter(a => a.status === 'farming').length, 
      uptime: "Real-time API Active" 
    });
  });

  app.get("/api/accounts", (req, res) => {
    const accounts = db.prepare('SELECT * FROM accounts').all() as any[];
    const accountsWithStreams = accounts.map(acc => {
      const activeStreams = db.prepare('SELECT streamer, type FROM active_streams WHERE account_id = ?').all(acc.id);
      const followedChannels = db.prepare('SELECT * FROM followed_channels WHERE account_id = ? ORDER BY status DESC, viewer_count DESC').all(acc.id);
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
        body: new URLSearchParams({ 
          client_id: clientId, 
          // Added user:read:follows to fetch real followed channels
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
        // 1. Fetch Real User Profile
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
        
        db.prepare('INSERT INTO logs (time, type, message, account_id) VALUES (?, ?, ?, ?)').run(
          new Date().toISOString(), "system", `Account ${user.login} linked. Fetching real followed channels...`, newAccountId
        );

        // 2. Fetch REAL Followed Channels
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
        } while (cursor && fetchedCount < 500); // Limit to 500 follows to prevent massive DB inserts on huge accounts

        db.prepare('INSERT INTO logs (time, type, message, account_id) VALUES (?, ?, ?, ?)').run(
          new Date().toISOString(), "system", `Successfully indexed ${fetchedCount} real followed channels.`, newAccountId
        );

        return res.json({ status: 'success', username: user.login });
      }
      res.status(400).json({ error: data.message || "Authentication failed." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error." });
    }
  });

  app.delete("/api/accounts/:id", (req, res) => {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM active_streams WHERE account_id = ?').run(req.params.id);
    db.prepare('DELETE FROM followed_channels WHERE account_id = ?').run(req.params.id);
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
    db.exec('DELETE FROM accounts; DELETE FROM bet_history; DELETE FROM settings; DELETE FROM logs; DELETE FROM active_streams; DELETE FROM favorite_channels; DELETE FROM campaigns; DELETE FROM followed_channels;');
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
