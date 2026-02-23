# Server Improvements Deployment Guide

## Critical Improvements Implemented (2026-02-23)

### 1. **TOKEN REFRESH** (CRITICAL) ✅
- **Problem:** Tokens expire after 4 hours, farming stops
- **Solution:** `refreshAccessToken()` function with automatic retry
- **Impact:** Farming continues indefinitely without manual intervention

### 2. **RETRY LOGIC** ✅
- **Problem:** API calls fail on rate limits (429) and temporary errors
- **Solution:** `fetchWithRetry()` with exponential backoff
- **Impact:** More reliable API calls, automatic recovery

### 3. **DATABASE INDEXES** ✅
- **Problem:** Slow queries on large datasets
- **Solution:** 4 indexes on frequently queried columns
  - `idx_followed_account_streamer` on followed_channels(account_id, streamer)
  - `idx_logs_time` on logs(time DESC)
  - `idx_claim_history_account_time` on point_claim_history(account_id, claimed_at DESC)
  - `idx_betting_streamer` on betting_stats(streamer)
- **Impact:** 10-100x faster queries

### 4. **CHAT RECONNECTION** ✅
- **Problem:** Chat clients don't reconnect on server restart
- **Solution:** Auto-reconnect on startup for all farming accounts
- **Impact:** Point farming resumes automatically

### 5. **LOG CLEANUP** ✅
- **Problem:** Logs grow indefinitely, slow down database
- **Solution:** Cron job runs daily at midnight
  - Deletes logs older than 30 days
  - Keeps only last 10,000 records
- **Impact:** Database stays fast and lean

### 6. **CONFIG VALIDATION** ✅
- **Problem:** Invalid settings can break application
- **Solution:** `validateSettings()` function checks:
  - maxBetPercentage: 1-20
  - concurrentStreams: 1-10
  - pointClaimInterval: 60-1800 seconds
  - dropAllocation: 10-50
- **Impact:** Prevents configuration errors

### 7. **ENHANCED ERROR HANDLING** ✅
- **Problem:** Cascading failures on API errors
- **Solution:** Circuit breaker pattern
  - Opens after 5 consecutive failures
  - Resets after 1 minute timeout
  - Better error messages with context
- **Impact:** Graceful degradation, prevents cascading failures

## Deployment Instructions

### Option 1: Manual Deployment to Tower

1. **Backup current server.ts:**
   ```bash
   ssh root@192.168.1.99
   cd /mnt/user/appdata/twitch-drops-miner
   cp server.ts server.ts.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. **Copy improved server.ts:**
   ```bash
   # From local machine to Tower
   scp server.ts root@192.168.1.99:/mnt/user/appdata/twitch-drops-miner/server.ts
   ```

3. **Restart container:**
   ```bash
   ssh root@192.168.1.99
   docker restart twitch-drops-miner
   ```

4. **Verify deployment:**
   ```bash
   # Check container is running
   docker ps | grep twitch-drops-miner
   
   # View logs for improvements
   docker logs -f twitch-drops-miner | grep -E "(Token Refresh|Circuit Breaker|indexes|reconnect)"
   ```

### Option 2: GitHub Pull

1. **Changes already committed to GitHub**
2. **On Tower:**
   ```bash
   ssh root@192.168.1.99
   cd /mnt/user/appdata/twitch-drops-miner
   git pull origin main
   docker restart twitch-drops-miner
   ```

## Verification Checklist

- [ ] Container restarts successfully
- [ ] Logs show: "Creating database indexes for performance..."
- [ ] Logs show: "CRITICAL IMPROVEMENTS: Token Refresh, Retry Logic..."
- [ ] Existing accounts reconnect automatically (check logs)
- [ ] API responds: `curl http://192.168.1.99:5173/api/stats`
- [ ] Point farming continues beyond 4 hours

## Testing Token Refresh

1. **Monitor logs for refresh events:**
   ```bash
   docker logs -f twitch-drops-miner | grep "refresh"
   ```

2. **Expected behavior:**
   - When token expires (401 error), automatic refresh occurs
   - "Access token refreshed successfully" message appears
   - Farming continues without interruption

## Monitoring

**Key log messages to watch:**
- "Access token refreshed successfully" - Token refresh working
- "Rate limited. Waiting X seconds" - Retry logic working
- "Circuit breaker opened" - API issues detected
- "Reconnected X chat clients on startup" - Reconnection working
- "Daily log cleanup completed" - Cleanup running

## Rollback Plan

If issues occur:
```bash
ssh root@192.168.1.99
cd /mnt/user/appdata/twitch-drops-miner
cp server.ts.backup.YYYYMMDD_HHMMSS server.ts
docker restart twitch-drops-miner
```

## Support

- Check logs: `docker logs -f twitch-drops-miner`
- API status: `curl http://192.168.1.99:5173/api/stats`
- Database: Check data/farm.db for indexes

