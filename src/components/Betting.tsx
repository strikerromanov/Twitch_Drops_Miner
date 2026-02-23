import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Activity, DollarSign, Shield, Play, Settings } from "lucide-react";

interface Bet {
  id: number;
  streamer: string;
  account_id: number;
  bet_amount: number;
  outcome: string;
  bet_type: string;
  strategy: string;
  placed_at: string;
  result_amount: number;
}

interface StreamerStats {
  streamer: string;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  avgBetAmount: number;
  netProfit: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export default function Betting() {
  const [stats, setStats] = useState<StreamerStats[]>([]);
  const [recentBets, setRecentBets] = useState<Bet[]>([]);
  const [bettingEnabled, setBettingEnabled] = useState(false);
  const [maxBetPercentage, setMaxBetPercentage] = useState(5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const [statsRes, betsRes, settingsRes] = await Promise.all([
        fetch("/api/betting-stats"),
        fetch("/api/streamer-analysis"),
        fetch("/api/settings")
      ]);
      
      const statsData = await statsRes.json();
      const betsData = await betsRes.json();
      const settingsData = await settingsRes.json();
      
      setStats(Array.isArray(statsData) ? statsData : []);
      setRecentBets(Array.isArray(betsData) ? betsData.slice(0, 20) : []);
      setBettingEnabled(settingsData.bettingEnabled === 'true');
      setMaxBetPercentage(parseInt(settingsData.maxBetPercentage) || 5);
    } catch (error) {
      console.error("Failed to fetch betting data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleBetting() {
    try {
      await fetch("/api/settings/betting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bettingEnabled: !bettingEnabled, maxBetPercentage })
      });
      setBettingEnabled(!bettingEnabled);
    } catch (error) {
      console.error("Failed to toggle betting:", error);
    }
  }

  async function updateMaxPercentage(value: number) {
    try {
      await fetch("/api/settings/betting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bettingEnabled, maxBetPercentage: value })
      });
      setMaxBetPercentage(value);
    } catch (error) {
      console.error("Failed to update max bet percentage:", error);
    }
  }

  function getRiskColor(level: string) {
    switch (level) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-red-500';
      default: return 'text-gray-500';
    }
  }

  function getRiskBg(level: string) {
    switch (level) {
      case 'low': return 'bg-green-500/10 border-green-500/20';
      case 'medium': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'high': return 'bg-red-500/10 border-red-500/20';
      default: return 'bg-gray-500/10 border-gray-500/20';
    }
  }

  const totalNetProfit = stats.reduce((sum, s) => sum + s.netProfit, 0);
  const totalBets = stats.reduce((sum, s) => sum + s.totalBets, 0);
  const avgWinRate = stats.length > 0 ? stats.reduce((sum, s) => sum + s.winRate, 0) / stats.length : 0;

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Betting Engine</h1>
        <p className="text-[#a1a1aa] mt-1">
          Algorithmic betting strategies with risk mitigation.
        </p>
      </header>

      {/* Control Panel */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${bettingEnabled ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
              <Play size={24} className={bettingEnabled ? 'text-green-500' : 'text-gray-500'} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Automated Betting</h2>
              <p className="text-sm text-[#a1a1aa]">{bettingEnabled ? "Active - Placing bets every 15 minutes" : "Disabled - No automated bets"}</p>
            </div>
          </div>
          <button
            onClick={toggleBetting}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              bettingEnabled
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
          >
            {bettingEnabled ? "Disable Betting" : "Enable Betting"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#27272a]/50 rounded-lg p-4">
            <label className="block text-sm text-[#a1a1aa] mb-2">Max Bet Percentage</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="20"
                value={maxBetPercentage}
                onChange={(e) => updateMaxPercentage(parseInt(e.target.value))}
                className="flex-1 h-2 bg-[#3f3f46] rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xl font-bold w-16 text-right">{maxBetPercentage}%</span>
            </div>
            <p className="text-xs text-[#a1a1aa] mt-2">Maximum % of points to bet per wager</p>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-[#27272a]/50">
              <Activity size={20} className="text-blue-400" />
            </div>
            <span className="text-sm text-[#a1a1aa]">Total Bets</span>
          </div>
          <p className="text-3xl font-bold">{totalBets}</p>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-[#27272a]/50">
              <TrendingUp size={20} className="text-green-400" />
            </div>
            <span className="text-sm text-[#a1a1aa]">Avg Win Rate</span>
          </div>
          <p className="text-3xl font-bold">{avgWinRate.toFixed(1)}%</p>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-[#27272a]/50">
              <DollarSign size={20} className={totalNetProfit >= 0 ? "text-green-400" : "text-red-400"} />
            </div>
            <span className="text-sm text-[#a1a1aa]">Net Profit</span>
          </div>
          <p className={`text-3xl font-bold ${totalNetProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalNetProfit >= 0 ? '+' : ''}{totalNetProfit.toLocaleString()}
          </p>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-[#27272a]/50">
              <Shield size={20} className="text-purple-400" />
            </div>
            <span className="text-sm text-[#a1a1aa]">Low Risk Streamers</span>
          </div>
          <p className="text-3xl font-bold">{stats.filter(s => s.riskLevel === 'low').length}</p>
        </div>
      </div>

      {/* Streamer Performance Table */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Streamer Performance Analysis</h2>
        {loading ? (
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-[#27272a] rounded w-3/4"></div>
              <div className="h-4 bg-[#27272a] rounded w-1/2"></div>
            </div>
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-12 text-[#a1a1aa]">
            <Shield size={48} className="mx-auto mb-4 opacity-50" />
            <p>No betting data yet. Start farming to collect statistics.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#27272a]">
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#a1a1aa]">Streamer</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#a1a1aa]">Bets</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#a1a1aa]">Win Rate</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#a1a1aa]">Net Profit</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#a1a1aa]">Risk Level</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#a1a1aa]">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat, idx) => (
                  <tr key={idx} className="border-b border-[#27272a]/50 hover:bg-[#27272a]/20">
                    <td className="py-3 px-4 font-medium">{stat.streamer}</td>
                    <td className="py-3 px-4">{stat.totalBets}</td>
                    <td className="py-3 px-4">
                      <span className={stat.winRate >= 55 ? 'text-green-400' : stat.winRate >= 45 ? 'text-yellow-400' : 'text-red-400'}>
                        {stat.winRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className={`py-3 px-4 ${stat.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {stat.netProfit >= 0 ? '+' : ''}{stat.netProfit.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskBg(stat.riskLevel)} ${getRiskColor(stat.riskLevel)}`}>
                        {stat.riskLevel.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-[#a1a1aa]">
                      {stat.riskLevel === 'low' ? 'Increase bets' : stat.riskLevel === 'high' ? 'Avoid betting' : 'Maintain current'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Bets */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Bets</h2>
        <div className="space-y-2">
          {recentBets.length === 0 ? (
            <div className="text-center py-8 text-[#a1a1aa]">No recent bets</div>
          ) : (
            recentBets.map((bet) => (
              <div key={bet.id} className="flex items-center justify-between py-3 px-4 bg-[#27272a]/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${bet.outcome === 'win' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    {bet.outcome === 'win' ? (
                      <TrendingUp size={16} className="text-green-400" />
                    ) : (
                      <TrendingDown size={16} className="text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{bet.streamer}</p>
                    <p className="text-xs text-[#a1a1aa]">{new Date(bet.placed_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{bet.bet_amount} pts</p>
                  <p className={`text-sm ${bet.result_amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {bet.result_amount >= 0 ? '+' : ''}{bet.result_amount}
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
