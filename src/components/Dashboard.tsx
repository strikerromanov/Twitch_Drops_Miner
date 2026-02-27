import React, { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketProvider';
import { useNotifications } from './Notifications';
import type { DropCampaign, Account } from '../core/types';
import { 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, Gift, Clock, Activity, Zap } from 'lucide-react';

interface SystemStats {
  activeAccounts: number;
  totalAccounts: number;
  totalDrops: number;
  activeDrops: number;
  claimedDrops: number;
  activeStreams: number;
  recentClaims: number;
  timestamp: string;
}

interface TimeSeriesData {
  time: string;
  points: number;
  drops: number;
}

interface GameData {
  name: string;
  value: number;
  streams: number;
}

interface ProgressData {
  name: string;
  progress: number;
  required: number;
  status: string;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCampaigns, setActiveCampaigns] = useState<DropCampaign[]>([]);
  const [pointsHistory, setPointsHistory] = useState<TimeSeriesData[]>([]);
  const [gameDistribution, setGameDistribution] = useState<GameData[]>([]);
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const { connected } = useWebSocket();
  const { addNotification } = useNotifications();

  const COLORS = ['#9146FF', '#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  const getGameName = (game: any) => typeof game === "string" ? game : game?.name;

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns');
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const data = await response.json();
      setActiveCampaigns(data);
      
      // Transform campaigns to progress data
      const progress: ProgressData[] = data
        .filter((c: DropCampaign) => c.required_minutes_watch_time)
        .map((c: DropCampaign) => ({
          name: c.name.substring(0, 30) + '...',
          progress: c.current_minutes || 0,
          required: c.required_minutes_watch_time,
          status: c.status
        }));
      setProgressData(progress);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    }
  };

  // Mock data for charts (replace with real API endpoints)
  const generateMockData = () => {
    const now = new Date();
    const history: TimeSeriesData[] = [];
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 3600000);
      history.push({
        time: time.getHours() + ':00',
        points: Math.floor(Math.random() * 500) + 100,
        drops: Math.floor(Math.random() * 10)
      });
    }
    setPointsHistory(history);

    const games: GameData[] = [
      { name: 'Fortnite', value: 35, streams: 12 },
      { name: 'League of Legends', value: 25, streams: 8 },
      { name: 'Valorant', value: 20, streams: 6 },
      { name: 'Apex Legends', value: 15, streams: 4 },
      { name: 'Other', value: 5, streams: 2 }
    ];
    setGameDistribution(games);
  };

  useEffect(() => {
    fetchStats();
    fetchCampaigns();
    generateMockData();
    
    const interval = setInterval(() => {
      fetchStats();
      fetchCampaigns();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // WebSocket message handling
  useEffect(() => {
    if (!connected) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'DROP_CLAIMED':
            addNotification(
              `Drop claimed: ${data.dropName || 'Unknown Drop'}`,
              'success',
              5000,
              true
            );
            break;
          case 'POINTS_CLAIMED':
            addNotification(
              `Points claimed: ${data.amount || 0} points`,
              'success',
              3000
            );
            break;
          case 'ACCOUNT_CONNECTED':
            addNotification(
              `Account connected: ${data.username}`,
              'success'
            );
            break;
          case 'ACCOUNT_DISCONNECTED':
            addNotification(
              `Account disconnected: ${data.username}`,
              'warning'
            );
            break;
          case 'ERROR':
            addNotification(
              data.message || 'An error occurred',
              'error'
            );
            break;
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    // Store handler for WebSocketProvider
    (window as any).__dashboardMessageHandler = handleMessage;

    return () => {
      delete (window as any).__dashboardMessageHandler;
    };
  }, [connected, addNotification]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#27272a] rounded w-48"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-[#27272a] rounded-lg"></div>
            ))}
          </div>
          <div className="h-64 bg-[#27272a] rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg p-6 text-center">
          <p className="text-[#ef4444] font-medium mb-4">Error loading dashboard</p>
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-[#9146FF] hover:bg-[#772ce8] rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const calculateSuccessRate = () => {
    if (!stats || stats.totalDrops === 0) return 0;
    return Math.round((stats.claimedDrops / stats.totalDrops) * 100);
  };

  const calculateFarmingRate = () => {
    if (!stats || !stats.activeAccounts) return 0;
    return Math.round((stats.activeDrops / stats.activeAccounts) * 10) / 10;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-[#a1a1aa] text-sm mt-1">Real-time monitoring and analytics</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
          connected 
            ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20' 
            : 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20'
        }`}>
          <span className={`relative flex h-2.5 w-2.5`}>
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
              connected ? 'bg-[#10b981]' : 'bg-[#ef4444]'
            } opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              connected ? 'bg-[#10b981]' : 'bg-[#ef4444]'
            }`}></span>
          </span>
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>

      {/* Stats Cards Grid */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Points Today"
            value={stats.recentClaims * 50}
            icon={<Zap size={20} />}
            trend="+12%"
            color="purple"
          />
          <StatCard
            title="Drops This Week"
            value={stats.claimedDrops}
            icon={<Gift size={20} />}
            trend="+5%"
            color="green"
          />
          <StatCard
            title="Farming Rate"
            value={`${calculateFarmingRate()}/hr`}
            icon={<Activity size={20} />}
            trend="Stable"
            color="blue"
          />
          <StatCard
            title="Success Rate"
            value={`${calculateSuccessRate()}%`}
            icon={<TrendingUp size={20} />}
            trend="+2%"
            color="yellow"
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Points Over Time Chart */}
        <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-[#9146FF]" />
            Points Claimed (24h)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={pointsHistory}>
              <defs>
                <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9146FF" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#9146FF" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis 
                dataKey="time" 
                stroke="#71717a"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#71717a"
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#18181b', 
                  border: '1px solid #27272a', 
                  borderRadius: '8px',
                  color: '#fafafa'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="points" 
                stroke="#9146FF" 
                fillOpacity={1} 
                fill="url(#colorPoints)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Active Streams by Game */}
        <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
          <h3 className="text-lg font-semibold mb-4">Active Streams by Game</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={gameDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {gameDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#18181b', 
                  border: '1px solid #27272a', 
                  borderRadius: '8px',
                  color: '#fafafa'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {gameDistribution.map((game, index) => (
              <div key={game.name} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                ></div>
                <span className="text-[#a1a1aa]">{game.name}</span>
                <span className="font-medium">{game.streams}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drop Progress by Campaign */}
      <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
        <h3 className="text-lg font-semibold mb-4">Drop Progress by Campaign</h3>
        {progressData.length === 0 ? (
          <div className="text-center py-12 text-[#a1a1aa]">
            <Gift size={48} className="mx-auto mb-4 opacity-50" />
            <p>No active drop campaigns</p>
          </div>
        ) : (
          <div className="space-y-4">
            {progressData.map((campaign, index) => {
              const percentage = Math.min(100, (campaign.progress / campaign.required) * 100);
              return (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-[#fafafa]">{campaign.name}</span>
                    <span className="text-[#a1a1aa]">
                      {Math.floor(percentage)}% ({campaign.progress}/{campaign.required} min)
                    </span>
                  </div>
                  <div className="w-full bg-[#27272a] rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: percentage >= 100 ? '#10b981' : '#9146FF'
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Campaigns List */}
      <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
        <h3 className="text-lg font-semibold mb-4">Active Campaigns</h3>
        {activeCampaigns.length === 0 ? (
          <div className="text-center py-12 text-[#a1a1aa]">
            <Gift size={48} className="mx-auto mb-4 opacity-50" />
            <p>No active campaigns at the moment</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeCampaigns.map(campaign => (
              <div 
                key={campaign.id} 
                className="bg-[#27272a]/50 rounded-lg p-4 hover:bg-[#27272a] transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-white">{campaign.name}</h4>
                    <p className="text-sm text-[#a1a1aa]">{getGameName(campaign.game) || 'Unknown Game'}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    campaign.status === 'active' 
                      ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20' 
                      : campaign.status === 'claimed'
                      ? 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20'
                      : 'bg-[#71717a]/10 text-[#71717a] border border-[#71717a]/20'
                  }`}>
                    {campaign.status}
                  </span>
                </div>
                {campaign.required_minutes_watch_time && (
                  <div className="w-full bg-[#18181b] rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-[#9146FF] to-[#a78bfa] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (campaign.current_minutes || 0) / campaign.required_minutes_watch_time * 100)}%` }}
                    ></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend: string;
  color: 'purple' | 'green' | 'blue' | 'yellow';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, color }) => {
  const colorClasses = {
    purple: 'bg-[#9146FF]/10 text-[#9146FF] border-[#9146FF]/20',
    green: 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20',
    blue: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20',
    yellow: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20'
  };

  return (
    <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a] hover:border-[#3f3f46] transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-lg border ${colorClasses[color]}`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded-full">
          {trend}
        </span>
      </div>
      <div>
        <p className="text-[#a1a1aa] text-sm font-medium mb-1">{title}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
};

export default Dashboard;
