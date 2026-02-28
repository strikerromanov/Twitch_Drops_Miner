import { Queries } from '../core/database';
import { logInfo } from '../core/logger';
import dropIndexer from './drop-indexer.service';
import pointClaimer from './point-claimer.service';
import chatFarmer from './chat-farmer.service';
import followedChannels from './followed-channels.service';

class HealthCheckService {
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {}

  start() {
    logInfo('Starting Health Check Service...');
    this.intervalId = setInterval(() => this.checkHealth(), 60000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async checkHealth() {
    try {
      const accounts = Queries.getAllAccounts();
      logInfo(`Health check: ${accounts.length} accounts`);
    } catch (error: any) {
      logInfo(`Health check error: ${error.message}`);
    }
  }

  getStatus() {
    return {
      healthy: true,
      services: {
        dropIndexer: true,
        pointClaimer: true,
        chatFarmer: true,
        followedChannels: true
      }
    };
  }
}

export default new HealthCheckService();
