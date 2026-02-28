import { Queries } from '../core/database';
import { logInfo, logError } from '../core/logger';

class PointClaimerService {
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {}

  start() {
    logInfo('Starting Point Claimer Service...');
    this.intervalId = setInterval(() => this.claimPoints(), 60000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async claimPoints() {
    try {
      const accounts = Queries.getFarmingAccounts();
      if (!accounts || accounts.length === 0) return;
      logInfo(`Claiming points for ${accounts.length} accounts`);
    } catch (error: any) {
      logError(`Error claiming points: ${error.message}`);
    }
  }
}

export default new PointClaimerService();
