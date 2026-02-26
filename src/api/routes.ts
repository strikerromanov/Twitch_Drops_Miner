import { Router, Request, Response } from 'express';
import { Queries, getDb } from '../core/database';
import { logInfo, logError, logWarn } from '../core/logger';
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

apiRouter.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  try {
    const totalAccounts = getDb().prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
    const activeAccounts = getDb().prepare("SELECT COUNT(*) as count FROM accounts WHERE status = 'active'").get() as { count: number };
    const totalDrops = getDb().prepare('SELECT COUNT(*) as count FROM drop_campaigns').get() as { count: number };
    const activeDrops = getDb().prepare("SELECT COUNT(*) as count FROM drop_campaigns WHERE status = 'active'").get() as { count: number };
    const claimedDrops = getDb().prepare("SELECT COUNT(*) as count FROM drop_campaigns WHERE status = 'claimed'").get() as { count: number };
    const activeStreams = getDb().prepare('SELECT COUNT(*) as count FROM active_streams').get() as { count: number };
    const recentClaims = getDb().prepare('SELECT COUNT(*) as count FROM point_claim_history WHERE claimed_at > datetime("now", "-1 hour")').get() as { count: number };

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
    const result = insertAccount.run(username, access_token, refresh_token, user_id);

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
