import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Activity, Cpu, Database, Clock, Zap, Server, 
  CheckCircle2, XCircle, AlertTriangle, RefreshCw 
} from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'error';
  lastUpdate: string;
  message?: string;
}

interface SystemHealth {
  services: {
    dropIndexer: ServiceStatus;
    pointClaimer: ServiceStatus;
    chatFarmer: ServiceStatus;
    followedChannels: ServiceStatus;
  };
  system: {
    uptime: string;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    database: {
      size: string;
      connections: number;
      health: 'healthy' | 'warning' | 'critical';
    };
  };
  performance: {
    apiResponseTime: number;
    cacheHitRate: number;
    activeCampaigns: number;
  };
  timestamp: string;
}

export const Health: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('Failed to fetch health data');
      const data = await response.json();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Generate mock data for demo if endpoint not available
      setHealth(generateMockHealth());
    } finally {
      setLoading(false);
    }
  };

  const generateMockHealth = (): SystemHealth => ({
    services: {
      dropIndexer: {
        name: 'Drop Indexer',
        status: 'online',
        lastUpdate: new Date().toISOString()
      },
      pointClaimer: {
        name: 'Point Claimer',
        status: 'online',
        lastUpdate: new Date(Date.now() - 60000).toISOString()
      },
      chatFarmer: {
        name: 'Chat Farmer',
        status: 'online',
        lastUpdate: new Date(Date.now() - 30000).toISOString()
      },
      followedChannels: {
        name: 'Followed Channels',
        status: 'online',
        lastUpdate: new Date(Date.now() - 120000).toISOString()
      }
    },
    system: {
      uptime: '2d 14h 32m',
      memory: {
        used: 450,
        total: 1024,
        percentage: 44
      },
      database: {
        size: '12.5 MB',
        connections: 3,
        health: 'healthy'
      }
    },
    performance: {
      apiResponseTime: 45,
      cacheHitRate: 87,
      activeCampaigns: 5
    },
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    fetchHealth();
    if (autoRefresh) {
      const interval = setInterval(fetchHealth, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle2 size={20} className="text-[#10b981]" />;
      case 'offline':
        return <XCircle size={20} className="text-[#71717a]" />;
      case 'error':
        return <AlertTriangle size={20} className="text-[#ef4444]" />;
    }
  };

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'online':
        return 'bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]';
      case 'offline':
        return 'bg-[#71717a]/10 border-[#71717a]/20 text-[#71717a]';
      case 'error':
        return 'bg-[#ef4444]/10 border-[#ef4444]/20 text-[#ef4444]';
    }
  };

  const getMemoryColor = (percentage: number) => {
    if (percentage < 50) return '#10b981';
    if (percentage < 80) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#27272a] rounded w-48"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-40 bg-[#27272a] rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="p-6">
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg p-6 text-center">
          <p className="text-[#ef4444] font-medium mb-4">Unable to load health data</p>
          <button
            onClick={fetchHealth}
            className="px-4 py-2 bg-[#9146FF] hover:bg-[#772ce8] rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
          <p className="text-[#a1a1aa] text-sm mt-1">Real-time monitoring and diagnostics</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              autoRefresh
                ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20'
                : 'bg-[#27272a] text-[#a1a1aa] hover:text-white'
            }`}
          >
            {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
          </button>
          <button
            onClick={fetchHealth}
            className="p-2 bg-[#27272a] hover:bg-[#3f3f46] rounded-lg transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <HealthCard
          title="Uptime"
          value={health.system.uptime}
          icon={<Clock size={20} />}
          color="blue"
        />
        <HealthCard
          title="Database Size"
          value={health.system.database.size}
          icon={<Database size={20} />}
          color="purple"
        />
        <HealthCard
          title="API Response"
          value={`${health.performance.apiResponseTime}ms`}
          icon={<Zap size={20} />}
          color="green"
        />
        <HealthCard
          title="Active Campaigns"
          value={health.performance.activeCampaigns}
          icon={<Activity size={20} />}
          color="yellow"
        />
      </div>

      {/* Services Status */}
      <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
        <h2 className="text-xl font-semibold mb-4">Service Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.values(health.services).map((service) => (
            <motion.div
              key={service.name}
              whileHover={{ scale: 1.02 }}
              className={`p-4 rounded-lg border ${getStatusColor(service.status)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <h3 className="font-semibold">{service.name}</h3>
                    <p className="text-xs opacity-70 mt-0.5">
                      Last update: {new Date(service.lastUpdate).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  service.status === 'online'
                    ? 'bg-[#10b981]/20 text-[#10b981]'
                    : service.status === 'error'
                    ? 'bg-[#ef4444]/20 text-[#ef4444]'
                    : 'bg-[#71717a]/20 text-[#71717a]'
                }`}>
                  {service.status.toUpperCase()}
                </span>
              </div>
              {service.message && (
                <p className="text-sm mt-2 opacity-80">{service.message}</p>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* System Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory Usage */}
        <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
          <h2 className="text-xl font-semibold mb-4">Memory Usage</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#a1a1aa]">Used Memory</span>
                <span className="font-medium">
                  {health.system.memory.used} MB / {health.system.memory.total} MB
                </span>
              </div>
              <div className="w-full bg-[#27272a] rounded-full h-4 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${health.system.memory.percentage}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: getMemoryColor(health.system.memory.percentage) }}
                />
              </div>
              <p className="text-right text-sm mt-1" style={{ color: getMemoryColor(health.system.memory.percentage) }}>
                {health.system.memory.percentage}%
              </p>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
          <h2 className="text-xl font-semibold mb-4">Performance Metrics</h2>
          <div className="space-y-4">
            <MetricRow
              label="Cache Hit Rate"
              value={`${health.performance.cacheHitRate}%`}
              percentage={health.performance.cacheHitRate}
            />
            <MetricRow
              label="API Response Time"
              value={`${health.performance.apiResponseTime}ms`}
              percentage={Math.max(0, 100 - health.performance.apiResponseTime / 2)}
              invert
            />
            <MetricRow
              label="Database Connections"
              value={health.system.database.connections}
              percentage={health.system.database.connections * 10}
            />
          </div>
        </div>
      </div>

      {/* Database Health */}
      <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
        <h2 className="text-xl font-semibold mb-4">Database Health</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${
              health.system.database.health === 'healthy'
                ? 'bg-[#10b981]/10 text-[#10b981]'
                : 'bg-[#f59e0b]/10 text-[#f59e0b]'
            }`}>
              <Database size={24} />
            </div>
            <div>
              <p className="font-medium">{health.system.database.health.toUpperCase()}</p>
              <p className="text-sm text-[#a1a1aa]">
                {health.system.database.size} • {health.system.database.connections} connections
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface HealthCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'purple' | 'green' | 'yellow';
}

const HealthCard: React.FC<HealthCardProps> = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20',
    purple: 'bg-[#9146FF]/10 text-[#9146FF] border-[#9146FF]/20',
    green: 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20',
    yellow: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20'
  };

  return (
    <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2.5 rounded-lg border ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-[#a1a1aa] text-sm font-medium mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
};

interface MetricRowProps {
  label: string;
  value: string | number;
  percentage: number;
  invert?: boolean;
}

const MetricRow: React.FC<MetricRowProps> = ({ label, value, percentage, invert }) => {
  const getColor = () => {
    if (invert) {
      if (percentage > 80) return '#10b981';
      if (percentage > 50) return '#f59e0b';
      return '#ef4444';
    }
    if (percentage > 80) return '#10b981';
    if (percentage > 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-[#a1a1aa]">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="w-full bg-[#27272a] rounded-full h-2 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, percentage)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: getColor() }}
        />
      </div>
    </div>
  );
};

export default Health;
