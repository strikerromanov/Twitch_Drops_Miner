import express from "express";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/stats", (req, res) => {
    res.json({
      totalPoints: 1254300,
      dropsClaimed: 142,
      activeAccounts: 3,
      uptime: "14d 5h 23m",
    });
  });

  app.get("/api/accounts", (req, res) => {
    res.json([
      { id: 1, username: "GamerOne", status: "farming", currentTarget: "shroud", points: 450200 },
      { id: 2, username: "AltAccount99", status: "farming", currentTarget: "tarik", points: 12050 },
      { id: 3, username: "DropsFarmerX", status: "idle", currentTarget: null, points: 890040 },
    ]);
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

  app.get("/api/streamer-analysis", (req, res) => {
    res.json([
      { id: 1, streamer: "shroud", winRate: 72.5, totalBets: 145, riskLevel: "Low", recommendedStrategy: "Follow the Crowd" },
      { id: 2, streamer: "tarik", winRate: 45.2, totalBets: 89, riskLevel: "High", recommendedStrategy: "Underdog" },
      { id: 3, streamer: "zackrawrr", winRate: 88.1, totalBets: 210, riskLevel: "Very Low", recommendedStrategy: "Smart Percentage" },
      { id: 4, streamer: "kyedae", winRate: 55.4, totalBets: 42, riskLevel: "Medium", recommendedStrategy: "Smart Percentage" },
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
