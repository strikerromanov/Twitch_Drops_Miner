import { Router, Request, Response } from 'express';
import { Queries, getDb, clearCache } from '../core/database';
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

export const apiRouter = Router();

const asyncHandler = (fn: Function) => (req: Request, res: Response, next: Function) => {
  Promise.resolve(fn(req, res, next)).catch((err) => next(err));
};

// ============================================
// OAUTH ENDPOINTS
// ============================================

/**
 * Generate Twitch OAuth authorization URL
 * GET /auth/twitch
 */
apiRouter.get('/auth/twitch', asyncHandler(async (req: Request, res: Response) => {
  try {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const redirectUri = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/callback';

    if (!clientId) {
      return res.status(500).json({ error: 'TWITCH_CLIENT_ID not configured' });
    }

    const authUrl = generateAuthUrl(clientId, redirectUri);
    logInfo('OAuth authorization URL generated');
    res.json({ authUrl });
  } catch (error) {
    logError('Failed to generate auth URL', {}, error as Error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
}));

/**
 * Handle OAuth callback and exchange code for tokens
 * POST /auth/callback
 */
apiRouter.post('/auth/callback', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    const redirectUri = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/callback';

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'OAuth credentials not configured' });
    }

    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);

    // Get user info using access token
    const userInfo = await getUserInfo(tokenResponse.access_token);

    if (!userInfo) {
      return res.status(500).json({ error: 'Failed to fetch user information' });
    }

    // Check if account already exists
    const existingAccount = Queries.getAccountByUserId(userInfo.id).get() as Account | undefined;

    // Calculate token expiration timestamp (Unix epoch seconds)
    const expiresAt = Math.floor(Date.now() / 1000) + tokenResponse.expires_in;

    if (existingAccount) {
      // Update existing account
      const now = new Date().toISOString();
      Queries.updateAccount().run(
        existingAccount.status,
        now,
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        expiresAt,
        existingAccount.id
      );

      logInfo('Account updated via OAuth', {
        accountId: existingAccount.id,
        username: userInfo.display_name
      });

      res.json({
        success: true,
        account: {
          id: existingAccount.id,
          username: userInfo.display_name,
          user_id: userInfo.id,
          isNew: false
        }
      });
    } else {
      // Insert new account
      const insertAccount = Queries.insertAccount();
      const result = insertAccount.run(
        userInfo.display_name,
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        userInfo.id,
        expiresAt
      );

      const newAccount = Queries.getAccountById(result.lastInsertRowid as number).get() as Account;
      logInfo('Account added via OAuth', {
        accountId: newAccount.id,
        username: userInfo.display_name
      });

      res.status(201).json({
        success: true,
        account: {
          id: newAccount.id,
          username: userInfo.display_name,
          user_id: userInfo.id,
          isNew: true
        }
      });
    }
  } catch (error) {
    logError('OAuth callback failed', { body: req.body }, error as Error);
    res.status(500).json({ error: 'OAuth authentication failed' });
  }
}));

/**
 * Refresh access token
 * POST /auth/refresh
 */
apiRouter.post('/auth/refresh', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'OAuth credentials not configured' });
    }

    // Get account from database
    const account = Queries.getAccountById(accountId).get() as Account | undefined;

    if (!account || !account.refresh_token) {
      return res.status(404).json({ error: 'Account not found or no refresh token available' });
    }

    // Refresh the token
    const tokenResponse = await refreshAccessToken(account.refresh_token, clientId, clientSecret);

    // Calculate new expiration timestamp
    const expiresAt = Math.floor(Date.now() / 1000) + tokenResponse.expires_in;

    // Update account with new tokens
    const now = new Date().toISOString();
    Queries.updateAccount().run(
      account.status,
      now,
      tokenResponse.access_token,
      tokenResponse.refresh_token,
      expiresAt,
      account.id
    );

    logInfo('Token refreshed successfully', { accountId: account.id, username: account.username });
    res.json({
      success: true,
      expiresAt
    });
  } catch (error) {
    logError('Token refresh failed', { body: req.body }, error as Error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
}));

/**
 * Get current authentication status
 * GET /auth/status
 */
apiRouter.get('/auth/status', asyncHandler(async (req: Request, res: Response) => {
  try {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const redirectUri = process.env.TWITCH_REDIRECT_URI;

    const status = {
      configured: !!(clientId && redirectUri),
      redirectUri: redirectUri || null,
      hasCredentials: !!process.env.TWITCH_CLIENT_SECRET
    };

    res.json(status);
  } catch (error) {
    logError('Failed to get auth status', {}, error as Error);
    res.status(500).json({ error: 'Failed to get auth status' });
  }
}));

// ============================================
// EXISTING ENDPOINTS
// ============================================

apiRouter.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  try {
    const totalAccounts = getDb().prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
    const activeAccounts = getDb().prepare("SELECT COUNT(*) as count FROM accounts WHERE status = 'active'").get() as { count: number };
    const totalDrops = getDb().prepare('SELECT COUNT(*) as count FROM drop_campaigns').get() as { count: number };
    const activeDrops = getDb().prepare("SELECT COUNT(*) as count FROM drop_campaigns WHERE status = 'active'").get() as { count: number };
    const claimedDrops = getDb().prepare("SELECT COUNT(*) as count FROM drop_campaigns WHERE status = 'claimed'").get() as { count: number };
    const activeStreams = getDb().prepare('SELECT COUNT(*) as count FROM active_streams').get() as { count: number };
    const recentClaims = getDb().prepare('SELECT COUNT(*) as count FROM point_claim_history WHERE claimed_at > datetime('now', '-1 hour')').get() as { count: number };

    const stats = {
      activeAccounts: activeAccounts.count,
      totalAccounts: totalAccounts.count,
      totalDrops: totalDrops.count,
      activeDrops: activeDrops.count,
      claimedDrops: claimedDrops.count,
      activeStreams: activeStreams.count,
      recentClaims: recentClaims.count,
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    logError('Failed to fetch stats', {}, error as Error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
}));

apiRouter.get('/logs', asyncHandler(async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const level = req.query.level as string | undefined;
    const type = req.query.type as string | undefined;

    let query = 'SELECT * FROM logs';
    const params: any[] = [];
    const conditions: string[] = [];

    if (level) {
      conditions.push(' level = ?');
      params.push(level);
    }

    if (type) {
      conditions.push(' type = ?');
      params.push(type);
    }

    if (conditions.length > 0) {
      query += ' WHERE' + conditions.join(' AND');
    }

    query += ' ORDER BY time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = getDb().prepare(query).all(...params) as Log[];
    res.json({ logs, limit, offset });
  } catch (error) {
    logError('Failed to fetch logs', {}, error as Error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
}));

apiRouter.get('/accounts', asyncHandler(async (req: Request, res: Response) => {
  try {
    const accounts = Queries.getAccounts().all() as Account[];
    res.json(accounts);
  } catch (error) {
    logError('Failed to fetch accounts', {}, error as Error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
}));

apiRouter.post('/accounts', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { username, access_token, refresh_token, user_id } = req.body;

    if (!access_token || !refresh_token || !user_id) {
      return res.status(400).json({ error: 'Missing required fields: access_token, refresh_token, user_id' });
    }

    const insertAccount = Queries.insertAccount();
    const result = insertAccount.run(username, access_token, refresh_token, user_id, null);

    const account = Queries.getAccountById(result.lastInsertRowid as number).get() as Account;
    logInfo('Account added', { accountId: account.id, username });
    res.status(201).json(account);
  } catch (error) {
    logError('Failed to add account', { body: req.body }, error as Error);
    res.status(500).json({ error: 'Failed to add account' });
  }
}));

apiRouter.delete('/accounts/:id', asyncHandler(async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.id);

    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const account = Queries.getAccountById(accountId).get() as Account | undefined;

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    getDb().prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
    logInfo('Account deleted', { accountId, username: account.username });
    res.json({ success: true });
  } catch (error) {
    logError('Failed to delete account', { accountId: req.params.id }, error as Error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
}));

apiRouter.get('/settings', asyncHandler(async (req: Request, res: Response) => {
  try {
    const settings = Queries.getAllSettings().all() as Setting[];
    const settingsObj: Record<string, string> = {};

    for (const setting of settings) {
      settingsObj[setting.key] = setting.value;
    }

    res.json(settingsObj);
  } catch (error) {
    logError('Failed to fetch settings', {}, error as Error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
}));

apiRouter.put('/settings', asyncHandler(async (req: Request, res: Response) => {
  try {
    const settings = req.body;

    if (typeof settings !== 'object' || settings === null) {
      return res.status(400).json({ error: 'Invalid settings object' });
    }

    const setSetting = Queries.setSetting();

    for (const [key, value] of Object.entries(settings)) {
      setSetting.run(key, String(value));
    }

    logInfo('Settings updated', { keys: Object.keys(settings) });
    res.json({ success: true });
  } catch (error) {
    logError('Failed to update settings', { body: req.body }, error as Error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
}));

apiRouter.get('/campaigns', asyncHandler(async (req: Request, res: Response) => {
  try {
    const campaigns = Queries.getActiveCampaigns().all() as DropCampaign[];
    res.json(campaigns);
  } catch (error) {
    logError('Failed to fetch campaigns', {}, error as Error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
}));

apiRouter.get('/streamer-analysis', asyncHandler(async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const stats = getDb().prepare(`
      SELECT * FROM betting_stats
      ORDER BY totalProfit DESC
      LIMIT ?
    `).all(limit) as BettingStats[];
    res.json(stats);
  } catch (error) {
    logError('Failed to fetch streamer analysis', {}, error as Error);
    res.status(500).json({ error: 'Failed to fetch streamer analysis' });
  }
}));

apiRouter.get('/betting-stats', asyncHandler(async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const history = Queries.getBettingHistory(limit).all();
    res.json(history);
  } catch (error) {
    logError('Failed to fetch betting stats', {}, error as Error);
    res.status(500).json({ error: 'Failed to fetch betting stats' });
  }
}));

apiRouter.get('/followed-channels', asyncHandler(async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.query.account_id as string);
    const status = req.query.status as string | undefined;

    if (!accountId) {
      return res.status(400).json({ error: 'account_id parameter required' });
    }

    let query = 'SELECT * FROM followed_channels WHERE account_id = ?';
    const params: any[] = [accountId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    const channels = getDb().prepare(query).all(...params) as FollowedChannel[];
    res.json(channels);
  } catch (error) {
    logError('Failed to fetch followed channels', {}, error as Error);
    res.status(500).json({ error: 'Failed to fetch followed channels' });
  }
}));

apiRouter.get('/point-history', asyncHandler(async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.query.account_id as string);
    const limit = parseInt(req.query.limit as string) || 50;

    if (!accountId) {
      return res.status(400).json({ error: 'account_id parameter required' });
    }

    const history = getDb().prepare(`
      SELECT * FROM point_claim_history
      WHERE account_id = ?
      ORDER BY claimed_at DESC
      LIMIT ?
    `).all(accountId, limit) as PointClaimHistory[];
    res.json(history);
  } catch (error) {
    logError('Failed to fetch point history', {}, error as Error);
    res.status(500).json({ error: 'Failed to fetch point history' });
  }
}));

apiRouter.use((error: any, req: Request, res: Response, next: Function) => {
  logError('API Error', {
    method: req.method,
    url: req.url,
    error: error.message
  }, error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

import { initHealthCheckService, getHealthCheckService } from '../services/health-check.service';

// Initialize health check service
const healthCheck = initHealthCheckService();

/**
 * Health check endpoints
 */
apiRouter.get('/api/health', (req, res) => {
  try {
    const health = healthCheck.getSystemHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve health status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Individual service health check
 */
apiRouter.get('/api/health/:service', (req, res) => {
  try {
    const serviceName = req.params.service;
    const health = healthCheck.getSystemHealth();
    const service = health.services.find(s => s.name === serviceName);
    
    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: `Service '${serviceName}' not found or not registered`
      });
    }
    
    res.json(service);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve service health',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Database health check
 */
apiRouter.get('/api/health/database', (req, res) => {
  try {
    const db = getDb();
    const size = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()')
      .get() as { size: number };
    
    const version = db.prepare('SELECT MAX(version) as version FROM schema_migrations')
      .get() as { version: number };
    
    // Test performance with a simple query
    const start = Date.now();
    const accountCount = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
    const queryTime = Date.now() - start;
    
    res.json({
      status: 'healthy',
      size: `${(size.size / 1024 / 1024).toFixed(2)} MB`,
      version: version?.version || 0,
      accountCount: accountCount.count,
      queryTimeMs: queryTime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      message: 'Database health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Performance metrics endpoint
 */
apiRouter.get('/api/metrics', (req, res) => {
  try {
    const health = healthCheck.getSystemHealth();
    const db = getDb();
    
    // Get drop progress stats
    const progressStats = db.prepare(`
      SELECT 
        COUNT(*) as total_progress,
        SUM(current_minutes) as total_minutes,
        AVG(current_minutes) as avg_minutes
      FROM drop_progress
    `).get() as any;
    
    // Get claim stats
    const claimStats = db.prepare(`
      SELECT 
        COUNT(*) as total_claims,
        SUM(points_claimed) as total_points,
        MAX(claimed_at) as last_claim
      FROM point_claim_history
    `).get() as any;
    
    // Get campaign stats
    const campaignStats = db.prepare(`
      SELECT 
        COUNT(*) as total_campaigns,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_campaigns
      FROM drop_campaigns
    `).get() as any;
    
    res.json({
      timestamp: new Date().toISOString(),
      uptime: health.uptime,
      memory: health.memory,
      services: health.services,
      drops: {
        totalCampaigns: campaignStats.total_campaigns || 0,
        activeCampaigns: campaignStats.active_campaigns || 0,
        totalProgress: progressStats.total_progress || 0,
        totalMinutes: progressStats.total_minutes || 0,
        avgMinutes: progressStats.avg_minutes?.toFixed(2) || '0.00'
      },
      points: {
        totalClaims: claimStats.total_claims || 0,
        totalPoints: claimStats.total_points || 0,
        lastClaim: claimStats.last_claim || null
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve metrics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Clear database cache endpoint
 */
apiRouter.post('/api/cache/clear', (req, res) => {
  try {
    clearCache();
    res.json({
      status: 'success',
      message: 'Database cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear cache',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
