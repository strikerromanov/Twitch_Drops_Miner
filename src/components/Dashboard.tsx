import { useEffect, useState } from "react";
import { useWebSocket } from "./WebSocketProvider";
import { Activity, Gift, Coins, Clock, Server, MessageCircle, TrendingUp, Wifi, WifiOff } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const mockChartData = [
  { time: "00:00", points: 1200 },
  { time: "04:00", points: 2100 },
  { time: "08:00", points: 1800 },
  { time: "12:00", points: 3400 },
  { time: "16:00", points: 4200 },
  { time: "20:00", points: 3800 },
  { time: "24:00", points: 5100 },
];

export default function Dashboard() {
  const { connected, stats, recentClaims, activeStreams, recentBets } = useWebSocket();
  const [logs, setLogs] = useState<any[]>([]);

  // Fetch logs only (stats come from WebSocket)
  useEffect(() => {
    const fetchLogs = () => {
      fetch("/api/logs")
        .then((r) => r.json())
        .then(setLogs);
    };
    
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000); // Less frequent for logs
    
    return () => clearInterval(interval);
  }, []);

  if (!stats)
    return (
      <div className="animate-pulse flex space-x-4">
        <div className="flex-1 space-y-4 py-1">
          <div className="h-4 bg-[#27272a] rounded w-3/4"></div>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-[#a1a1aa] text-sm mt-1">
            Real-time monitoring and analytics
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
          connected ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#ef4444]/10 text-[#ef4444]'
        }`}>
          {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span className="text-xs font-medium">
            {connected ? 'Connected' : 'Reconnecting...'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[#a1a1aa] text-sm font-medium">Active Accounts</span>
            <Activity className="text-[#9146FF]" size={20} />
          </div>
          <div className="text-3xl font-bold">{stats.activeAccounts || 0}</div>
          <div className="text-xs text-[#a1a1aa] mt-1">Currently farming</div>
        </div>

        <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[#a1a1aa] text-sm font-medium">Total Points</span>
            <Coins className="text-[#fbbf24]" size={20} />
          </div>
          <div className="text-3xl font-bold">{stats.totalPoints || 0}</div>
          <div className="text-xs text-[#a1a1aa] mt-1">Lifetime earnings</div>
        </div>

        <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[#a1a1aa] text-sm font-medium">Active Channels</span>
            <Server className="text-[#10b981]" size={20} />
          </div>
          <div className="text-3xl font-bold">{stats.activeChannels || 0}</div>
          <div className="text-xs text-[#a1a1aa] mt-1">Watching now</div>
        </div>

        <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[#a1a1aa] text-sm font-medium">Recent Claims</span>
            <Gift className="text-[#ec4899]" size={20} />
          </div>
          <div className="text-3xl font-bold">{recentClaims.length}</div>
          <div className="text-xs text-[#a1a1aa] mt-1">Last hour</div>
        </div>
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Points Chart */}
        <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-[#9146FF]" />
            Points Over Time
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mockChartData}>
              <defs>
                <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9146FF" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#9146FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="time" stroke="#71717a" style={{ fontSize: '12px' }} />
              <YAxis stroke="#71717a" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                }}
              />
              <Area type="monotone" dataKey="points" stroke="#9146FF" fillOpacity={1} fill="url(#colorPoints)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity */}
        <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock size={20} className="text-[#9146FF]" />
            Recent Activity
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {recentClaims.slice(0, 10).map((claim: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-[#09090b] rounded-lg border border-[#27272a]">
                <div className="flex items-center gap-3">
                  <Gift size={16} className="text-[#ec4899]" />
                  <div>
                    <div className="text-sm font-medium">{claim.streamer}</div>
                    <div className="text-xs text-[#a1a1aa]">{claim.bonus_type}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-[#10b981]">+{claim.points_claimed}</div>
                  <div className="text-xs text-[#a1a1aa]">
                    {new Date(claim.claimed_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {recentClaims.length === 0 && (
              <div className="text-center text-[#a1a1aa] text-sm py-8">
                No recent activity
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Streams */}
      <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Server size={20} className="text-[#9146FF]" />
          Active Streams
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeStreams.slice(0, 12).map((stream: any, idx: number) => (
            <div key={idx} className="bg-[#09090b] rounded-lg p-4 border border-[#27272a]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded bg-[#9146FF]/20 flex items-center justify-center">
                  <MessageCircle size={20} className="text-[#9146FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{stream.streamer}</div>
                  <div className="text-xs text-[#a1a1aa]">{stream.game || 'Unknown'}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a1a1aa]">
                  {stream.viewer_count?.toLocaleString() || 0} viewers
                </span>
                <span className="text-[#10b981]">Live</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Logs */}
      <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
        <h3 className="text-lg font-semibold mb-4">System Logs</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto font-mono text-xs">
          {logs.slice(0, 50).map((log: any, idx: number) => (
            <div key={idx} className={`p-2 rounded ${
              log.type === 'error' ? 'bg-[#ef4444]/10 text-[#ef4444]' :
              log.type === 'success' ? 'bg-[#10b981]/10 text-[#10b981]' :
              'bg-[#27272a]/50 text-[#a1a1aa]'
            }`}>
              <span className="opacity-60">[{new Date(log.time).toLocaleTimeString()}]</span>{' '}
              <span className="font-semibold">[{log.type.toUpperCase()}]</span>{' '}
              {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
