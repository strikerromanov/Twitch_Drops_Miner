import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import path, { join } from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';

import { generateAuthUrl, exchangeCodeForToken, getUserInfo, validateState, storeState } from './core/auth';
import { logInfo, logError } from './core/logger';
import { getConfig } from './core/config';
import { Queries } from './core/database';

// Services are default exports: export default new ServiceClass()
import dropIndexer from './services/drop-indexer.service';
import pointClaimer from './services/point-claimer.service';
import chatFarmer from './services/chat-farmer.service';
import followedChannels from './services/followed-channels.service';
import healthCheck from './services/health-check.service';
import bettingService from './services/betting.service';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;

dotenv.config();

app.use(cors());
app.use(express.json());
app.use(express.static(join(fileURLToPath(import.meta.url), '../dist')));

const broadcast = (data: any) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

setInterval(() => broadcast({ type: 'stats', data: Queries.getStats() }), 5000);

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', services: healthCheck.getStatus() });
});

app.get('/api/stats', (req, res) => {
  res.json(Queries.getStats());
});

app.get('/api/campaigns', (req, res) => {
  res.json(Queries.getAllCampaigns());
});

app.get('/api/accounts', (req, res) => {
  res.json(Queries.getAllAccounts());
});

app.post('/api/accounts/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const accountId = parseInt(id as string, 10);
  Queries.updateAccountStatus(status, accountId);
  res.json({ success: true });
});

app.delete('/api/accounts/:id', (req, res) => {
  const { id } = req.params;
  Queries.deleteAccount(id);
  res.json({ success: true });
});

app.get('/api/settings', (req, res) => {
  res.json(Queries.getSettings());
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  Queries.upsertSetting(key, value);
  res.json({ success: true });
});

app.get('/api/logs', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  res.json(Queries.getRecentLogs(limit));
});

app.get('/auth', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  storeState(state);
  const authUrl = generateAuthUrl(state);
  res.json({ url: authUrl });
});

app.get('/auth/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    logError('Auth error: ' + String(error));
    return res.redirect('/?error=auth_failed');
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state' });
  }

  try {
    const validState = validateState(state as string);
    if (!validState) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    const tokenData = await exchangeCodeForToken(code as string);
    const userData = await getUserInfo(tokenData.access_token);

    if (!userData) {
      throw new Error('Failed to get user info');
    }

    const account = {
      user_id: userData.id,
      username: userData.login,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
      status: 'farming'
    };

    Queries.upsertAccount(account);
    logInfo('Account added: ' + userData.login);

    res.redirect('/');
  } catch (error: any) {
    logError('Token exchange failed: ' + String(error?.message || error));
    res.redirect('/?error=token_exchange_failed');
  }
});

app.post('/api/start', (req, res) => {
  dropIndexer.start();
  pointClaimer.start();
  chatFarmer.start();
  followedChannels.start();
  bettingService.start();
  res.json({ success: true });
});

app.post('/api/stop', (req, res) => {
  dropIndexer.stop();
  pointClaimer.stop();
  chatFarmer.stop();
  followedChannels.stop();
  bettingService.stop();
  res.json({ success: true });
});

server.listen(PORT, '0.0.0.0', () => {
  logInfo('Server running on port ' + PORT);
  healthCheck.start();
});
