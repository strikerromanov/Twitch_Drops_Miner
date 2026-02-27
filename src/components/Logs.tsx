import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from './WebSocketProvider';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, Download, Search, Filter, AlertCircle, 
  Info, AlertTriangle, ChevronDown, ChevronUp, Trash2 
} from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  source?: string;
}

interface LogStats {
  total: number;
  byLevel: Record<string, number>;
  commonErrors: Array<{ message: string; count: number }>;
}

export const Logs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogEntry['level'] | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [stats, setStats] = useState<LogStats>({ total: 0, byLevel: {}, commonErrors: [] });
  const [isStatsOpen, setIsStatsOpen] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { connected } = useWebSocket();

  // Add log entry
  const addLog = (entry: LogEntry) => {
    setLogs(prev => {
      const newLogs = [...prev, entry].slice(-1000); // Keep last 1000 logs
      return newLogs;
    });
  };

  // Filter logs based on level and search query
  useEffect(() => {
    let filtered = logs;

    if (levelFilter !== 'ALL') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(query) ||
        log.source?.toLowerCase().includes(query)
      );
    }

    setFilteredLogs(filtered);
  }, [logs, levelFilter, searchQuery]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  // Calculate statistics
  useEffect(() => {
    const byLevel: Record<string, number> = { INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 };
    const errorMap = new Map<string, number>();

    logs.forEach(log => {
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;
      
      if (log.level === 'ERROR') {
        const key = log.message.substring(0, 100);
        errorMap.set(key, (errorMap.get(key) || 0) + 1);
      }
    });

    const commonErrors = Array.from(errorMap.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setStats({
      total: logs.length,
      byLevel,
      commonErrors
    });
  }, [logs]);

  // WebSocket message handling for real-time logs
  useEffect(() => {
    if (!connected) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'LOG_ENTRY') {
          addLog({
            id: Math.random().toString(36).substring(7),
            timestamp: data.timestamp || new Date().toISOString(),
            level: data.level || 'INFO',
            message: data.message || '',
            source: data.source
          });
        }
      } catch (e) {
        console.error('Failed to parse log message:', e);
      }
    };

    (window as any).__logsMessageHandler = handleMessage;

    return () => {
      delete (window as any).__logsMessageHandler;
    };
  }, [connected]);

  // Generate initial mock logs for demo
  useEffect(() => {
    const mockLogs: LogEntry[] = [
      { id: '1', timestamp: new Date(Date.now() - 3600000).toISOString(), level: 'INFO', message: 'System initialized successfully', source: 'System' },
      { id: '2', timestamp: new Date(Date.now() - 3000000).toISOString(), level: 'INFO', message: 'Connected to Twitch API', source: 'API' },
      { id: '3', timestamp: new Date(Date.now() - 2400000).toISOString(), level: 'DEBUG', message: 'Fetching drop campaigns', source: 'DropIndexer' },
      { id: '4', timestamp: new Date(Date.now() - 1800000).toISOString(), level: 'WARN', message: 'Rate limit approaching', source: 'API' },
      { id: '5', timestamp: new Date(Date.now() - 1200000).toISOString(), level: 'INFO', message: 'Drop claimed: Fortnite Season 8', source: 'DropClaimer' },
      { id: '6', timestamp: new Date(Date.now() - 600000).toISOString(), level: 'INFO', message: 'Points claimed: 50 points', source: 'PointClaimer' },
      { id: '7', timestamp: new Date(Date.now() - 300000).toISOString(), level: 'ERROR', message: 'Failed to connect to chat server', source: 'ChatFarmer' },
      { id: '8', timestamp: new Date(Date.now() - 60000).toISOString(), level: 'INFO', message: 'Account reconnected: user123', source: 'AccountManager' },
    ];
    setLogs(mockLogs);
  }, []);

  const getLevelIcon = (level: LogEntry['level']) => {
    const icons = {
      INFO: <Info size={14} />,
      WARN: <AlertTriangle size={14} />,
      ERROR: <AlertCircle size={14} />,
      DEBUG: <Terminal size={14} />
    };
    return icons[level];
  };

  const getLevelColor = (level: LogEntry['level']) => {
    const colors = {
      INFO: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20',
      WARN: 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20',
      ERROR: 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20',
      DEBUG: 'text-[#71717a] bg-[#71717a]/10 border-[#71717a]/20'
    };
    return colors[level];
  };

  const exportLogs = () => {
    const content = filteredLogs.map(log => 
      `[${log.timestamp}] [${log.level}]${log.source ? ` [${log.source}]` : ''} ${log.message}`
    ).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      setLogs([]);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
          <p className="text-[#a1a1aa] text-sm mt-1">Real-time log viewer and analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsStatsOpen(!isStatsOpen)}
            className={`p-2 rounded-lg transition-colors ${
              isStatsOpen
                ? 'bg-[#9146FF] text-white'
                : 'bg-[#27272a] text-[#a1a1aa] hover:text-white'
            }`}
            aria-label="Toggle statistics"
          >
            <Filter size={18} />
          </button>
          <button
            onClick={exportLogs}
            className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Download size={16} />
            Export
          </button>
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Trash2 size={16} />
            Clear
          </button>
        </div>
      </div>

      {/* Statistics Panel */}
      <AnimatePresence>
        {isStatsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
              <h3 className="text-lg font-semibold mb-4">Log Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatBox label="Total Logs" value={stats.total} color="blue" />
                <StatBox label="Errors" value={stats.byLevel.ERROR || 0} color="red" />
                <StatBox label="Warnings" value={stats.byLevel.WARN || 0} color="yellow" />
                <StatBox label="Info" value={stats.byLevel.INFO || 0} color="green" />
              </div>

              {stats.commonErrors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-[#a1a1aa] mb-3">Most Common Errors</h4>
                  <div className="space-y-2">
                    {stats.commonErrors.map((error, index) => (
                      <div key={index} className="flex items-center justify-between text-sm bg-[#27272a] rounded px-3 py-2">
                        <span className="text-[#fafafa] truncate flex-1 mr-4">{error.message}</span>
                        <span className="text-[#ef4444] font-medium">{error.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters and Search */}
      <div className="bg-[#18181b] rounded-lg p-4 border border-[#27272a]">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#71717a]" size={18} />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#9146FF] transition-colors"
            />
          </div>

          {/* Level Filter */}
          <div className="flex gap-2">
            {(['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  levelFilter === level
                    ? 'bg-[#9146FF] text-white'
                    : 'bg-[#27272a] text-[#a1a1aa] hover:text-white'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              autoScroll
                ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20'
                : 'bg-[#27272a] text-[#a1a1aa] hover:text-white'
            }`}
          >
            {autoScroll ? <ChevronDown size={18} className="inline mr-1" /> : <ChevronUp size={18} className="inline mr-1" />}
            Auto-scroll
          </button>
        </div>
      </div>

      {/* Logs Display */}
      <div className="bg-[#09090b] rounded-lg border border-[#27272a] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#18181b] border-b border-[#27272a]">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-[#a1a1aa]" />
            <span className="text-sm font-medium text-[#a1a1aa]">
              Showing {filteredLogs.length} of {logs.length} logs
            </span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
            connected 
              ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20' 
              : 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20'
          }`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`}></span>
            {connected ? 'Live' : 'Disconnected'}
          </div>
        </div>

        {/* Log entries */}
        <div className="h-[600px] overflow-y-auto p-4 space-y-2 font-mono text-sm">
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#a1a1aa]">
              <div className="text-center">
                <Terminal size={48} className="mx-auto mb-4 opacity-50" />
                <p>No logs to display</p>
              </div>
            </div>
          ) : (
            <AnimatePresence>
              {filteredLogs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`flex gap-3 p-3 rounded-lg border ${getLevelColor(log.level)}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getLevelIcon(log.level)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      {log.source && (
                        <>
                          <span>•</span>
                          <span>{log.source}</span>
                        </>
                      )}
                    </div>
                    <p className="text-[#fafafa] break-words">{log.message}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

interface StatBoxProps {
  label: string;
  value: number;
  color: 'blue' | 'red' | 'yellow' | 'green';
}

const StatBox: React.FC<StatBoxProps> = ({ label, value, color }) => {
  const colorClasses = {
    blue: 'text-[#3b82f6] bg-[#3b82f6]/10',
    red: 'text-[#ef4444] bg-[#ef4444]/10',
    yellow: 'text-[#f59e0b] bg-[#f59e0b]/10',
    green: 'text-[#10b981] bg-[#10b981]/10'
  };

  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-[#a1a1aa] mt-1">{label}</p>
    </div>
  );
};

export default Logs;
