import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import path, { join } from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';

import { generateAuthUrl, exchangeCodeForToken, getUserInfo, validateState, storeState } from './core/auth';
import { logInfo, logError, logDebug } from './core/logger';
import { getConfig } from './core/config';
import { Queries } from './core/database';

import dropIndexer from './services/drop-indexer.service';
import pointClaimer from './services/point-claimer.service';
import chatFarmer from './services/chat-farmer.service';
import followedChannels from './services/followed-channels.service';
import healthCheck from './services/health-check.service';
import { bettingService } from './services/betting.service';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

let config = getConfig();

// Logging middleware
app.use((req: Request, res: Response, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// WebSocket connection handling
app.locals.wsClients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  console.log('New WebSocket client connected');
  app.locals.wsClients.add(ws);
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    app.locals.wsClients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function broadcastToClients(data: any) {
  const message = JSON.stringify(data);
  app.locals.wsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Helper function to save account to database
async function saveAccountToDatabase(accountData: any) {
  try {
    Queries.upsertAccount({
      user_id: accountData.user_id,
      username: accountData.username,
      access_token: accountData.access_token,
      refresh_token: accountData.refresh_token,
      expires_at: accountData.expires_at,
      status: 'idle'
    });
    logInfo(`Account saved: ${accountData.username}`);
  } catch (error: any) {
    logError(`Error saving account: ${error.message}`);
    throw error;
  }
}

// API Routes

// Auth routes
app.get('/api/auth/url', (req: Request, res: Response) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    storeState(state);
    const authUrl = generateAuthUrl(state);
    res.json({ url: authUrl, state });
  } catch (error: any) {
    logError(`Error generating auth URL: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

app.post('/api/auth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }
    
    if (state && !validateState(state)) {
      return res.status(403).json({ error: 'Invalid state parameter' });
    }
    
    const tokenData = await exchangeCodeForToken(code);
    const userData = await getUserInfo(tokenData.access_token);
    
    if (!userData || !userData.data || userData.data.length === 0) {
      return res.status(500).json({ error: 'Failed to get user info' });
    }
    
    await saveAccountToDatabase({
      user_id: userData.data[0].id,
      username: userData.data[0].login,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000)
    });
    
    res.json({ success: true, username: userData.data[0].login });
  } catch (error: any) {
    logError(`Error during auth callback: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/twitch', (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString('hex');
  storeState(state);
  const authUrl = generateAuthUrl(state);
  res.redirect(authUrl);
});

app.get('/auth/callback', (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;
  
  if (error) {
    return res.redirect(`/?error=${error}&description=${error_description}`);
  }
  
  if (!code) {
    return res.redirect('/?error=no_code');
  }
  
  res.redirect(`/?code=${code}&state=${state}`);
});

// Stats routes
app.get('/api/stats', (req: Request, res: Response) => {
  try {
    const accounts = Queries.getAllAccounts();
    const campaigns = Queries.getAllCampaigns();
    const logs = Queries.getRecentLogs(50);
    
    const activeAccounts = accounts.filter((a: any) => a.status === 'farming').length;
    const activeCampaigns = campaigns.filter((c: any) => c.status === 'active').length;
    const claimedCampaigns = campaigns.filter((c: any) => c.last_claimed_at).length;
    
    res.json({
      accounts: {
        total: accounts.length,
        active: activeAccounts,
        inactive: accounts.length - activeAccounts
      },
      campaigns: {
        total: campaigns.length,
        active: activeCampaigns,
        claimed: claimedCampaigns
      },
      logs: logs.slice(0, 10),
      timestamp: Date.now()
    });
  } catch (error: any) {
    logError(`Error fetching stats: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/logs', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = Queries.getRecentLogs(limit);
    res.json(logs);
  } catch (error: any) {
    logError(`Error fetching logs: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Account routes
app.get('/api/accounts', (req: Request, res: Response) => {
  try {
    const accounts = Queries.getAllAccounts();
    res.json(accounts);
  } catch (error: any) {
    logError(`Error fetching accounts: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.delete('/api/accounts/:id', (req: Request, res: Response) => {
  try {
    Queries.deleteAccount(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    logError(`Error deleting account: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Campaign routes
app.get('/api/campaigns', (req: Request, res: Response) => {
  try {
    const campaigns = Queries.getAllCampaigns();
    res.json(campaigns);
  } catch (error: any) {
    logError(`Error fetching campaigns: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Settings routes
app.get('/api/settings', (req: Request, res: Response) => {
  try {
    const settings = Queries.getSettings();
    
    // Mask sensitive values
    const maskedSettings: any = {};
    for (const [key, value] of Object.entries(settings)) {
      if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) {
        maskedSettings[key] = '***MASKED***';
      } else {
        maskedSettings[key] = value;
      }
    }
    
    res.json(maskedSettings);
  } catch (error: any) {
    logError(`Error fetching settings: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    Queries.upsertSetting(key, value);
    config = getConfig();
    res.json({ success: true });
    broadcastToClients({ type: 'settings', data: { key, value } });
  } catch (error: any) {
    logError(`Error saving settings: ${error.message}`);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Health routes
app.get('/api/health', (req: Request, res: Response) => {
  try {
    const health = healthCheck.getStatus();
    res.json(health);
  } catch (error: any) {
    logError(`Error fetching health: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch health status' });
  }
});

// Betting routes - simplified
app.get('/api/betting/stats', (req: Request, res: Response) => {
  try {
    res.json({ bets: [], total: 0, won: 0, lost: 0 });
  } catch (error: any) {
    logError(`Error fetching betting stats: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch betting stats' });
  }
});

app.get('/api/streamer-analysis/:streamer', (req: Request, res: Response) => {
  try {
    const { streamer } = req.params;
    res.json({ streamer, analysis: 'Not implemented yet' });
  } catch (error: any) {
    logError(`Error analyzing streamer: ${error.message}`);
    res.status(500).json({ error: 'Failed to analyze streamer' });
  }
});

// Serve static files in production
if (NODE_ENV === 'production') {
  const distPath = join(__dirname, '../dist');
  app.use(express.static(distPath));
  
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

async function startServer() {
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`OAuth callback URL: http://192.168.1.99:${PORT}/auth/callback`);
  });
  
  // Start services
  dropIndexer.start();
  pointClaimer.start();
  chatFarmer.start();
  followedChannels.start();
  healthCheck.start();
  
  logInfo('All services started successfully');
}

startServer().catch((error) => {
  logError(`Failed to start server: ${error.message}`);
  process.exit(1);
});

export { app, broadcastToClients };
