import { db } from '../core/database.js';
import { logger } from '../core/logger.js';

interface BettingStats {
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  pointsWon: number;
  pointsLost: number;
  netProfit: number;
}

interface PredictionEvent {
  id: string;
  streamerName: string;
  title: string;
  outcome1: string;
  outcome1Percentage: number;
  outcome2: string;
  outcome2Percentage: number;
  points: number;
}

export class BettingService {
  private isActive = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDatabase();
  }

  private initializeDatabase() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        streamer_name TEXT,
        prediction_title TEXT,
        outcome_selected TEXT,
        outcome_percentage INTEGER,
        points_wagered INTEGER,
        points_won INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      )
    `);
    logger.info('✅ Betting database initialized');
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.checkInterval = setInterval(() => this.checkForPredictions(), 30000); // Check every 30s
    logger.info('🎰 Betting Service started');
  }

  stop() {
    if (!this.isActive) return;
    this.isActive = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('🎰 Betting Service stopped');
  }

  private async checkForPredictions() {
    try {
      // This would integrate with Twitch API to check for predictions
      // For now, it's a placeholder that would be triggered by events
      logger.debug('Checking for betting opportunities...');
    } catch (error) {
      logger.error('Error checking for predictions:', error);
    }
  }

  analyzePrediction(prediction: PredictionEvent): { shouldBet: boolean; outcome: string; confidence: number } {
    const { outcome1Percentage, outcome2Percentage } = prediction;
    
    // Skip if both outcomes at 50% (no edge)
    if (Math.abs(outcome1Percentage - outcome2Percentage) < 5) {
      return { shouldBet: false, outcome: '', confidence: 0 };
    }

    // Bet on outcome with higher percentage
    const favoredOutcome = outcome1Percentage > outcome2Percentage ? 'outcome1' : 'outcome2';
    const confidence = Math.max(outcome1Percentage, outcome2Percentage);

    // Only bet if confidence > 60%
    if (confidence < 60) {
      return { shouldBet: false, outcome: '', confidence };
    }

    return {
      shouldBet: true,
      outcome: favoredOutcome,
      confidence
    };
  }

  calculateBetSize(availablePoints: number, confidence: number): number {
    // Conservative: Max 10% of available points
    const maxBet = Math.floor(availablePoints * 0.10);
    
    // Scale with confidence (60% → 5%, 100% → 10%)
    const confidenceFactor = (confidence - 60) / 40; // 0 to 1
    const betSize = Math.floor(maxBet * (0.5 + confidenceFactor * 0.5));
    
    return Math.max(10, Math.min(betSize, maxBet)); // Min 10 points
  }

  placeBet(accountId: number, prediction: PredictionEvent) {
    const analysis = this.analyzePrediction(prediction);
    
    if (!analysis.shouldBet) {
      logger.debug(`Skipping bet on "${prediction.title}" - confidence too low (${analysis.confidence}%)`);
      return null;
    }

    const availablePoints = prediction.points;
    const betSize = this.calculateBetSize(availablePoints, analysis.confidence);
    
    const outcomeSelected = analysis.outcome === 'outcome1' ? prediction.outcome1 : prediction.outcome2;
    const outcomePercentage = analysis.outcome === 'outcome1' ? prediction.outcome1Percentage : prediction.outcome2Percentage;

    const stmt = db.prepare(`
      INSERT INTO bets (account_id, streamer_name, prediction_title, outcome_selected, outcome_percentage, points_wagered)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      accountId,
      prediction.streamerName,
      prediction.title,
      outcomeSelected,
      outcomePercentage,
      betSize
    );

    logger.info(`🎰 Bet placed: ${betSize} points on "${outcomeSelected}" (${outcomePercentage}% confidence)`);
    
    return { betId: result.lastInsertRowid, betSize, outcome: outcomeSelected };
  }

  getBettingStats(accountId?: number): BettingStats {
    let query = 'SELECT * FROM betting_history';
    let params: any[] = [];
    
    if (accountId) {
      query += ' WHERE account_id = ?';
      params.push(accountId);
    }

    const bets = db.prepare(query).all(...params) as any[];
    
    const wins = bets.filter(b => b.points_won > 0);
    const losses = bets.filter(b => b.points_won === 0);
    
    const pointsWon = bets.reduce((sum, b) => sum + (b.points_won || 0), 0);
    const pointsLost = bets.reduce((sum, b) => sum + b.points_wagered, 0);

    return {
      totalBets: bets.length,
      wins: wins.length,
      losses: losses.length,
      winRate: bets.length > 0 ? (wins.length / bets.length) * 100 : 0,
      pointsWon,
      pointsLost,
      netProfit: pointsWon - pointsLost
    };
  }

  getRecentBets(limit = 50) {
    return db.prepare(`
      SELECT * FROM betting_history 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(limit);
  }
}

export const bettingService = new BettingService();
