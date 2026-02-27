# Authentication & Security Improvement Plan
## Agent 1 - Twitch_Drops_Miner

**Date:** 2026-02-28
**Project:** /a0/usr/workdir/Twitch_Drops_Miner
**Task:** Improve authentication system to support direct client ID authentication

---

## Executive Summary

After comprehensive code review, I found that **OAuth 2.0 Authorization Code flow is already properly implemented**. However, several critical issues exist that need immediate attention:

### Current State
- ✅ OAuth 2.0 Authorization Code flow implemented
- ✅ Token refresh mechanism exists
- ✅ Multi-account session management exists
- ✅ Client-ID headers in API services (drop-indexer, followed-channels)
- ⚠️ **BUG**: Service initialization missing Client-ID parameter
- ⚠️ Services using static tokens instead of account-specific tokens

---

## Issues Found

### 🔴 CRITICAL: Service Initialization Bug (server.ts:146)

**Location:** `server.ts`
**Issue:** FollowedChannelsIndexer initialized without required clientId parameter

```typescript
// CURRENT (BROKEN)
const followedIndexerService = new FollowedChannelsIndexer(db);

// SHOULD BE
const settings = db.prepare('SELECT * FROM settings').all();
const clientId = settings.find(s => s.key === 'twitchClientId')?.value || 
                 process.env.TWITCH_CLIENT_ID || '';
const followedIndexerService = new FollowedChannelsIndexer(db, clientId);
```

**Impact:** Service fails to initialize or uses undefined Client-ID for API calls

### 🟡 MEDIUM: Static Access Token Usage (followed-channels.service.ts)

**Location:** `src/services/followed-channels.service.ts`
**Issue:** Constructor receives static access_token, should use account-specific tokens

```typescript
// CURRENT (uses static token)
constructor(clientId: string, accessToken: string) {
  this.clientId = clientId;
  this.accessToken = accessToken; // ← Static token for all accounts!
}

// IMPROVED
constructor(private db: Database, private clientId: string) {
  // Remove static accessToken, use account tokens from DB
}

private getAccountToken(accountId: number): string {
  const account = this.db.prepare('SELECT access_token FROM accounts WHERE id = ?').get(accountId);
  return account?.access_token;
}
```

### 🟢 LOW: Missing Token Refresh Automation

**Issue:** Token refresh exists but no automated background refresh

---

## Implementation Plan

### Phase 1: Fix Critical Service Initialization (server.ts)

**File:** `server.ts`

1. Move settings fetch before service initialization
2. Get Client-ID from settings or environment
3. Pass Client-ID to FollowedChannelsIndexer constructor
4. Validate Client-ID before starting services

```typescript
// AFTER line 135 (database initialization)
console.log('Loading configuration from settings...');

const settings = db.prepare('SELECT * FROM settings').all() as any[];
const configClientId = settings.find(s => s.key === 'twitchClientId')?.value || '';
const envClientId = process.env.TWITCH_CLIENT_ID || '';

// Prefer settings table, fallback to environment
const clientId = configClientId || envClientId;

if (!clientId) {
  console.error('⚠️  TWITCH_CLIENT_ID not found in settings or environment');
  console.error('Services requiring Client-ID will not function properly');
} else {
  console.log('✅ Client-ID loaded from', configClientId ? 'settings' : 'environment');
}

// Initialize services with proper Client-ID
const followedIndexerService = new FollowedChannelsIndexer(db, clientId);
```

### Phase 2: Refactor FollowedChannelsService (followed-channels.service.ts)

**File:** `src/services/followed-channels.service.ts`

1. Remove static access_token from constructor
2. Add database dependency
3. Create helper to get account-specific tokens
4. Update all API calls to use account tokens

```typescript
export class FollowedChannelsService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private clientId: string;
  private db: Database; // ← Add database dependency

  constructor(db: Database, clientId: string) {
    this.db = db;
    this.clientId = clientId;
  }
  
  private getAccountToken(accountId: number): string {
    const account = this.db.prepare(
      'SELECT access_token FROM accounts WHERE id = ?'
    ).get(accountId) as { access_token: string } | undefined;
    
    if (!account?.access_token) {
      throw new Error(`No access token found for account ${accountId}`);
    }
    
    return account.access_token;
  }
  
  // Update all API calls:
  // Instead of: headers: { 'Authorization': `Bearer ${this.accessToken}` }
  // Use: headers: { 'Authorization': `Bearer ${this.getAccountToken(account.id)}` }
}
```

### Phase 3: Add Token Refresh Automation

**File:** `src/services/token-refresh.service.ts` (NEW)

Create automated token refresh service:

```typescript
import { Database } from 'better-sqlite3';
import { refreshAccessToken } from '../core/auth';
import { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } from '../core/config';

export class TokenRefreshService {
  private db: Database;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  
  constructor(db: Database) {
    this.db = db;
  }
  
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[TOKEN REFRESH] Starting automated token refresh service');
    
    // Check every 30 minutes
    this.intervalId = setInterval(() => {
      this.refreshExpiringTokens();
    }, 30 * 60 * 1000);
    
    // Initial check
    this.refreshExpiringTokens();
  }
  
  private async refreshExpiringTokens(): Promise<void> {
    const accounts = this.db.prepare(`
      SELECT id, username, refresh_token, token_expires_at
      FROM accounts
      WHERE refresh_token IS NOT NULL
      AND status = 'active'
    `).all() as any[];
    
    const now = Date.now();
    const refreshThreshold = 5 * 60 * 1000; // 5 minutes before expiry
    
    for (const account of accounts) {
      const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
      
      if (expiresAt - now < refreshThreshold) {
        try {
          console.log(`[TOKEN REFRESH] Refreshing token for ${account.username}`);
          
          const tokens = await refreshAccessToken(
            account.refresh_token,
            TWITCH_CLIENT_ID,
            TWITCH_CLIENT_SECRET
          );
          
          this.db.prepare(`
            UPDATE accounts 
            SET access_token = ?, 
                refresh_token = ?,
                token_expires_at = ?
            WHERE id = ?
          `).run(
            tokens.access_token,
            tokens.refresh_token,
            new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
            account.id
          );
          
          console.log(`[TOKEN REFRESH] ✅ Token refreshed for ${account.username}`);
        } catch (error) {
          console.error(`[TOKEN REFRESH] ❌ Failed to refresh token for ${account.username}:`, error);
        }
      }
    }
  }
  
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }
}
```

### Phase 4: Update Server Initialization (server.ts)

Add token refresh service initialization:

```typescript
import { TokenRefreshService } from './src/services/token-refresh.service.js';

// After other service initializations
const tokenRefreshService = new TokenRefreshService(db);
tokenRefreshService.start();

// Add to graceful shutdown
tokenRefreshService.stop();
```

### Phase 5: Add Client-ID Validation API

**File:** `src/api/routes.ts`

Add endpoint to validate Client-ID configuration:

```typescript
app.get('/api/auth/client-id-status', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all();
  const clientId = settings.find(s => s.key === 'twitchClientId')?.value || 
                   process.env.TWITCH_CLIENT_ID || '';
  
  const isValid = clientId && clientId.length > 0;
  
  res.json({
    configured: isValid,
    source: settings.find(s => s.key === 'twitchClientId')?.value ? 'settings' : 'environment',
    prefix: isValid ? clientId.substring(0, 8) + '...' : 'N/A'
  });
});
```

---

## Testing Plan

### 1. Service Initialization Test
```bash
npm run build
npm start
# Check logs for:
# - ✅ Client-ID loaded from settings/environment
# - ✅ Services initialized successfully
```

### 2. Token Refresh Test
```typescript
// Set token to expire in 2 minutes
UPDATE accounts 
SET token_expires_at = datetime('now', '+2 minutes')
WHERE id = 1;

// Wait 3 minutes, check token was refreshed
SELECT access_token, token_expires_at FROM accounts WHERE id = 1;
```

### 3. Multi-Account Token Test
```typescript
// Verify different accounts use different tokens
// POST /api/auth/callback for account1
// POST /api/auth/callback for account2
// Check followed-channels service uses correct tokens
```

---

## File Changes Summary

| File | Change | Severity |
|------|--------|----------|
| `server.ts` | Fix FollowedChannelsIndexer initialization | 🔴 CRITICAL |
| `src/services/followed-channels.service.ts` | Remove static token, use DB | 🟡 MEDIUM |
| `src/services/token-refresh.service.ts` | Create new service | 🟢 LOW |
| `src/api/routes.ts` | Add Client-ID status endpoint | 🟢 LOW |

---

## Rollback Plan

```bash
git add .
git commit -m "Authentication improvements - Client-ID and token refresh"
git tag auth-improvements-v1.0
```

If issues occur:
```bash
git checkout HEAD~1
# Or
git checkout auth-improvements-v1.0~1
```

---

## Success Criteria

- [ ] All services initialize without errors
- [ ] Client-ID properly loaded from settings or environment
- [ ] Each account uses its own access token
- [ ] Tokens refresh automatically before expiration
- [ ] API calls include proper Client-ID headers
- [ ] Multi-account authentication works correctly
- [ ] No authentication errors in logs
- [ ] Build completes successfully

---

## Notes

- OAuth 2.0 flow already implemented, no changes needed
- Point claimer and chat farmer use Playwright (no Client-ID needed)
- All API services (drop-indexer, followed-channels) already use Client-ID headers
- Main issue is service initialization bug
- Secondary issue is static vs account-specific tokens

---
**End of Plan**
