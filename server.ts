import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Local SQLite Database for W/L tracking and state
  // Using WAL mode for high-concurrency writes from headless browser workers
  const db = new Database('farm.db');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, status TEXT, currentTarget TEXT, points INTEGER);
    CREATE TABLE IF NOT EXISTS bet_history (id INTEGER PRIMARY KEY AUTOINCREMENT, streamer TEXT, winRate REAL, totalBets INTEGER, riskLevel TEXT, recommendedStrategy TEXT);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  `);

  // Seed initial data if empty
  const accCount = db.prepare('SELECT COUNT(*) as c FROM accounts').get() as { c: number };
  if (accCount.c === 0) {
    const insertAcc = db.prepare('INSERT INTO accounts (username, status, currentTarget, points) VALUES (?, ?, ?, ?)');
    insertAcc.run('GamerOne', 'farming', 'shroud', 450200);
    insertAcc.run('AltAccount99', 'farming', 'tarik', 12050);

    const insertBet = db.prepare('INSERT INTO bet_history (streamer, winRate, totalBets, riskLevel, recommendedStrategy) VALUES (?, ?, ?, ?, ?)');
    insertBet.run('shroud', 72.5, 145, 'Low', 'Kelly Criterion');
    insertBet.run('tarik', 45.2, 89, 'High', 'Martingale');
    insertBet.run('zackrawrr', 88.1, 210, 'Very Low', 'Kelly Criterion');
    insertBet.run('kyedae', 55.4, 42, 'Medium', 'Fibonacci');
  }

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
    res.json(db.prepare('SELECT * FROM accounts').all());
  });

  app.post("/api/accounts/auth", (req, res) => {
    // Simulate OAuth device flow completion
    const insert = db.prepare('INSERT INTO accounts (username, status, currentTarget, points) VALUES (?, ?, ?, ?)');
    const info = insert.run(`TwitchUser_${Math.floor(Math.random()*10000)}`, 'idle', null, 0);
    res.json({ success: true, id: info.lastInsertRowid });
  });

  app.delete("/api/accounts/:id", (req, res) => {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/streamer-analysis", (req, res) => {
    res.json(db.prepare('SELECT * FROM bet_history').all());
  });

  app.post("/api/settings", (req, res) => {
    // Mock save settings to DB
    res.json({ success: true });
  });

  app.post("/api/factory-reset", (req, res) => {
    db.exec('DELETE FROM accounts; DELETE FROM bet_history; DELETE FROM settings;');
    res.json({ success: true });
  });

  app.get("/api/campaigns", (req, res) => {
    res.json([
      { id: 1, game: "Valorant", name: "VCT Masters Drops", progress: 75, status: "active", timeRemaining: "45m" },
      { id: 2, game: "Rust", name: "Rustoria Drops", progress: 100, status: "completed", timeRemaining: "0m" },
      { id: 3, game: "Overwatch 2", name: "Season 10 Drops", progress: 12, status: "active", timeRemaining: "3h 20m" },
    ]);
  });

  app.get("/api/games", (req, res) => {
    res.json([
      { id: 1, name: "Valorant", activeCampaigns: 1, whitelisted: true, lastDrop: "Currently Active" },
      { id: 2, name: "Rust", activeCampaigns: 0, whitelisted: true, lastDrop: "1 week ago" },
      { id: 3, name: "Path of Exile", activeCampaigns: 0, whitelisted: false, lastDrop: "3 months ago" },
      { id: 4, name: "Path of Exile 2", activeCampaigns: 0, whitelisted: true, lastDrop: "1 month ago" },
      { id: 5, name: "Overwatch 2", activeCampaigns: 1, whitelisted: true, lastDrop: "Currently Active" },
      { id: 6, name: "Warframe", activeCampaigns: 0, whitelisted: false, lastDrop: "2 weeks ago" },
    ]);
  });

  app.get("/api/logs", (req, res) => {
    res.json([
      { id: 1, time: new Date(Date.now() - 1000 * 60 * 5).toISOString(), type: "drop", message: "Claimed 'Spray' for Valorant on GamerOne" },
      { id: 2, time: new Date(Date.now() - 1000 * 60 * 12).toISOString(), type: "points", message: "Claimed 50 points on shroud for GamerOne" },
      { id: 3, time: new Date(Date.now() - 1000 * 60 * 25).toISOString(), type: "bet", message: "Won 500 points betting on 'Yes' in tarik's stream" },
      { id: 4, time: new Date(Date.now() - 1000 * 60 * 40).toISOString(), type: "system", message: "AltAccount99 switched target to tarik (Priority: Drops)" },
    ]);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
