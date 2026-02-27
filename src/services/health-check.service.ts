import { getDb } from '../core/database';
import { logInfo, logError, logDebug } from '../core/logger';
import { DropIndexerService } from './drop-indexer.service';
import { PointClaimerService } from './point-claimer.service';
import { ChatFarmerService } from './chat-farmer.service';
import { FollowedChannelsService } from './followed-channels.service';

/**
 * Health check result for a service
 */
interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  uptime: number;
  lastCheck: string;
  details: Record<string, unknown>;
}

/**
 * Overall system health status
 */
interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  services: ServiceHealth[];
  database: {
    status: 'healthy' | 'unhealthy';
    size: string;
    version: number;
  };
  memory: {
    used: string;
    total: string;
    percentage: number;
  };
}

/**
 * Service for monitoring health and providing metrics
 */
export class HealthCheckService {
  private services: Map<string, {
    instance: any;
    startTime: number;
    isActive: () => boolean;
  }> = new Map();
  
  private startTime: number;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Register a service for health monitoring
   */
  registerService(name: string, instance: any, isActiveFn: () => boolean): void {
    this.services.set(name, {
      instance,
      startTime: Date.now(),
      isActive: isActiveFn
    });
    
    logInfo(`Service registered for health monitoring: ${name}`);
  }

  /**
   * Unregister a service
   */
  unregisterService(name: string): void {
    this.services.delete(name);
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);
    
    logInfo('Periodic health checks started', { interval: intervalMs });
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Perform comprehensive health check
   */
  getSystemHealth(): SystemHealth {
    const serviceHealths: ServiceHealth[] = [];
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    let unhealthyCount = 0;
    let degradedCount = 0;

    // Check all registered services
    for (const [name, service] of this.services) {
      const health = this.checkService(name, service);
      serviceHealths.push(health);
      
      if (health.status === 'unhealthy') {
        unhealthyCount++;
        overallStatus = 'unhealthy';
      } else if (health.status === 'degraded') {
        degradedCount++;
        if (overallStatus !== 'unhealthy') {
          overallStatus = 'degraded';
        }
      }
    }

    // Check database
    const dbHealth = this.checkDatabase();
    if (dbHealth.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      services: serviceHealths,
      database: dbHealth,
      memory: this.getMemoryUsage()
    };
  }

  /**
   * Check individual service health
   */
  private checkService(name: string, service: {
    instance: any;
    startTime: number;
    isActive: () => boolean;
  }): ServiceHealth {
    const isActive = service.isActive();
    const uptime = Date.now() - service.startTime;
    
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    let details: Record<string, unknown> = {
      uptime,
      active: isActive
    };

    if (!isActive) {
      status = 'unhealthy';
    }

    // Service-specific health checks
    if (name === 'drop-indexer' && isActive) {
      const indexer = service.instance as DropIndexerService;
      const campaigns = indexer.getActiveCampaigns();
      details.campaignCount = campaigns.length;
      details.cacheSize = (service.instance as any).campaignCache?.size || 0;
    }
    
    if (name === 'point-claimer' && isActive) {
      const claimer = service.instance as PointClaimerService;
      const stats = claimer.getStats();
      details.totalClaims = stats.totalClaims;
      details.successRate = stats.totalClaims > 0 
        ? (stats.successfulClaims / stats.totalClaims * 100).toFixed(2) + '%'
        : 'N/A';
      details.averagePoints = stats.averagePointsPerClaim.toFixed(0);
    }
    
    if (name === 'chat-farmer' && isActive) {
      const farmer = service.instance as ChatFarmerService;
      details.activeConnections = (service.instance as any).contexts?.size || 0;
    }
    
    if (name === 'followed-channels' && isActive) {
      const channels = service.instance as FollowedChannelsService;
      details.lastSync = (service.instance as any).lastSyncTime || 'unknown';
    }

    return {
      name,
      status,
      uptime,
      lastCheck: new Date().toISOString(),
      details
    };
  }

  /**
   * Check database health
   */
  private checkDatabase(): { status: 'healthy' | 'unhealthy'; size: string; version: number } {
    try {
      const db = getDb();
      
      // Test database connection with a simple query
      const result = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
      
      // Get database size
      const size = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()')
        .get() as { size: number };
      
      // Get schema version
      const version = db.prepare('SELECT MAX(version) as version FROM schema_migrations')
        .get() as { version: number };
      
      return {
        status: 'healthy',
        size: this.formatBytes(size.size),
        version: version?.version || 0
      };
    } catch (error) {
      logError('Database health check failed', {}, error as Error);
      return {
        status: 'unhealthy',
        size: 'unknown',
        version: 0
      };
    }
  }

  /**
   * Get memory usage statistics
   */
  private getMemoryUsage(): { used: string; total: string; percentage: number } {
    const usage = process.memoryUsage();
    const total = process.memoryUsage().heapTotal;
    const used = process.memoryUsage().heapUsed;
    
    return {
      used: this.formatBytes(used),
      total: this.formatBytes(total),
      percentage: (used / total) * 100
    };
  }

  /**
   * Perform periodic health check and log results
   */
  private performHealthCheck(): void {
    const health = this.getSystemHealth();
    
    if (health.status === 'unhealthy') {
      logError('System health check failed', { health });
    } else if (health.status === 'degraded') {
      logInfo('System health check: degraded', { health });
    } else {
      logDebug('System health check: healthy', { health });
    }
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get service uptime
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Global health check service instance
 */
let healthCheckService: HealthCheckService | null = null;

export function initHealthCheckService(): HealthCheckService {
  if (!healthCheckService) {
    healthCheckService = new HealthCheckService();
  }
  return healthCheckService;
}

export function getHealthCheckService(): HealthCheckService | null {
  return healthCheckService;
}
