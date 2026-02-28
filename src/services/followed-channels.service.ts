import { Queries } from '../core/database';
import { logInfo, logError } from '../core/logger';

class FollowedChannelsService {
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {}

  start() {
    logInfo('Starting Followed Channels Service...');
    this.intervalId = setInterval(() => this.indexChannels(), 300000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async indexChannels() {
    try {
      const accounts = Queries.getFarmingAccounts();
      if (!accounts || accounts.length === 0) return;
      logInfo(`Indexing channels for ${accounts.length} accounts`);
    } catch (error: any) {
      logError(`Error indexing channels: ${error.message}`);
    }
  }
}

export default new FollowedChannelsService();
