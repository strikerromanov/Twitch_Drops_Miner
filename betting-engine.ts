// Event-Driven Betting Engine
// Places bets when opportunities arise, not on schedule
import Database from 'better-sqlite3';

interface BettingOpportunity {
  accountId: number;
  streamer: string;
  odds: number;
  potentialWin: number;
}

export class BettingEngine {
  private db: Database.Database;
  private enabled: boolean = false;
  private monitoringActive: boolean = false;
  
  constructor(db: Database.Database) {
    this.db = db;
  }

  initialize(): void {
    console.log('Betting Engine initialized (event-driven mode)');
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`Betting ${enabled ? 'enabled' : 'disabled'}`);
    
    if (enabled && !this.monitoringActive) {
      this.startMonitoring();
    }
  }

  startMonitoring(): void {
    if (this.monitoringActive) return;
    this.monitoringActive = true;
    console.log('🎰 Starting event-driven betting monitoring...');
    
    // Check for betting opportunities every 30 seconds
    setInterval(() => {
      if (this.enabled) {
        this.checkForOpportunities();
      }
    }, 30000);
  }

  async checkForOpportunities(): Promise<void> {
    try {
      // Get active farming accounts
      const accounts = this.db.prepare(`
        SELECT id FROM accounts WHERE status = "farming"
      `).all() as any[];
      
      for (const account of accounts) {
        await this.findAndPlaceBets(account.id);
      }
    } catch (error) {
      console.error('Error checking for betting opportunities:', error);
    }
  }

  async findAndPlaceBets(accountId: number): Promise<void> {
    // Get channels with active bets
    const channels = this.db.prepare(`
      SELECT streamer, points FROM followed_channels
      WHERE account_id = ? AND status = "farming" AND points > 100
      ORDER BY viewer_count DESC
    `).all(accountId) as any[];
    
    for (const channel of channels) {
      const opportunity = await this.analyzeOpportunity(accountId, channel.streamer);
      
      if (opportunity.shouldBet) {
        await this.placeBet(accountId, channel.streamer, opportunity.betAmount, opportunity.reason);
      }
    }
  }

  async analyzeOpportunity(accountId: number, streamer: string): Promise<any> {
    // Get streamer stats
    const stats = this.db.prepare(`
      SELECT * FROM betting_stats WHERE streamer = ?
    `).get(streamer) as any;
    
    if (!stats) {
      // New streamer - small test bet
      return {
        shouldBet: true,
        betAmount: 10,
        reason: 'Initial sample bet'
      };
    }
    
    const winRate = stats.wins / stats.totalBets;
    const avgProfit = stats.totalProfit / stats.totalBets;
    
    // Kelly Criterion calculation
    const calculatedKellyPercent = winRate - ((1 - winRate) / (stats.avgOdds || 2));
    const kellyPercent = Math.max(0, Math.min(0.25, calculatedKellyPercent)); // Cap at 25%
    
    // Get account points
    const accountPoints = this.db.prepare(`
      SELECT SUM(points) as total FROM followed_channels WHERE account_id = ?
    `).get(accountId) as any;
    
    const availablePoints = accountPoints.total || 0;
    const suggestedBet = Math.floor(availablePoints * kellyPercent);
    
    if (suggestedBet >= 50 && winRate >= 0.45) {
      return {
        shouldBet: true,
        betAmount: suggestedBet,
        reason: `Kelly Criterion (win rate: ${(winRate * 100).toFixed(1)}%)`
      };
    }
    
    return { shouldBet: false, betAmount: 0, reason: 'Unfavorable odds' };
  }

  async placeBet(accountId: number, streamer: string, amount: number, reason: string): Promise<void> {
    try {
      // Deduct points
      this.db.prepare(`
        UPDATE followed_channels SET points = points - ?
        WHERE account_id = ? AND streamer = ?
      `).run(amount, accountId, streamer);
      
      // Record bet
      this.db.prepare(`
        INSERT INTO betting_history (account_id, streamer, amount, bet_time, strategy)
        VALUES (?, ?, ?, datetime("now"), ?)
      `).run(accountId, streamer, amount, reason);
      
      console.log(`💰 Placed ${amount} point bet on ${streamer} (${reason})`);
      
      // Simulate bet result (in real implementation, this would wait for actual result)
      setTimeout(() => {
        this.resolveBet(accountId, streamer, amount);
      }, 60000); // Resolve after 1 minute
      
    } catch (error) {
      console.error(`Error placing bet on ${streamer}:`, error);
    }
  }

  async resolveBet(accountId: number, streamer: string, amount: number): Promise<void> {
    // Simulate bet result (70% win rate for simulation)
    const won = Math.random() > 0.3;
    const profit = won ? amount : -amount;
    
    // Update stats
    this.db.prepare(`
      UPDATE betting_stats
      SET totalBets = totalBets + 1,
          wins = wins + ?,
          totalProfit = totalProfit + ?
      WHERE streamer = ?
    `).run(won ? 1 : 0, profit, streamer);
    
    if (won) {
      // Add winnings
      this.db.prepare(`
        UPDATE followed_channels SET points = points + ?
        WHERE account_id = ? AND streamer = ?
      `).run(amount * 2, accountId, streamer);
      console.log(`🎉 Won ${amount * 2} points on ${streamer}!`);
    } else {
      console.log(`😞 Lost ${amount} points on ${streamer}`);
    }
  }
}
