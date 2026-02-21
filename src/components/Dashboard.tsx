import { useEffect, useState } from "react";
import { Activity, Gift, Coins, Clock, Server } from "lucide-react";
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
    
    fetchData(); // Initial fetch
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds
    
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Points",
            value: stats.totalPoints.toLocaleString(),
            icon: Coins,
            color: "text-yellow-500",
          },
          {
            label: "Drops Claimed",
            value: stats.dropsClaimed,
            icon: Gift,
            color: "text-[#9146FF]",
          },
          {
            label: "Active Accounts",
            value: stats.activeAccounts,
            icon: Server,
            color: "text-[#10b981]",
          },
          {
            label: "System Uptime",
            value: stats.uptime,
            icon: Clock,
            color: "text-blue-400",
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
              <p className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider">
                {stat.label}
              </p>
              <p className="text-2xl font-mono font-semibold mt-1">
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-[#18181b] border border-[#27272a] rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Points Farmed (24h)</h2>
            <Activity className="text-[#a1a1aa]" size={20} />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData}>
                <defs>
                  <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9146FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#9146FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#27272a"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  stroke="#a1a1aa"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#27272a",
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: "#fafafa" }}
                />
                <Area
                  type="monotone"
                  dataKey="points"
                  stroke="#9146FF"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPoints)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Log */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 flex flex-col">
          <h2 className="text-lg font-semibold mb-6">Recent Activity</h2>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-3 text-sm">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-[#9146FF]"></div>
                <div>
                  <p className="text-[#fafafa]">{log.message}</p>
                  <p className="text-xs text-[#a1a1aa] mt-0.5 font-mono">
                    {new Date(log.time).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
