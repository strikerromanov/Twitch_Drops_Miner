import { Router, Request, Response, NextFunction } from 'express';
import { bettingService } from '../services/betting.service.js';
import { Queries, getDb } from '../core/database';
import { logInfo, logError, logWarn } from '../core/logger';
import {
  generateAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  validateToken,
  getUserInfo,
  shouldRefreshToken
} from '../core/auth';
import type {
  Account,
  Setting,
  Log,
  DropCampaign,
  BettingStats,
  FollowedChannel,
  PointClaimHistory
} from '../core/types';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const apiRouter = Router();

// OAuth URL endpoint
apiRouter.get('/api/auth/url', (req, res) => {
  try {
    const authUrl = generateAuthUrl(
      process.env.TWITCH_CLIENT_ID || '',
      process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/callback'
    );
    res.json({ url: authUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// OAuth callback endpoint
apiRouter.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }
    const tokenData = await exchangeCodeForToken(
      code as string,
      process.env.TWITCH_CLIENT_ID || '',
      process.env.TWITCH_CLIENT_SECRET || '',
      process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/callback'
    );
    const userInfo = await getUserInfo(tokenData.access_token);
    if (!userInfo) {
      throw new Error('Failed to get user info');
    }
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);
    const db = getDb();
    const existingAccount = db.prepare('SELECT * FROM accounts WHERE user_id = ?').get(userInfo.id);
    if (existingAccount) {
      db.prepare('UPDATE accounts SET access_token = ?, refresh_token = ?, expires_at = ?, status = ? WHERE user_id = ?').run(
        tokenData.access_token,
        tokenData.refresh_token,
        expiresAt,
        'farming',
        userInfo.id
      );
    } else {
      db.prepare('INSERT INTO accounts (user_id, username, access_token, refresh_token, expires_at, status) VALUES (?, ?, ?, ?, ?, ?)').run(
        userInfo.id,
        userInfo.login,
        tokenData.access_token,
        tokenData.refresh_token,
        expiresAt,
        'farming'
      );
    }
    res.redirect('/');
  } catch (error) {
    logError('OAuth callback failed', error);
    res.status(500).json({ error: 'OAuth callback failed' });
  }
});

// Stats endpoint
apiRouter.get('/api/stats', asyncHandler(async (req, res) => {
  const db = getDb();
  const stats = {
    accounts: db.prepare('SELECT COUNT(*) as count FROM accounts').get().count,
    campaigns: db.prepare('SELECT COUNT(*) as count FROM campaigns').get().count,
    pointsClaimed: db.prepare("SELECT SUM(points) as total FROM point_claim_history WHERE timestamp > datetime('now', '-1 day')").get().total || 0,
    uptime: process.uptime()
  };
  res.json(stats);
}));

// Accounts endpoints
apiRouter.get('/api/accounts', asyncHandler(async (req, res) => {
  const db = getDb();
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all();
  res.json(accounts);
}));

apiRouter.post('/api/accounts/:id/refresh', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }
  const newToken = await refreshAccessToken(
    account.refresh_token,
    process.env.TWITCH_CLIENT_ID || '',
    process.env.TWITCH_CLIENT_SECRET || ''
  );
  const expiresAt = Date.now() + (newToken.expires_in * 1000);
  db.prepare('UPDATE accounts SET access_token = ?, expires_at = ? WHERE id = ?').run(
    newToken.access_token,
    expiresAt,
    id
  );
  res.json({ success: true });
}));

apiRouter.delete('/api/accounts/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  res.json({ success: true });
}));

// Campaigns endpoint
apiRouter.get('/api/campaigns', asyncHandler(async (req, res) => {
  const db = getDb();
  const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
  res.json(campaigns);
}));

// Logs endpoint
apiRouter.get('/api/logs', asyncHandler(async (req, res) => {
  const { limit = 50 } = req.query;
  const db = getDb();
  const logs = db.prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?').all(Number(limit));
  res.json(logs);
}));

// Settings endpoints
apiRouter.get('/api/settings', asyncHandler(async (req, res) => {
  const db = getDb();
  const settings = db.prepare('SELECT * FROM settings').all();
  const settingsObj = settings.reduce((acc: any, s: any) => {
    acc[s.key] = s.value;
    return acc;
  }, {});
  res.json(settingsObj);
}));

apiRouter.post('/api/settings', asyncHandler(async (req, res) => {
  const { key, value } = req.body;
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  res.json({ success: true });
}));

// Betting stats endpoint
apiRouter.get('/api/betting-stats', asyncHandler(async (req, res) => {
  const stats = bettingService.getBettingStats();
  res.json(stats);
}));

// Streamer analysis endpoint
apiRouter.get('/api/streamer-analysis', asyncHandler(async (req, res) => {
  const db = getDb();
  const analysis = db.prepare(`
    SELECT 
      s.channel_name,
      COUNT(DISTINCT p.id) as total_bets,
      AVG(CASE WHEN p.status = 'won' THEN 1 ELSE 0 END) as win_rate
    FROM streamers s
    LEFT JOIN betting_predictions p ON p.streamer_id = s.id
    GROUP BY s.id
  `).all();
  res.json(analysis);
}));

export default apiRouter;
