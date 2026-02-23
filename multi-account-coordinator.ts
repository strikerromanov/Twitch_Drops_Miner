import Database from 'better-sqlite3';

interface StreamAllocation {
  streamer: string;
  game: string;
  viewerCount: number;
  allocatedAccounts: number[];
  maxAccounts: number;
}

export class MultiAccountCoordinator {
  private db: Database.Database;
  private globalStreamAssignments: Map<string, number[]> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeDatabase();
    this.loadExistingAssignments();
  }

  private initializeDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stream_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        streamer TEXT NOT NULL,
        account_id INTEGER NOT NULL,
        assigned_at TEXT NOT NULL,
        UNIQUE(streamer, account_id),
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_allocations_streamer ON stream_allocations(streamer);
      CREATE INDEX IF NOT EXISTS idx_allocations_account ON stream_allocations(account_id);
    `);
  }

  private loadExistingAssignments() {
    const allocations = this.db.prepare(
      'SELECT streamer, account_id FROM stream_allocations'
    ).all() as { streamer: string; account_id: number }[];

    this.globalStreamAssignments.clear();
    for (const allocation of allocations) {
      const current = this.globalStreamAssignments.get(allocation.streamer) || [];
      current.push(allocation.account_id);
      this.globalStreamAssignments.set(allocation.streamer, current);
    }

    console.log(`Loaded ${allocations.length} existing stream allocations`);
  }

  /**
   * Distribute streams across accounts to maximize unique coverage
   * Each stream can be watched by multiple accounts (for drops) but we balance the load
   */
  distributeStreams(accountId: number, availableStreams: any[]): string[] {
    const allocatedStreams: string[] = [];
    const maxAccountsPerStream = 3; // Allow up to 3 accounts per stream for drops
    const maxStreamsPerAccount = parseInt(this.db.prepare(
      "SELECT value FROM settings WHERE key = 'concurrentStreams'"
    ).get()?.value || '10');

    // Sort streams by viewer count (prefer high-viewer streams for points)
    const sortedStreams = [...availableStreams].sort((a, b) => b.viewer_count - a.viewer_count);

    for (const stream of sortedStreams) {
      if (allocatedStreams.length >= maxStreamsPerAccount) {
        break;
      }

      const currentAssignments = this.globalStreamAssignments.get(stream.streamer) || [];

      // Check if this account is already assigned to this stream
      if (currentAssignments.includes(accountId)) {
        allocatedStreams.push(stream.streamer);
        continue;
      }

      // Check if stream has reached maximum account assignments
      if (currentAssignments.length >= maxAccountsPerStream) {
        continue;
      }

      // Check if this account is watching too many streams
      const accountStreamCount = Array.from(this.globalStreamAssignments.values())
        .filter(accounts => accounts.includes(accountId)).length;

      if (accountStreamCount >= maxStreamsPerAccount) {
        continue;
      }

      // Assign this stream to the account
      this.assignStreamToAccount(accountId, stream.streamer);
      allocatedStreams.push(stream.streamer);
    }

    return allocatedStreams;
  }

  /**
   * Assign a stream to an account and record it
   */
  private assignStreamToAccount(accountId: number, streamer: string) {
    const current = this.globalStreamAssignments.get(streamer) || [];
    current.push(accountId);
    this.globalStreamAssignments.set(streamer, current);

    // Record in database
    this.db.prepare(
      'INSERT OR REPLACE INTO stream_allocations (streamer, account_id, assigned_at) VALUES (?, ?, ?)'
    ).run(streamer, accountId, new Date().toISOString());

    console.log(`Assigned ${streamer} to account ${accountId}`);
  }

  /**
   * Remove an account from all stream assignments
   */
  removeAccountFromStreams(accountId: number) {
    this.db.prepare('DELETE FROM stream_allocations WHERE account_id = ?').run(accountId);

    // Update in-memory assignments
    for (const [streamer, accounts] of this.globalStreamAssignments.entries()) {
      const filtered = accounts.filter(id => id !== accountId);
      if (filtered.length > 0) {
        this.globalStreamAssignments.set(streamer, filtered);
      } else {
        this.globalStreamAssignments.delete(streamer);
      }
    }

    console.log(`Removed account ${accountId} from all stream assignments`);
  }

  /**
   * Get optimal stream allocation for an account based on current assignments
   */
  getOptimalAllocation(accountId: number, allStreams: any[]): string[] {
    const assignedStreams = this.db.prepare(
      'SELECT streamer FROM stream_allocations WHERE account_id = ?'
    ).all(accountId).map(row => (row as any).streamer);

    if (assignedStreams.length === 0) {
      return this.distributeStreams(accountId, allStreams);
    }

    // Verify assigned streams are still live
    const liveStreamers = new Set(allStreams.map(s => s.streamer));
    const validAssignments = assignedStreams.filter(s => liveStreamers.has(s));

    // Clean up dead assignments
    for (const streamer of assignedStreams) {
      if (!liveStreamers.has(streamer)) {
        this.removeStreamAssignment(accountId, streamer);
      }
    }

    return validAssignments;
  }

  /**
   * Remove a specific stream assignment
   */
  private removeStreamAssignment(accountId: number, streamer: string) {
    this.db.prepare(
      'DELETE FROM stream_allocations WHERE account_id = ? AND streamer = ?'
    ).run(accountId, streamer);

    const current = this.globalStreamAssignments.get(streamer) || [];
    const filtered = current.filter(id => id !== accountId);
    
    if (filtered.length > 0) {
      this.globalStreamAssignments.set(streamer, filtered);
    } else {
      this.globalStreamAssignments.delete(streamer);
    }
  }

  /**
   * Get statistics about current allocations
   */
  getAllocationStats() {
    const totalAllocations = this.db.prepare(
      'SELECT COUNT(*) as count FROM stream_allocations'
    ).get() as { count: number };

    const uniqueStreams = this.db.prepare(
      'SELECT COUNT(DISTINCT streamer) as count FROM stream_allocations'
    ).get() as { count: number };

    const accountsAllocated = this.db.prepare(
      'SELECT COUNT(DISTINCT account_id) as count FROM stream_allocations'
    ).get() as { count: number };

    return {
      totalAllocations: totalAllocations.count,
      uniqueStreams: uniqueStreams.count,
      accountsAllocated: accountsAllocated.count
    };
  }

  /**
   * Clean up old assignments (older than 24 hours)
   */
  cleanupOldAssignments() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const result = this.db.prepare(
      'DELETE FROM stream_allocations WHERE assigned_at < ?'
    ).run(oneDayAgo);

    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} old stream allocations`);
      this.loadExistingAssignments();
    }
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup() {
    this.updateInterval = setInterval(() => {
      this.cleanupOldAssignments();
    }, 60 * 60 * 1000); // Every hour
  }

  stopPeriodicCleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}
