import { Queries } from '../core/database';
import { logInfo, logError } from '../core/logger';

class ChatFarmerService {
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {}

  start() {
    logInfo('Starting Chat Farming Service...');
    this.intervalId = setInterval(() => this.farmChat(), 60000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async farmChat() {
    try {
      const accounts = Queries.getFarmingAccounts();
      if (!accounts || accounts.length === 0) return;
      logInfo(`Chat farming for ${accounts.length} accounts`);
    } catch (error: any) {
      logError(`Error farming chat: ${error.message}`);
    }
  }
}

export default new ChatFarmerService();
