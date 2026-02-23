import { useEffect, useState } from "react";
import { Activity, Gift, Coins, Clock, Server, MessageCircle, TrendingUp } from "lucide-react";
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
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = () => {
      fetch("/api/stats")
        .then((r) => r.json())
        .then(setStats);
      fetch("/api/logs")
        .then((r) => r.json())
        .then(setLogs);
    };
    
    fetchData();
    const interval = setInterval(fetchData, 5000);
    
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
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-[#a1a1aa] mt-1">
          System overview and real-time statistics.
        </p>
      </header>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Points",
            value: stats.totalPoints?.toLocaleString() || "0",
            icon: Coins,
            color: "text-yellow-500",
            subtext: "Auto-claimed from channels"
          },
          {
            label: "Point Claims",
            value: stats.totalClaims || 0,
            icon: Activity,
            color: "text-green-500",
            subtext: "Successful claims"
          },
          {
            label: "Active Accounts",
            value: stats.activeAccounts || 0,
            icon: Server,
            color: "text-[#10b981]",
            subtext: "Farming channels"
          },
          {
            label: "Chat Connections",
            value: stats.connectedChats || 0,
            icon: MessageCircle,
            color: "text-blue-400",
            subtext: "Connected to Twitch"
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex items-center gap-4"
          >
            <div className={`p-3 rounded-lg bg-[#27272a]/50 ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-[#a1a1aa]">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-[#71717a]">{stat.subtext}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Betting Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-[#27272a]/50 text-purple-500">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-[#a1a1aa]">Total Bets Placed</p>
            <p className="text-2xl font-bold">{stats.totalBets || 0}</p>
            <p className="text-xs text-[#71717a]">Algorithmic betting</p>
          </div>
        </div>
        
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-[#27272a]/50 text-[#9146FF]">
            <Gift size={24} />
          </div>
          <div>
            <p className="text-sm text-[#a1a1aa]">Drops Claimed</p>
            <p className="text-2xl font-bold">{stats.dropsClaimed || 0}</p>
            <p className="text-xs text-[#71717a]">20/80 Allocation Active</p>
          </div>
        </div>
        
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-[#27272a]/50 text-blue-400">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-[#a1a1aa]">System Uptime</p>
            <p className="text-lg font-bold">{stats.uptime || "Unknown"}</p>
            <p className="text-xs text-[#71717a]">Real-time monitoring</p>
          </div>
        </div>
      </div>

      {/* Points Chart */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">24-Hour Points Trend</h2>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={mockChartData}>
            <defs>
              <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="time" stroke="#71717a" />
            <YAxis stroke="#71717a" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
              labelStyle={{ color: '#a1a1aa' }}
            />
            <Area type="monotone" dataKey="points" stroke="#fbbf24" fillOpacity={1} fill="url(#colorPoints)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Activity Log */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Activity Log</h2>
          <span className="text-sm text-[#a1a1aa]">Last 20 events</span>
        </div>
        <div className="space-y-2">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-[#a1a1aa]">No activity yet</div>
          ) : (
            logs.slice(0, 20).map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2 px-3 bg-[#27272a]/30 rounded-lg">
                <div className={`mt-0.5 w-2 h-2 rounded-full ${
                  log.type === 'success' ? 'bg-green-500' :
                  log.type === 'error' ? 'bg-red-500' :
                  log.type === 'warning' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm">{log.message}</p>
                  <p className="text-xs text-[#71717a] mt-1">
                    {log.username && <span className="text-[#a1a1aa]">{log.username}</span>}
                    {log.streamer && <span className="text-[#a1a1aa]"> → {log.streamer}</span>}
                    <span> • {new Date(log.time).toLocaleTimeString()}</span>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
